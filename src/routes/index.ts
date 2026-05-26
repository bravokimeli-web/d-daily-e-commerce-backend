import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getAllProducts,
  getProductBySlug,
  getHomepageProducts,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  completeProductImageUpload,
} from "../controllers/productController";
import {
  createOrder,
  verifyOrder,
  getOrder,
  getAllOrders,
  deleteOrder,
  updateOrderStatus,
  paystackWebhook,
  sendOrderPaymentReminder,
  sendOrderShippedNotification,
  sendOrderDeliveredNotification,
} from "../controllers/orderController";
import {
  adminLogin,
  seedAdmin,
  getAdminProfile,
  getDashboardStats,
} from "../controllers/adminController";
import {
  createResellerApplication,
  getResellerApplicationStatus,
  getAllResellers,
  getResellerById,
  updateResellerStatus,
  deleteReseller,
  upload,
} from "../controllers/resellerController";
import { requireAdmin } from "../middleware/auth";
import multer from "multer";
import { redis } from "../lib/redis";
import { Product } from "../models/Product";


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts, please try again later" },
});

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many orders submitted, please wait a moment" },
});

const router = Router();

// ─── Health ────────────────────────────────────────────────────────────────────
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

router.get("/health/full", async (_req, res) => {
  const checks: Record<string, any> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    upstash: "unchecked",
  };

  try {
    const testKey = "health_check_key";
    await redis.set(testKey, "ok", { ex: 30 });
    const val = await redis.get(testKey);
    checks.upstash = val ? "connected" : "failed";
  } catch (err) {
    checks.upstash = "failed";
    checks.status = "degraded";
  }

  res.status(checks.status === "ok" ? 200 : 503).json(checks);
});

// ─── Test endpoint ─────────────────────────────────────────────────────────────
router.post("/test", (req, res) => {
  console.log("Test endpoint hit:", req.body);
  res.json({ success: true, message: "Test successful", body: req.body });
});

