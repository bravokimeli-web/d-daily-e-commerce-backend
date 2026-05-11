import mongoose, { Document, Schema } from "mongoose";

export interface IReseller extends Document {
  full_name: string;
  phone: string;
  email: string;
  documents: {
    id_front?: string; // URL or file path
    id_back?: string;
    kra_pin?: string;
    additional?: string;
  };
  status: "pending" | "approved" | "rejected";
  appliedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string; // Admin ID
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ResellerSchema = new Schema<IReseller>(
  {
    full_name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    documents: {
      id_front: { type: String },
      id_back: { type: String },
      kra_pin: { type: String },
      additional: { type: String },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    appliedAt: { type: Date, default: () => new Date() },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

// Index for quick lookups
ResellerSchema.index({ email: 1 });
ResellerSchema.index({ status: 1 });
ResellerSchema.index({ appliedAt: -1 });

export const Reseller = mongoose.model<IReseller>("Reseller", ResellerSchema);
