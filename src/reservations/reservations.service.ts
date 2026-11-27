import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilterQuery, Model, Types } from 'mongoose';

import { ReservationStatus } from '../common/enums/reservation-status.enum';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/types/request-with-user';
import { ResourcesService } from '../resources/resources.service';
import { Resource } from '../resources/schemas/resource.schema';

import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { Reservation, ReservationDocument } from './schemas/reservation.schema';

// Only these statuses keep a time slot booked
const ACTIVE_STATUSES = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

@Injectable()
export class ReservationsService {
  private logger = new Logger(ReservationsService.name);
  private timeZone: string;

  constructor(
    @InjectModel(Reservation.name)
    private reservationModel: Model<Reservation>,
    private resourcesService: ResourcesService,
    configService: ConfigService,
  ) {
    this.timeZone = configService.getOrThrow<string>('APP_TIMEZONE');
  }

  async create(customerId: string, dto: CreateReservationDto) {
    const resource = await this.resourcesService.findActive(dto.resourceId);

    this.checkTimes(resource, dto.startTime, dto.endTime);
    this.checkCapacity(resource, dto.attendees);

    return this.resourcesService.withBookingLock(
      resource._id,
      () => this.checkNotBooked(resource._id, dto.startTime, dto.endTime),
      () =>
        this.reservationModel.create({
          customer: customerId,
          resource: resource._id,
          startTime: dto.startTime,
          endTime: dto.endTime,
          attendees: dto.attendees,
          notes: dto.notes,
        }),
    );
  }

  findAll(query: QueryReservationsDto) {
    return this.findPage({}, query);
  }

  findMine(customerId: string, query: QueryReservationsDto) {
    return this.findPage({ customer: customerId }, query);
  }

  // Customers only find their own reservations. Someone else's reservation
  // returns 404 so its id isn't confirmed to exist.
  async findOne(id: string, user: AuthUser) {
    const filter: FilterQuery<Reservation> = { _id: id };

    if (user.role !== Role.ADMIN) {
      filter.customer = user.userId;
    }

    const reservation = await this.reservationModel.findOne(filter);

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    return reservation;
  }

  async update(id: string, user: AuthUser, dto: UpdateReservationDto) {
    const reservation = await this.findOne(id, user);
    this.checkIsUpcoming(reservation);

    const resource = await this.resourcesService.findActive(
      reservation.resource.toString(),
    );

    const startTime = dto.startTime ?? reservation.startTime;
    const endTime = dto.endTime ?? reservation.endTime;
    const timeChanged =
      startTime.getTime() !== reservation.startTime.getTime() ||
      endTime.getTime() !== reservation.endTime.getTime();

    if (dto.attendees !== undefined) {
      this.checkCapacity(resource, dto.attendees);
    }

    if (timeChanged) {
      this.checkTimes(resource, startTime, endTime);
    }

    reservation.set({
      startTime,
      endTime,
      attendees: dto.attendees ?? reservation.attendees,
      notes: dto.notes ?? reservation.notes,
    });

    // Without a new time nothing can start overlapping, so no lock is needed
    if (!timeChanged) {
      return reservation.save();
    }

    // A new time has to be confirmed again by an admin
    reservation.status = ReservationStatus.PENDING;

    return this.resourcesService.withBookingLock(
      resource._id,
      () =>
        this.checkNotBooked(resource._id, startTime, endTime, reservation._id),
      () => reservation.save(),
    );
  }

  async cancel(id: string, user: AuthUser) {
    const reservation = await this.findOne(id, user);
    this.checkIsUpcoming(reservation);

    reservation.status = ReservationStatus.CANCELLED;
    return reservation.save();
  }