router.get("/debug", (req, res) => {
  res.json({ 
    message: "Debug endpoint", 
    method: req.method, 
    path: req.path,
    url: req.url,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// Debug cache test: sets a timestamped key and returns previous value (if any)
router.get("/debug/cache-test", async (req, res) => {
  try {
    const key = "ddaily_cache_test_key";
    const prev = await redis.get(key);
    await redis.set(key, new Date().toISOString(), { ex: 120 });
    res.json({ success: true, key, previous: prev ?? null, now: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, message: "Cache test failed", error: String(err) });
  }
});

// ─── Products (public) ─────────────────────────────────────────────────────────
router.get("/products", getAllProducts);
router.get("/products/:slug", getProductBySlug);
router.get("/homepage-products", getHomepageProducts);
router.get("/categories", getCategories);

// ─── Structured Data (JSON-LD) ────────────────────────────────────────────────
router.get("/products/:slug/schema", async (req, res) => {
  try {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
    const product = await Product.findOne({ slug, isActive: true });
    
    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    const schema = {
      "@context": "https://schema.org/",
      "@type": "Product",
      name: product.name,
      image: product.imageVariants?.webp || product.imageVariants?.original || product.image,
      description: product.description,
      brand: {
        "@type": "Brand",
        name: "D-Daily Ltd",
      },
      offers: {
        "@type": "Offer",
        url: `${process.env.FRONTEND_URL?.replace(/\/$/, "") || "https://d-daily-frontend.vercel.app"}/product/${product.slug}`,
        priceCurrency: "KES",
        price: product.price || "0",
        availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        seller: {
          "@type": "Organization",
          name: "D-Daily Ltd",
        },
      },
      category: product.category,
      ...(product.specs && {
        additionalProperty: product.specs.map((spec: any) => ({
          "@type": "PropertyValue",
          name: spec.label,
          value: spec.value,
        })),
      }),
    };

    res.json(schema);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch product schema" });
  }
});

// ─── Products (admin) ─────────────────────────────────────────────────────────
router.post(
  "/admin/products/upload",
  requireAdmin,
  uploadProductImage,
  completeProductImageUpload
);
router.post("/admin/products", requireAdmin, createProduct);
router.put("/admin/products/:slug", requireAdmin, updateProduct);
router.delete("/admin/products/:slug", requireAdmin, deleteProduct);

// ─── Orders (public) ──────────────────────────────────────────────────────────
router.post("/orders", orderLimiter, createOrder);
router.get("/orders/verify/:reference", verifyOrder);
router.get("/orders/:orderNumber", getOrder);

// ─── Orders (admin) ───────────────────────────────────────────────────────────
router.get("/admin/orders", requireAdmin, getAllOrders);
router.delete("/admin/orders/:orderNumber", requireAdmin, deleteOrder);
router.patch("/admin/orders/:orderNumber/status", requireAdmin, updateOrderStatus);
router.post("/admin/orders/:orderNumber/email/payment-reminder", requireAdmin, sendOrderPaymentReminder);
router.post("/admin/orders/:orderNumber/email/shipped", requireAdmin, sendOrderShippedNotification);
router.post("/admin/orders/:orderNumber/email/delivered", requireAdmin, sendOrderDeliveredNotification);

// ─── Paystack webhook (raw body, no auth — Paystack signs its own requests) ───
router.post("/webhooks/paystack", paystackWebhook);

// ─── Admin auth ───────────────────────────────────────────────────────────────
router.post("/admin/login", loginLimiter, adminLogin);
router.post("/admin/seed", seedAdmin); // disabled in production
router.get("/admin/me", requireAdmin, getAdminProfile);
router.get("/admin/dashboard", requireAdmin, getDashboardStats);

// ─── Reseller (public) ────────────────────────────────────────────────────────
router.get("/reseller/track", getResellerApplicationStatus);

router.post(
  "/reseller/apply-simple",
  (req, res) => {
    console.log("Simple reseller endpoint hit:", req.body);
    res.json({
      success: true,
      message: "Simple application received",
      data: req.body
    });
  }
);

router.post(
  "/reseller/apply",
  (req, res, next) => {
    console.log("Multer middleware hit for reseller application");
    const uploadHandler = upload.fields([
      { name: "id_front", maxCount: 1 },
      { name: "id_back", maxCount: 1 },
      { name: "kra_pin", maxCount: 1 },
      { name: "additional", maxCount: 1 },
    ]);

    uploadHandler(req, res, (err) => {
      console.log("Multer processing complete", { error: !!err, files: !!req.files });
      if (err instanceof multer.MulterError) {
        console.log("Multer error:", err.code, err.message);
        // Multer error (file too large, etc.)
        return res.status(400).json({
          success: false,
          message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5MB)' : 'File upload error'
        });
      } else if (err) {
        console.log("Custom multer error:", err.message);
        // Custom error (invalid file type, etc.)
        return res.status(400).json({
          success: false,
          message: err.message || 'Invalid file'
        });
      }
      next();
    });
  },
  createResellerApplication
);

// ─── Reseller (admin) ────────────────────────────────────────────────────────
router.get("/admin/resellers", requireAdmin, getAllResellers);
router.get("/admin/resellers/:id", requireAdmin, getResellerById);
router.patch("/admin/resellers/:id/status", requireAdmin, updateResellerStatus);
router.delete("/admin/resellers/:id", requireAdmin, deleteReseller);

// ─── Catch-all for debugging ──────────────────────────────────────────────────
// Temporarily removed to fix deployment issue
// router.use("*", (req, res) => {
//   console.log(`Catch-all: ${req.method} ${req.originalUrl}`);
//   res.status(404).json({
//     error: "Route not found",
//     method: req.method,
//     path: req.path,
//     originalUrl: req.originalUrl
//   });
// });

export default router;
