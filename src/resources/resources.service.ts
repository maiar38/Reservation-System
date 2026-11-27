import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import { Role } from '../common/enums/role.enum';
import { escapeRegex } from '../common/utils/escape-regex';

import { CreateResourceDto } from './dto/create-resource.dto';
import { QueryResourcesDto } from './dto/query-resources.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { Resource } from './schemas/resource.schema';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectModel(Resource.name)
    private resourceModel: Model<Resource>,
  ) {}

  async create(dto: CreateResourceDto) {
    this.checkOperatingHours(dto.operatingHours);
    return this.resourceModel.create(dto);
  }

  async findAll(query: QueryResourcesDto, role: Role) {
    const { page, limit, search, type, minCapacity } = query;

    const filter: FilterQuery<Resource> = {};

    if (role !== Role.ADMIN) {
      filter.isActive = true;
    }

    if (type) {
      filter.type = type;
    }

    if (minCapacity) {
      filter.capacity = { $gte: minCapacity };
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');

      filter.$or = [{ name: regex }, { description: regex }];
    }

    const resources = await this.resourceModel
      .find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await this.resourceModel.countDocuments(filter);

    return {
      data: resources,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, role: Role) {
    const resource = await this.resourceModel.findById(id);

    if (!resource || (role !== Role.ADMIN && !resource.isActive)) {
      throw new NotFoundException('Resource not found');
    }

    return resource;
  }

  async update(id: string, dto: UpdateResourceDto) {
    if (dto.operatingHours) {
      this.checkOperatingHours(dto.operatingHours);
    }

    const resource = await this.resourceModel.findByIdAndUpdate(id, dto, {
      new: true,
      runValidators: true,
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    return resource;
  }
    // Soft delete a resource by setting isActive to false
  async remove(id: string) {
    const resource = await this.resourceModel.findByIdAndUpdate(id, {
      isActive: false,
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }
  }

    
  private checkOperatingHours(hours: { openTime: string; closeTime: string }) {
    // This comparison relies on the HH:mm format, where string ordering matches chronological ordering.
    
    if (hours.closeTime <= hours.openTime) {
      throw new BadRequestException('closeTime must be later than openTime');
    }
  }
}
