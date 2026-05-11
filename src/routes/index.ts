import { Router } from "express";
import {
  getAllProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController";
import {
  createOrder,
  verifyOrder,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  paystackWebhook,
} from "../controllers/orderController";
import {
  adminLogin,
  seedAdmin,
  getAdminProfile,
  getDashboardStats,
} from "../controllers/adminController";
import {
  createResellerApplication,
  getAllResellers,
  getResellerById,
  updateResellerStatus,
  upload,
} from "../controllers/resellerController";
import { requireAdmin } from "../middleware/auth";
import multer from "multer";

const router = Router();

// ─── Health ────────────────────────────────────────────────────────────────────
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Products (public) ─────────────────────────────────────────────────────────
router.get("/products", getAllProducts);
router.get("/products/:slug", getProductBySlug);

// ─── Products (admin) ─────────────────────────────────────────────────────────
router.post("/admin/products", requireAdmin, createProduct);
router.put("/admin/products/:slug", requireAdmin, updateProduct);
router.delete("/admin/products/:slug", requireAdmin, deleteProduct);

// ─── Orders (public) ──────────────────────────────────────────────────────────
router.post("/orders", createOrder);
router.get("/orders/verify/:reference", verifyOrder);
router.get("/orders/:orderNumber", getOrder);

// ─── Orders (admin) ───────────────────────────────────────────────────────────
router.get("/admin/orders", requireAdmin, getAllOrders);
router.patch("/admin/orders/:orderNumber/status", requireAdmin, updateOrderStatus);

// ─── Paystack webhook (raw body, no auth — Paystack signs its own requests) ───
router.post("/webhooks/paystack", paystackWebhook);

// ─── Admin auth ───────────────────────────────────────────────────────────────
router.post("/admin/login", adminLogin);
router.post("/admin/seed", seedAdmin); // disabled in production
router.get("/admin/me", requireAdmin, getAdminProfile);
router.get("/admin/dashboard", requireAdmin, getDashboardStats);

// ─── Reseller (public) ────────────────────────────────────────────────────────
router.post(
  "/reseller/apply",
  (req, res, next) => {
    const uploadHandler = upload.fields([
      { name: "id_front", maxCount: 1 },
      { name: "id_back", maxCount: 1 },
      { name: "kra_pin", maxCount: 1 },
      { name: "additional", maxCount: 1 },
    ]);

    uploadHandler(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer error (file too large, etc.)
        return res.status(400).json({
          success: false,
          message: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 5MB)' : 'File upload error'
        });
      } else if (err) {
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

export default router;
