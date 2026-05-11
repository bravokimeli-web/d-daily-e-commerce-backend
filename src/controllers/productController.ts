import { Request, Response } from "express";
import { Product } from "../models/Product";
import { z } from "zod";

// ─── Validation schemas ────────────────────────────────────────────────────────

const productSchema = z.object({
  slug: z.string().min(1).toLowerCase(),
  name: z.string().min(1),
  price: z.number().nullable(),
  category: z.enum(["pest-control", "lighting", "home-protection", "farm-protection"]),
  image: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  usage: z.array(z.string()).default([]),
  safety: z.array(z.string()).default([]),
  specs: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  badge: z.string().optional(),
  stock: z.number().int().min(0).default(0),
});

// ─── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/products */
export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, active } = req.query;
    const filter: Record<string, unknown> = {};

    if (category) filter.category = category;
    if (active !== undefined) filter.isActive = active === "true";
    if (search) filter.$text = { $search: search as string };

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
};

/** GET /api/products/:slug */
export const getProductBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true });
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch product" });
  }
};

/** POST /api/products  [admin] */
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.flatten() });
      return;
    }

    const existing = await Product.findOne({ slug: parsed.data.slug });
    if (existing) {
      res.status(409).json({ success: false, message: "A product with this slug already exists" });
      return;
    }

    const product = await Product.create(parsed.data);
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create product" });
  }
};

/** PUT /api/products/:slug  [admin] */
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.flatten() });
      return;
    }

    const product = await Product.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: parsed.data },
      { new: true, runValidators: true }
    );
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update product" });
  }
};

/** DELETE /api/products/:slug  [admin] */
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findOneAndUpdate(
      { slug: req.params.slug },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }
    res.json({ success: true, message: "Product deactivated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete product" });
  }
};
