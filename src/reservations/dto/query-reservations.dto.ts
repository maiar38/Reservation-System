import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ReservationStatus } from '../../common/enums/reservation-status.enum';

export class QueryReservationsDto extends OmitType(PaginationQueryDto, [
  'search',
] as const) {
  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional({
    example: '2026-12-01T00:00:00.000Z',
    description: 'Only reservations that start at or after this time',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'from must be a valid date' })
  from?: Date;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Only reservations that start at or before this time',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'to must be a valid date' })
  to?: Date;
}
