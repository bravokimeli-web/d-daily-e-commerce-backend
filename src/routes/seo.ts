import { Router } from "express";
import { Product } from "../models/Product";

const router = Router();

// ─── Sitemap ───────────────────────────────────────────────────────────────────
router.get("/sitemap.xml", async (_req, res) => {
  try {
    res.type("application/xml");

    const baseUrl = process.env.FRONTEND_URL?.replace(/\/$/, "") || "https://d-daily-frontend.vercel.app";
    const staticPages = [
      { url: "/", changefreq: "weekly", priority: 1.0 },
      { url: "/shop", changefreq: "daily", priority: 0.9 },
      { url: "/about", changefreq: "monthly", priority: 0.7 },
      { url: "/contact", changefreq: "monthly", priority: 0.7 },
      { url: "/faq", changefreq: "monthly", priority: 0.6 },
      { url: "/privacy", changefreq: "yearly", priority: 0.5 },
      { url: "/terms", changefreq: "yearly", priority: 0.5 },
      { url: "/reseller", changefreq: "weekly", priority: 0.8 },
      { url: "/safety", changefreq: "monthly", priority: 0.6 },
      { url: "/categories", changefreq: "weekly", priority: 0.8 },
    ];

    // Get active products
    const products = await Product.find({ isActive: true }).select("slug updatedAt").lean();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Add static pages
    staticPages.forEach((page) => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    // Add product pages
    products.forEach((product) => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/product/${product.slug}</loc>\n`;
      xml += `    <lastmod>${product.updatedAt.toISOString().split("T")[0]}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.send(xml);
  } catch (err) {
    console.error("Sitemap error:", err);
    res.status(500).send("Error generating sitemap");
  }
});

// ─── Robots.txt ────────────────────────────────────────────────────────────────
router.get("/robots.txt", (_req, res) => {
  res.type("text/plain");
  const baseUrl = process.env.FRONTEND_URL?.replace(/\/$/, "") || "https://d-daily-frontend.vercel.app";
  const robotsTxt = `# D-Daily Ltd Robots Configuration
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /cart/
Disallow: /checkout/
Disallow: /uploads/

# Specific search engines
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Crawl delay
Crawl-delay: 5

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml
`;
  res.send(robotsTxt);
});

export default router;
