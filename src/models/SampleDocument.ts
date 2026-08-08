import { Schema, models, model, Types } from "mongoose";
import type { DocumentType } from "@/constants/lookups";

export interface ISampleDocument {
  _id: Types.ObjectId;
  recordNo: string;
  taskId: Types.ObjectId;
  supplier?: string;
  recordType: DocumentType | string;
  name: string;
  requestDate?: Date | null;
  expectedDate?: Date | null;
  actualDate?: Date | null;
  status?: string;
  reviewResult?: string;
  fileName?: string;
  fileLink?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SampleDocumentSchema = new Schema<ISampleDocument>(
  {
    recordNo: { type: String, required: true, unique: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    supplier: { type: String, default: "" },
    recordType: { type: String, required: true },
    name: { type: String, required: true },
    requestDate: { type: Date, default: null },
    expectedDate: { type: Date, default: null },
    actualDate: { type: Date, default: null },
    status: { type: String, default: "" },
    reviewResult: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileLink: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

SampleDocumentSchema.index({ taskId: 1 });

export const SampleDocument =
  models.SampleDocument ||
  model<ISampleDocument>("SampleDocument", SampleDocumentSchema);
