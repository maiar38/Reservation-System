import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'customer.a@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Passw0rd123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
