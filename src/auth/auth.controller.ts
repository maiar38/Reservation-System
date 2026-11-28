import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponse } from '../common/decorators/api-error-response.decorator';
import type { RequestWithUser } from '../common/types/request-with-user';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  RegisterResponseDto,
  TokensResponseDto,
} from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer' })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiErrorResponse(400, 'Validation error', ['email must be an email'])
  @ApiErrorResponse(409, 'Email already exists', 'email already exists')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in' })
  @ApiOkResponse({ type: TokensResponseDto })
  @ApiErrorResponse(400, 'Validation error', ['email must be an email'])
  @ApiErrorResponse(401, 'Invalid email or password')
  @ApiErrorResponse(403, 'Account deactivated', 'Your account is deactivated')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get new tokens with a refresh token' })
  @ApiOkResponse({ type: TokensResponseDto })
  @ApiErrorResponse(400, 'Validation error', [
    'refreshToken must be a jwt string',
  ])
  @ApiErrorResponse(
    401,
    'Invalid or already used refresh token',
    'Invalid refresh token',
  )
  @ApiErrorResponse(403, 'Account deactivated', 'Your account is deactivated')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out' })
  @ApiNoContentResponse({ description: 'Logged out' })
  @ApiErrorResponse(401, 'Unauthorized')
  logout(@Req() req: RequestWithUser) {
    return this.authService.logout(req.user.userId);
  }
}
