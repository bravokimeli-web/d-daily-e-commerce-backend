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
import { requireAdmin } from "../middleware/auth";

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

export default router;
