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
app.set("trust proxy", 1);

// ─── Security & logging ────────────────────────────────────────────────────────
// Allow storefront (e.g. Vercel) to display uploaded images from `<img src="https://api…/uploads/…">`.
// Default CORP is same-origin and blocks cross-site embedding of static files.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

morgan.token("auth", (req) => {
  const auth = req.headers.authorization;
  return auth ? "[REDACTED]" : "-";
});

const morganFormat =
  process.env.NODE_ENV === "production"
    ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :auth'
    : "dev";

app.use(morgan(morganFormat));

// ─── CORS ──────────────────────────────────────────────────────────────────────
const defaultOrigins = [
  process.env.FRONTEND_URL ?? "http://localhost:3000",
  "http://localhost:5173",
  "https://localhost:5173",
  "http://127.0.0.1:5173",
  "https://127.0.0.1:5173",
];

const allowedOrigins = [
  ...defaultOrigins,
  ...(process.env.ALLOWED_ORIGINS?.split(",").map((url) => url.trim()).filter(Boolean) ?? []),
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true); // Allow requests with no origin (like curl, mobile apps)

    const isAllowed = allowedOrigins.some((allowed) => allowed === origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS warning: Origin not in allowlist: ${origin}. Allowlist: ${allowedOrigins.join(", ")}`);
      // For development, allow unmatched origins but log them
      if (process.env.NODE_ENV === "development") {
        callback(null, true);
      } else {
        callback(null, false); // Block in production (don't throw error, just deny)
      }
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// ─── Body parsing ──────────────────────────────────────────────────────────────
// Raw body for Paystack webhook signature verification
app.use("/api/webhooks/paystack", express.raw({ type: "application/json", limit: "1mb" }));
// JSON for everything else
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─── Static files ──────────────────────────────────────────────────────────────────
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    immutable: true,
    maxAge: 604800000,
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
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
