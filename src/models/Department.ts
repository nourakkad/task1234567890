import { Schema, models, model, Types } from "mongoose";

export interface IDepartment {
  _id: Types.ObjectId;
  name: string;
  managerId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true },
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const Department =
  models.Department || model<IDepartment>("Department", DepartmentSchema);
