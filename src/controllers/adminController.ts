import { Request, Response } from "express";
import { Admin } from "../models/Admin";
import jwt from "jsonwebtoken";
import crypto from "crypto";

/** POST /api/admin/login */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and password required" });
      return;
    }

    const admin = await Admin.findOne({ email: email.toLowerCase(), isActive: true });
    if (!admin || !admin.verifyPassword(password)) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" } as jwt.SignOptions
    );

    res.json({
      success: true,
      data: {
        token,
        admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Login failed" });
  }
};

/** POST /api/admin/seed — One-time seed for first super admin (disable in production) */
export const seedAdmin = async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ success: false, message: "Not available in production" });
    return;
  }
  try {
    const existing = await Admin.findOne({ role: "super_admin" });
    if (existing) {
      res.status(409).json({ success: false, message: "Super admin already exists" });
      return;
    }

    const passwordHash = crypto.createHash("sha256").update("Admin@DDailyLtd2024").digest("hex");
    const admin = await Admin.create({
      name: "D-Daily Admin",
      email: "admin@ddaily.co.ke",
      passwordHash,
      role: "super_admin",
    });

    res.status(201).json({
      success: true,
      message: "Super admin created. Change password immediately!",
      data: { email: admin.email, defaultPassword: "Admin@DDailyLtd2024" },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to seed admin" });
  }
};

/** GET /api/admin/me */
export const getAdminProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = await Admin.findById(req.admin?.id).select("-passwordHash");
    if (!admin) {
      res.status(404).json({ success: false, message: "Admin not found" });
      return;
    }
    res.json({ success: true, data: admin });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to get profile" });
  }
};

/** GET /api/admin/dashboard — Stats summary */
export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { Order } = await import("../models/Order");
    const { Product } = await import("../models/Product");
    const { Reseller } = await import("../models/Reseller");

    const [totalOrders, paidOrders, pendingOrders, totalProducts, recentOrders, totalResellers, pendingResellers] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: "paid" }),
      Order.countDocuments({ status: "pending_payment" }),
      Product.countDocuments({ isActive: true }),
      Order.find().sort({ createdAt: -1 }).limit(5).select("orderNumber customer.name total status createdAt"),
      Reseller.countDocuments(),
      Reseller.countDocuments({ status: "pending" }),
    ]);

    const revenueResult = await Order.aggregate([
      { $match: { status: { $in: ["paid", "processing", "shipped", "delivered"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);

    const totalRevenue = revenueResult[0]?.total ?? 0;

    res.json({
      success: true,
      data: {
        orders: { total: totalOrders, paid: paidOrders, pending: pendingOrders },
        products: { total: totalProducts },
        revenue: { total: totalRevenue },
        resellers: { total: totalResellers, pending: pendingResellers },
        recentOrders,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch dashboard stats" });
  }
};
