import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';

import { ReservationStatus } from '../common/enums/reservation-status.enum';
import { Role } from '../common/enums/role.enum';
import { ResourcesService } from '../resources/resources.service';
import { ReservationsService } from './reservations.service';
import { Reservation } from './schemas/reservation.schema';

// Asia/Tokyo is UTC+9 all year, so 08:00-18:00 there is 23:00-09:00 UTC
const resource = {
  _id: new Types.ObjectId(),
  capacity: 6,
  operatingHours: { openTime: '08:00', closeTime: '18:00' },
};
const customerId = new Types.ObjectId().toString();

function makeReservation(overrides = {}) {
  const reservation = {
    _id: new Types.ObjectId(),
    customer: new Types.ObjectId(customerId),
    resource: resource._id,
    startTime: new Date('2030-01-15T01:00:00Z'),
    endTime: new Date('2030-01-15T02:00:00Z'),
    attendees: 2,
    notes: '',
    status: ReservationStatus.PENDING,
    ...overrides,
  };
  return {
    ...reservation,
    set(values: object) {
      Object.assign(this, values);
    },
    save: jest.fn(function (this: unknown) {
      return Promise.resolve(this);
    }),
  };
}

describe('ReservationsService', () => {
  let service: ReservationsService;
  const reservationModel = {
    create: jest.fn(),
    exists: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
  };
  // The real lock is tested against MongoDB in test/booking-lock.e2e-spec.ts
  const resourcesService = {
    findActive: jest.fn(),
    withBookingLock: jest.fn(
      async (
        _resourceId: Types.ObjectId,
        checkConflicts: () => Promise<void>,
        save: () => Promise<unknown>,
      ) => {
        await checkConflicts();
        return save();
      },
    ),
  };

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') });
    jest.clearAllMocks();
    resourcesService.findActive.mockResolvedValue(resource);
    reservationModel.exists.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getModelToken(Reservation.name),
          useValue: reservationModel,
        },
        { provide: ResourcesService, useValue: resourcesService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'Asia/Tokyo' },
        },
      ],
    }).compile();

    service = moduleRef.get(ReservationsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    const dto = {
      resourceId: resource._id.toString(),
      startTime: new Date('2030-01-15T01:00:00Z'), // 10:00 in Tokyo
      endTime: new Date('2030-01-15T02:00:00Z'), // 11:00 in Tokyo
      attendees: 4,
    };

    it('saves a valid reservation for the customer', async () => {
      await service.create(customerId, dto);

      expect(resourcesService.withBookingLock).toHaveBeenCalledWith(
        resource._id,
        expect.any(Function),
        expect.any(Function),
      );
      expect(reservationModel.create).toHaveBeenCalledWith({
        customer: customerId,
        resource: resource._id,
        startTime: dto.startTime,
        endTime: dto.endTime,
        attendees: 4,
        notes: undefined,
      });
    });

    it('allows a reservation that ends exactly at closing time', async () => {
      await service.create(customerId, {
        ...dto,
        startTime: new Date('2030-01-15T08:00:00Z'), // 17:00 in Tokyo
        endTime: new Date('2030-01-15T09:00:00Z'), // 18:00 in Tokyo
      });

      expect(reservationModel.create).toHaveBeenCalled();
    });

    it('rejects endTime before startTime', async () => {
      await expect(
        service.create(customerId, { ...dto, endTime: dto.startTime }),
      ).rejects.toThrow('endTime must be after startTime');
    });

    it('rejects a reservation in the past', async () => {
      await expect(
        service.create(customerId, {
          ...dto,
          startTime: new Date('2029-12-31T01:00:00Z'),
          endTime: new Date('2029-12-31T02:00:00Z'),
        }),
      ).rejects.toThrow('startTime must be in the future');
    });

    it('checks operating hours in APP_TIMEZONE', async () => {
      // 10:00-11:00 UTC is 19:00-20:00 in Tokyo
      await expect(
        service.create(customerId, {
          ...dto,
          startTime: new Date('2030-01-15T10:00:00Z'),
          endTime: new Date('2030-01-15T11:00:00Z'),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(reservationModel.create).not.toHaveBeenCalled();
      // invalid requests fail before taking the lock
      expect(resourcesService.withBookingLock).not.toHaveBeenCalled();
    });

    it('rejects more attendees than the resource capacity', async () => {
      await expect(
        service.create(customerId, { ...dto, attendees: 7 }),
      ).rejects.toThrow('attendees cannot be more than the resource capacity');
    });

    it('rejects a time that overlaps another booking', async () => {
      reservationModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(service.create(customerId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(reservationModel.exists).toHaveBeenCalledWith({
        resource: resource._id,
        status: {
          $in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
        },
        startTime: { $lt: dto.endTime },
        endTime: { $gt: dto.startTime },
      });
    });
  });

  describe('findOne', () => {
    it('limits customers to their own reservations', async () => {
      reservationModel.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('some-id', { userId: customerId, role: Role.CUSTOMER }),
      ).rejects.toThrow(NotFoundException);
      expect(reservationModel.findOne).toHaveBeenCalledWith({
        _id: 'some-id',
        customer: customerId,
      });
    });

    it('lets admins find any reservation', async () => {
      reservationModel.findOne.mockResolvedValue(makeReservation());

      await service.findOne('some-id', { userId: 'admin', role: Role.ADMIN });

      expect(reservationModel.findOne).toHaveBeenCalledWith({ _id: 'some-id' });
    });
  });

  describe('update', () => {
    it('moves a confirmed reservation back to pending when the time changes', async () => {
      const reservation = makeReservation({
        status: ReservationStatus.CONFIRMED,
      });
      reservationModel.findOne.mockResolvedValue(reservation);
      const startTime = new Date('2030-01-15T03:00:00Z');
      const endTime = new Date('2030-01-15T04:00:00Z');

      const updated = await service.update(
        reservation._id.toString(),
        { userId: customerId, role: Role.CUSTOMER },
        { startTime, endTime },
      );

      expect(updated.status).toBe(ReservationStatus.PENDING);
      expect(updated.startTime).toEqual(startTime);
      expect(resourcesService.withBookingLock).toHaveBeenCalledTimes(1);
      // the reservation itself must not count as a conflict
      expect(reservationModel.exists).toHaveBeenCalledWith(
        expect.objectContaining({ _id: { $ne: reservation._id } }),
      );
    });

    it('keeps the status when only notes change', async () => {
      const reservation = makeReservation({
        status: ReservationStatus.CONFIRMED,
      });
      reservationModel.findOne.mockResolvedValue(reservation);

      const updated = await service.update(
        reservation._id.toString(),
        { userId: customerId, role: Role.CUSTOMER },
        { notes: 'Bring a projector' },
      );

      expect(updated.status).toBe(ReservationStatus.CONFIRMED);
      expect(updated.notes).toBe('Bring a projector');
      expect(reservationModel.exists).not.toHaveBeenCalled();
      expect(resourcesService.withBookingLock).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    const user = { userId: customerId, role: Role.CUSTOMER };

    it('cancels an upcoming reservation', async () => {
      reservationModel.findOne.mockResolvedValue(makeReservation());

      const cancelled = await service.cancel('some-id', user);

      expect(cancelled.status).toBe(ReservationStatus.CANCELLED);
    });

    it('does not cancel a reservation twice', async () => {
      reservationModel.findOne.mockResolvedValue(
        makeReservation({ status: ReservationStatus.CANCELLED }),
      );

      await expect(service.cancel('some-id', user)).rejects.toThrow(
        'Reservation is already cancelled',
      );
    });

    it('does not cancel a reservation that already started', async () => {
      reservationModel.findOne.mockResolvedValue(
        makeReservation({ startTime: new Date('2029-12-31T23:30:00Z') }),
      );

      await expect(service.cancel('some-id', user)).rejects.toThrow(
        'Reservation has already started',
      );
    });
  });

  describe('confirm', () => {
    const admin = { userId: 'admin', role: Role.ADMIN };

    it('confirms a pending reservation', async () => {
      reservationModel.findOne.mockResolvedValue(makeReservation());

      const confirmed = await service.confirm('some-id', admin);

      expect(confirmed.status).toBe(ReservationStatus.CONFIRMED);
    });

    it('only confirms pending reservations', async () => {
      reservationModel.findOne.mockResolvedValue(
        makeReservation({ status: ReservationStatus.CANCELLED }),
      );

      await expect(service.confirm('some-id', admin)).rejects.toThrow(
        'Only pending reservations can be confirmed',
      );
    });
  });

  describe('expirePendingReservations', () => {
    it('expires pending reservations whose start time has passed', async () => {
      reservationModel.updateMany.mockResolvedValue({ modifiedCount: 0 });

      await service.expirePendingReservations();

      expect(reservationModel.updateMany).toHaveBeenCalledWith(
        {
          status: ReservationStatus.PENDING,
          startTime: { $lte: new Date('2030-01-01T00:00:00Z') },
        },
        { status: ReservationStatus.EXPIRED },
      );
    });
  });
});
