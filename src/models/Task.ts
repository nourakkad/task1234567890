import { Schema, models, model, Types } from "mongoose";
import type {
  ManagerApproval,
  TaskPriority,
  TaskStatus,
} from "@/constants/lookups";

export interface ITask {
  _id: Types.ObjectId;
  taskNo: string;
  name: string;
  description?: string;
  assignedDate: Date;
  targetDate?: Date | null;
  ownerId: Types.ObjectId;
  departmentId: Types.ObjectId;
  assignedById?: Types.ObjectId | null;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  lastUpdate?: Date | null;
  nextAction?: string;
  nextActionDate?: Date | null;
  managementDecision?: string;
  folderLink?: string;
  closureDate?: Date | null;
  managerApproval: ManagerApproval;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    taskNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    assignedDate: { type: Date, required: true },
    targetDate: { type: Date, default: null },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    assignedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    priority: {
      type: String,
      enum: ["منخفضة", "متوسطة", "عالية", "عاجلة"],
      default: "متوسطة",
    },
    status: {
      type: String,
      enum: [
        "لم تبدأ",
        "قيد التنفيذ",
        "بانتظار المورد",
        "بانتظار قرار الإدارة",
        "معلقة",
        "مكتملة",
        "ملغاة",
      ],
      default: "لم تبدأ",
    },
    progress: { type: Number, default: 0, min: 0, max: 1 },
    lastUpdate: { type: Date, default: null },
    nextAction: { type: String, default: "" },
    nextActionDate: { type: Date, default: null },
    managementDecision: { type: String, default: "" },
    folderLink: { type: String, default: "" },
    closureDate: { type: Date, default: null },
    managerApproval: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

TaskSchema.index({ departmentId: 1, status: 1 });
TaskSchema.index({ ownerId: 1 });

export const Task = models.Task || model<ITask>("Task", TaskSchema);
