import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateReservationDto } from './create-reservation.dto';

// The resource can't be changed; cancel and book a new reservation instead
export class UpdateReservationDto extends PartialType(
  OmitType(CreateReservationDto, ['resourceId'] as const),
) {}
