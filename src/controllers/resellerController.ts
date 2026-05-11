import { Request, Response } from "express";
import { Reseller } from "../models/Reseller";
import multer, { Multer } from "multer";
import path from "path";
import fs from "fs";
import { UPLOADS_DIR } from "../paths";

// Configure multer for file uploads (must match `express.static` for `/uploads`)
const uploadDir = path.join(UPLOADS_DIR, "reseller-docs");

// Ensure upload directory exists
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("Created upload directory:", uploadDir);
  }
} catch (err) {
  console.error("Failed to create upload directory:", err);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Ensure directory exists before each upload
      try {
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      } catch (err) {
        console.error("Error ensuring upload directory:", err);
        cb(err as Error, uploadDir);
      }
    },
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and PDF files are allowed"));
    }
  },
});

/** GET /api/reseller/track?email= — public status lookup (no documents or phone) */
export const getResellerApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = (req.query.email as string)?.trim().toLowerCase();
    if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      res.status(400).json({ success: false, message: "Enter a valid email address" });
      return;
    }

    const reseller = await Reseller.findOne({ email: raw }).select(
      "full_name status appliedAt reviewedAt"
    );
    if (!reseller) {
      res.status(404).json({
        success: false,
        message:
          "No application found for this email. Check the spelling, or use the same address you applied with.",
      });
      return;
    }

    const message =
      reseller.status === "pending"
        ? "Your application is being reviewed. We typically respond within 2 business days."
        : reseller.status === "approved"
          ? "Your application has been approved. Our team will contact you with next steps."
          : "Your application was not approved at this time. If you have questions, reach out through our contact page.";

    res.json({
      success: true,
      data: {
        full_name: reseller.full_name,
        status: reseller.status,
        applied_at: reseller.appliedAt,
        reviewed_at: reseller.reviewedAt ?? null,
        message,
      },
    });
  } catch (err) {
    console.error("Reseller track error:", err);
    res.status(500).json({ success: false, message: "Unable to look up your application. Try again later." });
  }
};

/** POST /api/reseller/apply */
export const createResellerApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("Reseller application request received:", { body: req.body, files: !!req.files });

    const { full_name, phone, email } = req.body;

    if (!full_name || !phone || !email) {
      console.log("Missing required fields");
      res.status(400).json({
        success: false,
        message: "Full name, phone, and email are required",
      });
      return;
    }

    // Check if email already applied
    const existing = await Reseller.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log("Email already exists:", email);
      res.status(409).json({
        success: false,
        message: "This email has already applied",
      });
      return;
    }

    // Build document paths from uploaded files
    const documents: any = {};
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files && typeof files === "object") {
      Object.entries(files).forEach(([fieldName, fileArray]) => {
        if (Array.isArray(fileArray) && fileArray.length > 0) {
          documents[fieldName] = `/uploads/reseller-docs/${fileArray[0].filename}`;
        }
      });
    }

    console.log("Creating reseller with documents:", documents);

    const reseller = await Reseller.create({
      full_name: full_name.trim(),
      phone: phone.trim(),
      email: email.toLowerCase().trim(),
      documents,
      status: "pending",
    });

    console.log("Reseller created successfully:", reseller._id);

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: reseller,
    });
  } catch (err) {
    console.error("Reseller application error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create application",
    });
  }
};

/** GET /api/admin/resellers */
export const getAllResellers = async (
  req: Request & { admin?: any },
  res: Response
): Promise<void> => {
  try {
    const { status, sortBy = "-appliedAt" } = req.query;

    const filter: any = {};
    if (status && status !== "all") {
      filter.status = status;
    }

    const resellers = await Reseller.find(filter).sort(sortBy as string);

    res.json({
      success: true,
      data: resellers,
    });
  } catch (err) {
    console.error("Get resellers error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch resellers",
    });
  }
};

/** GET /api/admin/resellers/:id */
export const getResellerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const reseller = await Reseller.findById(req.params.id);
    if (!reseller) {
      res.status(404).json({
        success: false,
        message: "Reseller not found",
      });
      return;
    }
    res.json({ success: true, data: reseller });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch reseller",
    });
  }
};

/** PATCH /api/admin/resellers/:id/status */
export const updateResellerStatus = async (
  req: Request & { admin?: any },
  res: Response
): Promise<void> => {
  try {
    const { status, notes } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      res.status(400).json({
        success: false,
        message: "Invalid status",
      });
      return;
    }

    const reseller = await Reseller.findByIdAndUpdate(
      req.params.id,
      {
        status,
        notes: notes || undefined,
        reviewedAt: new Date(),
        reviewedBy: req.admin?.id,
      },
      { new: true }
    );

    if (!reseller) {
      res.status(404).json({
        success: false,
        message: "Reseller not found",
      });
      return;
    }

    res.json({
      success: true,
      message: `Reseller marked as ${status}`,
      data: reseller,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update reseller",
    });
  }
};

/** DELETE /api/admin/resellers/:id — removes application and uploaded files */
export const deleteReseller = async (req: Request, res: Response): Promise<void> => {
  try {
    const reseller = await Reseller.findById(req.params.id);
    if (!reseller) {
      res.status(404).json({ success: false, message: "Reseller not found" });
      return;
    }

    const docs = reseller.documents as Record<string, string> | undefined;
    if (docs && typeof docs === "object") {
      for (const rel of Object.values(docs)) {
        if (!rel || typeof rel !== "string" || !rel.includes("reseller-docs")) continue;
        const fname = path.basename(rel);
        const fp = path.join(uploadDir, fname);
        try {
          await fs.promises.unlink(fp);
        } catch {
          /* missing file is fine */
        }
      }
    }

    await Reseller.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Application deleted" });
  } catch (err) {
    console.error("Delete reseller error:", err);
    res.status(500).json({ success: false, message: "Failed to delete application" });
  }
};

export { upload };
