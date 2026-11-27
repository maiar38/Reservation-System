import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ example: '6750a1c2e8b3e4a2f9c1d2e3' })
  @IsMongoId()
  resourceId: string;

  @ApiProperty({ example: '2026-12-01T09:00:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: 'startTime must be a valid date' })
  startTime: Date;

  @ApiProperty({ example: '2026-12-01T10:30:00.000Z' })
  @Type(() => Date)
  @IsDate({ message: 'endTime must be a valid date' })
  endTime: Date;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  attendees: number;

  @ApiPropertyOptional({ example: 'Weekly team meeting' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
