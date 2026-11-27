import { Request } from 'express';
import { Role } from '../enums/role.enum';

export interface RequestWithUser extends Request {
  user: { userId: string; role: Role };
}
