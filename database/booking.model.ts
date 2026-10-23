import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";

import { Event } from "./event.model";

export interface IBooking {
  eventId: Types.ObjectId;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const bookingSchema = new Schema<IBooking>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_PATTERN, "Invalid email address"],
    },
  },
  { timestamps: true }
);

// Speed up lookups of bookings for a given event.
bookingSchema.index({ eventId: 1 });

bookingSchema.pre("save", async function (this: HydratedDocument<IBooking>) {
  const email = this.email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("Invalid email address");
  }

  this.email = email;

  // Keep bookings attached to a real Event document, not a dangling ObjectId.
  const eventExists = await Event.exists({ _id: this.eventId });

  if (!eventExists) {
    throw new Error(`Event not found for eventId ${String(this.eventId)}`);
  }
});

export const Booking: Model<IBooking> =
  (mongoose.models.Booking as Model<IBooking> | undefined) ??
  mongoose.model<IBooking>("Booking", bookingSchema);
