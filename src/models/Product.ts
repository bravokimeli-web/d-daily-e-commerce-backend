import mongoose, { Document, Schema } from "mongoose";

export type Category = "lighting" | "home-protection" | "farm-protection" | "fashion-design";

export interface IProduct extends Document {
  slug: string;
  name: string;
  price: number | null;
  originalPrice?: number;
  category: Category;
  image: string; // URL or path
  images?: string[];
  video?: string;
  imageVariants?: {
    thumbnail?: string;
    medium?: string;
    original?: string;
    webp?: string;
  };
  tagline: string;
  description: string;
  usage: string[];
  safety: string[];
  specs: { label: string; value: string }[];
  variants?: { id: string; label: string; price: number; originalPrice?: number }[];
  badge?: string;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, default: null },
    originalPrice: { type: Number, default: null, min: 0 },
    category: {
      type: String,
      required: true,
      enum: ["lighting", "home-protection", "farm-protection", "fashion-design"],
    },
    image: { type: String, required: true },
    images: [{ type: String }],
    video: { type: String },
    imageVariants: {
      thumbnail: { type: String },
      medium: { type: String },
      original: { type: String },
      webp: { type: String },
    },
    tagline: { type: String, required: true },
    description: { type: String, required: true },
    usage: [{ type: String }],
    safety: [{ type: String }],
    specs: [
      {
        label: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    variants: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        originalPrice: { type: Number, min: 0 },
      },
    ],
    badge: { type: String },
    stock: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Index for fast category filtering and text search
ProductSchema.index({ category: 1 });
ProductSchema.index({ name: "text", tagline: "text", description: "text" });

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
