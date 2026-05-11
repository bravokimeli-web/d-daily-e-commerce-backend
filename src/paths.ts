import path from "path";

/**
 * Absolute path to `public/uploads` for both `ts-node-dev` (`src/`) and `node dist/` (`dist/`).
 * Do not use `process.cwd()` for uploads — it breaks when the process is started from another directory.
 */
export const UPLOADS_DIR = path.join(__dirname, "..", "public", "uploads");
