import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import type { RequestWithUser } from '../common/types/request-with-user';

import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueryReservationsDto } from './dto/query-reservations.dto';
import {
  AvailabilityResponseDto,
  ReservationResponseDto,
  ReservationsPageResponseDto,
} from './dto/reservation-response.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Reservations')
@ApiBearerAuth()
@ApiErrorResponse(401, 'Unauthorized')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Post()
  @Roles(Role.CUSTOMER)
  @ApiOperation({
    summary: 'Create a reservation (customer)',
    description:
      'The reservation starts as PENDING until an admin confirms it. It must be in the future, inside the resource operating hours (in APP_TIMEZONE) and not overlap another pending or confirmed reservation.',
  })
  @ApiCreatedResponse({ type: ReservationResponseDto })
  @ApiErrorResponse(
    400,
    'Validation error, invalid dates, outside operating hours or too many attendees',
    'Reservation must be within operating hours (08:00-18:00 UTC)',
  )
  @ApiErrorResponse(
    403,
    'Customers only',
    'You do not have permission to do this',
  )
  @ApiErrorResponse(404, 'Resource not found')
  @ApiErrorResponse(
    409,
    'The time is already booked, or the resource stayed busy with another booking (try again)',
    'The resource is already booked for this time',
  )
  create(@Req() req: RequestWithUser, @Body() dto: CreateReservationDto) {
    return this.reservationsService.create(req.user.userId, dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all reservations (admin)' })
  @ApiOkResponse({ type: ReservationsPageResponseDto })
  @ApiErrorResponse(400, 'Invalid filters', 'from must be before to')
  @ApiErrorResponse(403, 'Admins only', 'You do not have permission to do this')
  findAll(@Query() query: QueryReservationsDto) {
    return this.reservationsService.findAll(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my reservations' })
  @ApiOkResponse({ type: ReservationsPageResponseDto })
  @ApiErrorResponse(400, 'Invalid filters', 'from must be before to')
  findMine(@Req() req: RequestWithUser, @Query() query: QueryReservationsDto) {
    return this.reservationsService.findMine(req.user.userId, query);
  }

  @Get('availability')
  @ApiOperation({
    summary: 'Check if a resource is free for a time range',
  })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  @ApiErrorResponse(
    400,
    'Validation error, invalid dates or outside operating hours',
    'endTime must be after startTime',
  )
  @ApiErrorResponse(404, 'Resource not found')
  checkAvailability(@Query() dto: CheckAvailabilityDto) {
    return this.reservationsService.checkAvailability(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get reservation details',
    description: 'Customers can only get their own reservations.',
  })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiErrorResponse(400, 'Invalid id')
  @ApiErrorResponse(404, 'Reservation not found')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.reservationsService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a reservation',
    description:
      'Only upcoming pending or confirmed reservations can be updated. Changing the time moves the reservation back to PENDING.',
  })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiErrorResponse(
    400,
    'Validation error, invalid dates or reservation can no longer be changed',
    'Reservation is already cancelled',
  )
  @ApiErrorResponse(404, 'Reservation not found')
  @ApiErrorResponse(
    409,
    'The new time is already booked, or the resource stayed busy with another booking (try again)',
    'The resource is already booked for this time',
  )
  update(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(id, req.user, dto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a reservation' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiErrorResponse(
    400,
    'Reservation already started, cancelled or expired',
    'Reservation is already cancelled',
  )
  @ApiErrorResponse(404, 'Reservation not found')
  cancel(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.reservationsService.cancel(id, req.user);
  }

  @Patch(':id/confirm')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Confirm a pending reservation (admin)' })
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiErrorResponse(
    400,
    'Reservation is not pending or already started',
    'Only pending reservations can be confirmed',
  )
  @ApiErrorResponse(403, 'Admins only', 'You do not have permission to do this')
  @ApiErrorResponse(404, 'Reservation not found')
  confirm(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.reservationsService.confirm(id, req.user);
  }
}
