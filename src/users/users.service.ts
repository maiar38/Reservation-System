import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Role } from '../common/enums/role.enum';
import { escapeRegex } from '../common/utils/escape-regex';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

import { User } from './schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(data: {
    name: string;
    email: string;
    password: string;
    role?: Role;
  }) {
    return this.userModel.create(data);
  }

  async findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password');
  }

  async findById(id: string) {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findActiveById(id: string) {
    return this.userModel.findOne({ _id: id, isActive: true });
  }

  async findByIdWithRefreshToken(id: string) {
    return this.userModel.findById(id).select('+refreshTokenHash');
  }

  async saveRefreshTokenHash(id: string, hash: string | null) {
    await this.userModel.updateOne({ _id: id }, { refreshTokenHash: hash });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.userModel.findByIdAndUpdate(id, dto, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // Get all users with pagination and search
  async findAll(query: PaginationQueryDto) {
    const { page, limit, search } = query;

    const filter = search
      ? {
          $or: [
            { name: new RegExp(escapeRegex(search), 'i') },
            { email: new RegExp(escapeRegex(search), 'i') },
          ],
        }
      : {};

    const users = await this.userModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await this.userModel.countDocuments(filter);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Activate or deactivate a user
  async updateStatus(adminId: string, userId: string, isActive: boolean) {
    if (adminId === userId && !isActive) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    const update = isActive
      ? { isActive }
      : { isActive, refreshTokenHash: null };

    const user = await this.userModel.findByIdAndUpdate(userId, update, {
      new: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
