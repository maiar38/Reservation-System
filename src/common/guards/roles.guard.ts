import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { RequestWithUser } from '../types/request-with-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.get<Role[]>(
      'roles',
      context.getHandler(),
    );

    if (!allowedRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenException('You do not have permission to do this');
    }
    return true;
  }
}
