import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Sara Ahmed' })
  @IsString()
  @Length(2, 50)
  name: string;

  @ApiProperty({ example: 'sara@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Passw0rd123' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}
