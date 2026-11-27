import { PickType } from '@nestjs/swagger';
import { CreateReservationDto } from './create-reservation.dto';

export class CheckAvailabilityDto extends PickType(CreateReservationDto, [
  'resourceId',
  'startTime',
  'endTime',
] as const) {}
