import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';

import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
    });

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordIsCorrect = await bcrypt.compare(dto.password, user.password);

    if (!passwordIsCorrect) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account is deactivated');
    }

    return this.createTokens(user);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);

    if (!user || user.refreshTokenHash !== this.hash(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Your account is deactivated');
    }

    return this.createTokens(user);
  }

  async logout(userId: string) {
    await this.usersService.saveRefreshTokenHash(userId, null);
  }

  private async createTokens(user: UserDocument) {
    const userId = user._id.toString();

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, role: user.role },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: Number(this.configService.get('JWT_ACCESS_EXPIRES_IN')),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti: randomUUID() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: Number(this.configService.get('JWT_REFRESH_EXPIRES_IN')),
      },
    );

    await this.usersService.saveRefreshTokenHash(
      userId,
      this.hash(refreshToken),
    );

    return { accessToken, refreshToken };
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
