import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { connectDB } from "./config/db";
import routes from "./routes";
import { UPLOADS_DIR } from "./paths";

const app = express();
const PORT = process.env.PORT ?? 5000;

// ─── Security & logging ────────────────────────────────────────────────────────
// Allow storefront (e.g. Vercel) to display uploaded images from `<img src="https://api…/uploads/…">`.
// Default CORP is same-origin and blocks cross-site embedding of static files.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL ?? "http://localhost:3000",
  "http://localhost:5173", // Vite dev server
  "https://localhost:5173",
  "http://127.0.0.1:5173",
  "https://127.0.0.1:5173",
  // Add production URLs
  "https://d-daily-e-commerce.vercel.app",
  "https://d-daily-e-commerce-git-main-bravokimeli-web.vercel.app",
  // Allow all localhost variations
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow for now to debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-email'],
};

app.use(cors(corsOptions));
app.use('/api', cors(corsOptions));

// ─── Body parsing ──────────────────────────────────────────────────────────────
// Raw body for Paystack webhook signature verification
app.use("/api/webhooks/paystack", express.raw({ type: "application/json" }));
// JSON for everything else
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Static files ──────────────────────────────────────────────────────────────
app.use("/uploads", express.static(UPLOADS_DIR));

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use("/api", (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.path}`, {
    headers: req.headers,
    body: req.body
  });
  next();
});
app.use("/api", routes);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 D-Daily backend running at http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV ?? "development"}`);
  });
};

start();
