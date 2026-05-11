import mongoose, { Document, Schema } from "mongoose";
import crypto from "crypto";

export interface IAdmin extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: "super_admin" | "admin";
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  verifyPassword(password: string): boolean;
}

const AdminSchema = new Schema<IAdmin>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["super_admin", "admin"], default: "admin" },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

// Simple SHA-256 hashing (use bcrypt in production)
AdminSchema.methods.verifyPassword = function (password: string): boolean {
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  return hash === this.passwordHash;
};

AdminSchema.statics.hashPassword = (password: string): string => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

export const Admin = mongoose.model<IAdmin>("Admin", AdminSchema);
