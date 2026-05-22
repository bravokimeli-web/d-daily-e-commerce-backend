import { Request, Response, NextFunction } from "express";
import { Product } from "../models/Product";
import { z } from "zod";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cacheGetOrSet, cacheInvalidateProduct, cacheInvalidateProducts } from "../utils/cache";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const cloudApiKey = process.env.CLOUDINARY_API_KEY;
const cloudApiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !cloudApiKey || !cloudApiSecret) {
  console.warn("Cloudinary config is incomplete. Product image uploads will fail until CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set.");
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: cloudApiKey,
  api_secret: cloudApiSecret,
});

const productImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "d-daily/products",
    format: "auto",
    public_id: (req: Express.Request, file: Express.Multer.File) => `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
  } as any,
});

const productImageMulter = multer({
  storage: productImageStorage,
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
export const completeProductImageUpload = async (req: Request, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File & { path?: string; filename?: string };
  if (!file?.path || !file?.filename) {
    res.status(400).json({ success: false, message: "No image file received" });
    return;
  }

  try {
    const publicId = file.filename;
    const secureUrl = file.path;

    const variants = {
      thumbnail: cloudinary.url(publicId, {
        width: 150,
        height: 150,
        crop: "fill",
        quality: "auto",
        fetch_format: "auto",
      }),
      medium: cloudinary.url(publicId, {
        width: 400,
        height: 400,
        crop: "fill",
        quality: "auto",
        fetch_format: "auto",
      }),
      original: cloudinary.url(publicId, {
        quality: "auto",
        fetch_format: "auto",
      }),
      webp: cloudinary.url(publicId, {
        quality: "auto",
        fetch_format: "auto",
        format: "webp",
      }),
    };

    res.status(201).json({
      success: true,
      data: {
        url: secureUrl,
        variants,
      },
    });
  } catch (err) {
    console.error("Cloudinary upload response failed:", err);
    res.status(500).json({ success: false, message: "Failed to process uploaded image" });
  }
};

// ─── Validation schemas ────────────────────────────────────────────────────────

const productSchema = z.object({
  slug: z.string().min(1).toLowerCase(),
  name: z.string().min(1),
  price: z.number().nullable(),
  originalPrice: z.number().min(0).optional(),
  category: z.enum(["lighting", "home-protection", "farm-protection", "fashion-design"]),
  image: z.string().min(1),
  imageVariants: z.object({
    thumbnail: z.string().optional(),
    medium: z.string().optional(),
    original: z.string().optional(),
    webp: z.string().optional(),
  }).optional(),
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

export const getHomepageProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = "homepage_products";
    const products = await cacheGetOrSet(cacheKey, 3600, async () => {
      return await Product.find({ featured: true, isActive: true })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    });
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch homepage products" });
  }
};

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = "categories";
    const categories = await cacheGetOrSet(cacheKey, 86400, async () => {
      return await Product.distinct("category", { isActive: true });
    });
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch categories" });
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
    await cacheInvalidateProducts();
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create product" });
  }
};

/** PUT /api/products/:slug  [admin] */
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, errors: parsed.error.flatten() });
      return;
    }

    const product = await Product.findOneAndUpdate(
      { slug },
      { $set: parsed.data },
      { new: true, runValidators: true }
    );
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }
    await cacheInvalidateProduct(slug);
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update product" });
  }
};

/** DELETE /api/products/:slug  [admin] */
export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
    const product = await Product.findOneAndUpdate(
      { slug },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }
    await cacheInvalidateProduct(slug);
    res.json({ success: true, message: "Product deactivated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete product" });
  }
};
