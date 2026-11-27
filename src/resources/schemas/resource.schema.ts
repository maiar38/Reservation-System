import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ResourceType } from '../../common/enums/resource-type.enum';

@Schema({ _id: false })
export class OperatingHours {
  @Prop({ required: true })
  openTime: string;

  @Prop({ required: true })
  closeTime: string;
}

@Schema({ timestamps: true, versionKey: false })
export class Resource {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: String, enum: ResourceType, required: true })
  type: ResourceType;

  @Prop({ required: true, min: 1 })
  capacity: number;

  @Prop({ type: SchemaFactory.createForClass(OperatingHours), required: true })
  operatingHours: OperatingHours;

  @Prop({ default: true })
  isActive: boolean;
}

export const ResourceSchema = SchemaFactory.createForClass(Resource);
ResourceSchema.index({ isActive: 1, type: 1, capacity: 1 });
