import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { ResourceType } from '../../common/enums/resource-type.enum';

const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

class OperatingHoursDto {
  @ApiProperty({ example: '08:00' })
  @Matches(TIME_FORMAT, { message: 'openTime must look like 08:00' })
  openTime: string;

  @ApiProperty({ example: '18:00' })
  @Matches(TIME_FORMAT, { message: 'closeTime must look like 18:00' })
  closeTime: string;
}

export class CreateResourceDto {
  @ApiProperty({ example: 'Nile Meeting Room' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Small room with a TV' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ResourceType })
  @IsEnum(ResourceType)
  type: ResourceType;

  @ApiProperty({ example: 8 })
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiProperty({ type: OperatingHoursDto })
  @ValidateNested()
  @Type(() => OperatingHoursDto)
  operatingHours: OperatingHoursDto;
}
