import sharp from "sharp";
import path from "path";
import fs from "fs";
import { promisify } from "util";

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export interface OptimizedImageResult {
  original: string;
  thumbnail: string;
  medium: string;
  webp: string;
}

/**
 * Optimize an image by:
 * 1. Creating multiple sizes (thumbnail, medium, full)
 * 2. Generating WebP versions
 * 3. Compressing JPEG/PNG
 *
 * Returns object with paths to all optimized versions
 */
export async function optimizeProductImage(
  inputPath: string,
  outputDir: string,
  baseFilename: string
): Promise<OptimizedImageResult> {
  try {
    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });

    const ext = path.extname(baseFilename).toLowerCase();
    const nameWithoutExt = path.basename(baseFilename, ext);

    // Original (JPEG/PNG compressed)
    const originalPath = path.join(outputDir, `${nameWithoutExt}-original${ext}`);
    // Thumbnail (150px)
    const thumbnailPath = path.join(outputDir, `${nameWithoutExt}-thumb.jpg`);
    // Medium (400px)
    const mediumPath = path.join(outputDir, `${nameWithoutExt}-medium.jpg`);
    // WebP (full size)
    const webpPath = path.join(outputDir, `${nameWithoutExt}.webp`);

    const image = sharp(inputPath);
    const metadata = await image.metadata();

    if (!metadata) throw new Error("Could not read image metadata");

    // Original: compress JPEG/PNG
    await image
      .resize(Math.min(metadata.width || 1200, 1200), undefined, {
        withoutEnlargement: true,
        fit: "inside",
      })
      .jpeg({ quality: 85, progressive: true })
      .toFile(originalPath);

    // Thumbnail: 150px
    await sharp(inputPath)
      .resize(150, 150, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    // Medium: 400px
    await sharp(inputPath)
      .resize(400, 400, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toFile(mediumPath);

    // WebP: full size
    await sharp(inputPath)
      .resize(Math.min(metadata.width || 1200, 1200), undefined, {
        withoutEnlargement: true,
        fit: "inside",
      })
      .webp({ quality: 85 })
      .toFile(webpPath);

    console.log(`[image] Optimized: ${baseFilename}`);

    return {
      original: path.relative(process.cwd(), originalPath).replace(/\\/g, "/"),
      thumbnail: path.relative(process.cwd(), thumbnailPath).replace(/\\/g, "/"),
      medium: path.relative(process.cwd(), mediumPath).replace(/\\/g, "/"),
      webp: path.relative(process.cwd(), webpPath).replace(/\\/g, "/"),
    };
  } catch (err) {
    console.error("Image optimization error:", err);
    throw err;
  }
}

/**
 * Get the best image path for the given context.
 * Prefers WebP if supported, falls back to original.
 */
export function getOptimalImagePath(
  optimized: OptimizedImageResult,
  size: "thumbnail" | "medium" | "original" = "medium",
  preferWebP = true
): string {
  if (preferWebP) {
    return `/uploads/products/${path.basename(optimized.webp)}`;
  }
  return `/uploads/products/${path.basename(optimized[size])}`;
}
