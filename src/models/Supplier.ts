import { Schema, models, model, Types } from "mongoose";
import type { SampleStatus, SupplierDecision } from "@/constants/lookups";

export interface ISupplier {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  wechat?: string;
  address?: string;
  product?: string;
  price?: number | null;
  currency?: string;
  moq?: string;
  leadTime?: string;
  paymentTerms?: string;
  sampleStatus?: SampleStatus | string;
  rating?: number | null;
  decision?: SupplierDecision | string;
  reason?: string;
  fileLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    name: { type: String, required: true },
    contactName: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    wechat: { type: String, default: "" },
    address: { type: String, default: "" },
    product: { type: String, default: "" },
    price: { type: Number, default: null },
    currency: { type: String, default: "RMB" },
    moq: { type: String, default: "" },
    leadTime: { type: String, default: "" },
    paymentTerms: { type: String, default: "" },
    sampleStatus: { type: String, default: "لم تطلب" },
    rating: { type: Number, default: null, min: 0, max: 10 },
    decision: { type: String, default: "قيد التقييم" },
    reason: { type: String, default: "" },
    fileLink: { type: String, default: "" },
  },
  { timestamps: true }
);

SupplierSchema.index({ taskId: 1 });

export const Supplier =
  models.Supplier || model<ISupplier>("Supplier", SupplierSchema);