  async confirm(id: string, user: AuthUser) {
    const reservation = await this.findOne(id, user);

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending reservations can be confirmed',
      );
    }
    this.checkIsUpcoming(reservation);

    reservation.status = ReservationStatus.CONFIRMED;
    return reservation.save();
  }

  async checkAvailability(dto: CheckAvailabilityDto) {
    const resource = await this.resourcesService.findActive(dto.resourceId);
    this.checkTimes(resource, dto.startTime, dto.endTime);

    const booked = await this.isBooked(
      resource._id,
      dto.startTime,
      dto.endTime,
    );

    return { available: !booked };
  }

  // A pending reservation that wasn't confirmed before it started is expired
  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingReservations() {
    const result = await this.reservationModel.updateMany(
      { status: ReservationStatus.PENDING, startTime: { $lte: new Date() } },
      { status: ReservationStatus.EXPIRED },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(`Expired ${result.modifiedCount} pending reservations`);
    }
  }

  private async findPage(
    filter: FilterQuery<Reservation>,
    query: QueryReservationsDto,
  ) {
    const { page, limit, status, from, to } = query;

    if (from && to && from > to) {
      throw new BadRequestException('from must be before to');
    }

    if (status) {
      filter.status = status;
    }

    if (from || to) {
      const startTime: { $gte?: Date; $lte?: Date } = {};
      if (from) startTime.$gte = from;
      if (to) startTime.$lte = to;
      filter.startTime = startTime;
    }

    const reservations = await this.reservationModel
      .find(filter)
      .sort({ startTime: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await this.reservationModel.countDocuments(filter);

    return {
      data: reservations,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private checkTimes(resource: Resource, startTime: Date, endTime: Date) {
    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    if (startTime <= new Date()) {
      throw new BadRequestException('startTime must be in the future');
    }

    const start = this.toLocalTime(startTime);
    const end = this.toLocalTime(endTime);
    const { openTime, closeTime } = resource.operatingHours;

    // Times are "HH:mm:ss" strings, so string comparison follows the clock
    const withinHours =
      start.day === end.day &&
      start.time >= `${openTime}:00` &&
      end.time <= `${closeTime}:00`;

    if (!withinHours) {
      throw new BadRequestException(
        `Reservation must be within operating hours (${openTime}-${closeTime} ${this.timeZone})`,
      );
    }
  }

  private checkCapacity(resource: Resource, attendees: number) {
    if (attendees > resource.capacity) {
      throw new BadRequestException(
        `attendees cannot be more than the resource capacity (${resource.capacity})`,
      );
    }
  }

  private checkIsUpcoming(reservation: ReservationDocument) {
    if (!ACTIVE_STATUSES.includes(reservation.status)) {
      throw new BadRequestException(
        `Reservation is already ${reservation.status.toLowerCase()}`,
      );
    }

    if (reservation.startTime <= new Date()) {
      throw new BadRequestException('Reservation has already started');
    }
  }

  private async checkNotBooked(
    resourceId: Types.ObjectId,
    startTime: Date,
    endTime: Date,
    ignoreReservationId?: Types.ObjectId,
  ) {
    const booked = await this.isBooked(
      resourceId,
      startTime,
      endTime,
      ignoreReservationId,
    );

    if (booked) {
      throw new ConflictException(
        'The resource is already booked for this time',
      );
    }
  }

  // Two time ranges overlap when each one starts before the other one ends
  private async isBooked(
    resourceId: Types.ObjectId,
    startTime: Date,
    endTime: Date,
    ignoreReservationId?: Types.ObjectId,
  ) {
    const filter: FilterQuery<Reservation> = {
      resource: resourceId,
      status: { $in: ACTIVE_STATUSES },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };

    if (ignoreReservationId) {
      filter._id = { $ne: ignoreReservationId };
    }

    return (await this.reservationModel.exists(filter)) !== null;
  }

  // Returns the day and clock time of a date in APP_TIMEZONE,
  // e.g. { day: '2026-12-01', time: '09:30:00' }
  private toLocalTime(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value;

    return {
      day: `${get('year')}-${get('month')}-${get('day')}`,
      time: `${get('hour')}:${get('minute')}:${get('second')}`,
    };
  }
}
