import { Request, Response, NextFunction } from "express";
import { Product } from "../models/Product";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { UPLOADS_DIR } from "../paths";
import { cacheGetOrSet } from "../utils/cache";

const productUploadsDir = path.join(UPLOADS_DIR, "products");
try {
  if (!fs.existsSync(productUploadsDir)) fs.mkdirSync(productUploadsDir, { recursive: true });
} catch (e) {
  console.error("Could not create product uploads directory:", e);
}

const productImageMulter = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, productUploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, and GIF files are allowed"));
  },
});

/** Multer middleware: field name `image` */
export const uploadProductImage = (req: Request, res: Response, next: NextFunction): void => {
  productImageMulter.single("image")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        success: false,
        message: err.code === "LIMIT_FILE_SIZE" ? "Image too large (max 8MB)" : err.message,
      });
      return;
    }
    if (err) {
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : "Invalid file",
      });
      return;
    }
    next();
  });
};

/** After uploadProductImage — responds with public path stored on Product.image */
export const completeProductImageUpload = (req: Request, res: Response): void => {
  const file = req.file;
  if (!file?.filename) {
    res.status(400).json({ success: false, message: "No image file received" });
    return;
  }
  res.status(201).json({
    success: true,
    data: { url: `/uploads/products/${file.filename}` },
  });
};

// ─── Validation schemas ────────────────────────────────────────────────────────

const productSchema = z.object({
  slug: z.string().min(1).toLowerCase(),
  name: z.string().min(1),
  price: z.number().nullable(),
  originalPrice: z.number().min(0).optional(),
  category: z.enum(["lighting", "home-protection", "farm-protection", "fashion-design"]),
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

    const cacheKey = `products:${JSON.stringify({ category, search, active })}`;
    const products = await cacheGetOrSet(cacheKey, 60, async () => {
      return await Product.find(filter).sort({ createdAt: -1 }).lean();
    });
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
};

/** GET /api/products/:slug */
export const getProductBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = `product:${req.params.slug}`;
    const product = await cacheGetOrSet(cacheKey, 3600, async () => {
      return await Product.findOne({ slug: req.params.slug, isActive: true }).lean();
    });
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
