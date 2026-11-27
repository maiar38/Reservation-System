import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination-meta.dto';
import { ReservationStatus } from '../../common/enums/reservation-status.enum';

export class ReservationResponseDto {
  @ApiProperty({ example: '6750a1c2e8b3e4a2f9c1d2e4' })
  _id: string;

  @ApiProperty({ example: '6750a1c2e8b3e4a2f9c1d2e1', description: 'User id' })
  customer: string;

  @ApiProperty({
    example: '6750a1c2e8b3e4a2f9c1d2e3',
    description: 'Resource id',
  })
  resource: string;

  @ApiProperty({ example: '2026-12-01T09:00:00.000Z' })
  startTime: Date;

  @ApiProperty({ example: '2026-12-01T10:30:00.000Z' })
  endTime: Date;

  @ApiProperty({ example: 4 })
  attendees: number;

  @ApiProperty({ example: 'Weekly team meeting' })
  notes: string;

  @ApiProperty({
    enum: ReservationStatus,
    example: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  @ApiProperty({ example: '2026-11-27T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-11-27T12:00:00.000Z' })
  updatedAt: Date;
}

export class ReservationsPageResponseDto {
  @ApiProperty({ type: [ReservationResponseDto] })
  data: ReservationResponseDto[];

  @ApiProperty()
  meta: PaginationMetaDto;
}

export class AvailabilityResponseDto {
  @ApiProperty({ example: true })
  available: boolean;
}
