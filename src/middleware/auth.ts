import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AdminPayload {
  id: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPayload;
    }
  }
}

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  // Try JWT token first
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AdminPayload;
      req.admin = payload;
      next();
      return;
    } catch {
      res.status(401).json({ success: false, message: "Invalid or expired token" });
      return;
    }
  }

  // Fallback: Accept hardcoded admin email from header for development
  const adminEmail = req.headers["x-admin-email"] as string;
  if (adminEmail && adminEmail.toLowerCase() === (process.env.ADMIN_EMAIL || "dandailybusiness02@gmail.com").toLowerCase()) {
    req.admin = {
      id: "admin",
      email: adminEmail,
      role: "super_admin",
    };
    next();
    return;
  }

  res.status(401).json({ success: false, message: "No valid authentication provided" });
};
