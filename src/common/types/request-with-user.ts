import { Request } from 'express';
import { Role } from '../enums/role.enum';

export interface AuthUser {
  userId: string;
  role: Role;
}

export interface RequestWithUser extends Request {
  user: AuthUser;
}
