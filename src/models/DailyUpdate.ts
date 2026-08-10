import { Schema, models, model, Types } from "mongoose";

export type TimelineEntryType =
  | "update"
  | "gm_order"
  | "gm_decision"
  | "ceo_order"
  | "ceo_decision"
  | "manager_order"
  | "manager_decision";

export interface IDailyUpdate {
  _id: Types.ObjectId;
  updateNo: string;
  taskId: Types.ObjectId;
  date: Date;
  workPerformed: string;
  supplier?: string;
  result?: string;
  issue?: string;
  nextAction?: string;
  expectedDate?: Date | null;
  hours?: number;
  documentLink?: string;
  managerNotes?: string;
  entryType: TimelineEntryType;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DailyUpdateSchema = new Schema<IDailyUpdate>(
  {
    updateNo: { type: String, required: true, unique: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    date: { type: Date, required: true },
    workPerformed: { type: String, required: true },
    supplier: { type: String, default: "" },
    result: { type: String, default: "" },
    issue: { type: String, default: "" },
    nextAction: { type: String, default: "" },
    expectedDate: { type: Date, default: null },
    hours: { type: Number, default: 0 },
    documentLink: { type: String, default: "" },
    managerNotes: { type: String, default: "" },
    entryType: {
      type: String,
      enum: [
        "update",
        "gm_order",
        "gm_decision",
        "ceo_order",
        "ceo_decision",
        "manager_order",
        "manager_decision",
      ],
      default: "update",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

DailyUpdateSchema.index({ taskId: 1, createdAt: -1 });
DailyUpdateSchema.index({ taskId: 1, date: -1 });

export const DailyUpdate =
  models.DailyUpdate || model<IDailyUpdate>("DailyUpdate", DailyUpdateSchema);
