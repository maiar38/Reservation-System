import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import type { RequestWithUser } from '../common/types/request-with-user';

import { CreateResourceDto } from './dto/create-resource.dto';
import { QueryResourcesDto } from './dto/query-resources.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourcesService } from './resources.service';

@ApiTags('Resources')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resources')
export class ResourcesController {
  constructor(private resourcesService: ResourcesService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a resource (admin)' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Admins only' })
  @ApiResponse({ status: 409, description: 'Name already exists' })
  create(@Body() dto: CreateResourceDto) {
    return this.resourcesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get, search and filter resources' })
  findAll(@Query() query: QueryResourcesDto, @Req() req: RequestWithUser) {
    return this.resourcesService.findAll(query, req.user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resource details' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.resourcesService.findOne(id, req.user.role);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a resource (admin)' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourcesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a resource (admin)' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }
}
