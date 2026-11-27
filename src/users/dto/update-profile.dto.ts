import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Sara A. Ahmed' })
  @IsOptional()
  @IsString()
  @Length(2, 50)
  name?: string;
}
