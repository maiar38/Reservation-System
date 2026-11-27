import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ReservationStatus } from '../../common/enums/reservation-status.enum';
import { Resource } from '../../resources/schemas/resource.schema';
import { User } from '../../users/schemas/user.schema';

export type ReservationDocument = HydratedDocument<Reservation>;

@Schema({ timestamps: true, versionKey: false })
export class Reservation {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  customer: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Resource.name, required: true })
  resource: Types.ObjectId;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop({ required: true, min: 1 })
  attendees: number;

  @Prop({ default: '', trim: true, maxlength: 500 })
  notes: string;

  @Prop({
    type: String,
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;
}

export const ReservationSchema = SchemaFactory.createForClass(Reservation);
// Conflict checks: active reservations of one resource around a time
ReservationSchema.index({ resource: 1, status: 1, startTime: 1 });
// "My reservations" list
ReservationSchema.index({ customer: 1, startTime: -1 });
// Admin status filter and the job that expires pending reservations
ReservationSchema.index({ status: 1, startTime: 1 });
