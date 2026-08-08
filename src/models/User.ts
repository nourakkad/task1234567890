import { Schema, models, model, Types } from "mongoose";
import type { UserRole } from "@/constants/lookups";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  departmentId?: Types.ObjectId | null;
  managerId?: Types.ObjectId | null;
  active: boolean;
  failedLoginCount?: number;
  lockedUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["ceo", "manager", "employee"],
      required: true,
    },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    active: { type: Boolean, default: true },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export const User = models.User || model<IUser>("User", UserSchema);
