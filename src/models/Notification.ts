import { Schema, models, model, Types } from "mongoose";

export const NOTIFICATION_TYPES = [
  "task_assigned",
  "task_update",
  "awaiting_decision",
  "decision_made",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: NotificationType;
  taskId?: Types.ObjectId | null;
  actorId?: Types.ObjectId | null;
  title: string;
  body?: string;
  href?: string;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    href: { type: String, default: "" },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const Notification =
  models.Notification ||
  model<INotification>("Notification", NotificationSchema);
