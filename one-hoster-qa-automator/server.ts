import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Crawler API
  app.post("/api/crawl", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try {
      const { load } = await import('cheerio');
      const response = await fetch(url);
      const html = await response.text();
      const $ = load(html);
      const host = new URL(url).hostname;
      const links = new Set<string>();

      $('a[href]').each((_, el) => {
        let href = $(el).attr('href');
        if (!href) return;
        
        try {
          const absoluteUrl = new URL(href, url);
          if (absoluteUrl.hostname === host) {
            links.add(absoluteUrl.href);
          }
        } catch {}
      });
      res.json({ links: Array.from(links) });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Crawler failed' });
    }
  });

  // SEO, Performance & Image Health Checker API
  app.post("/api/audit/seo", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    try {
      const { load } = await import('cheerio');
      const start = Date.now();
      const response = await fetch(url);
      const ttfb = Date.now() - start;
      const html = await response.text();
      const $ = load(html);
      
      const title = $('title').text();
      const description = $('meta[name="description"]').attr('content');
      const h1Count = $('h1').length;
      
      const images: any[] = [];
      const imagePromises = $('img').map(async (_, el) => {
        const src = $(el).attr('src');
        if (!src) return;
        
        // Try to get image size
        let size = 0;
        try {
            const imgRes = await fetch(new URL(src, url).href, { method: 'HEAD' });
            size = parseInt(imgRes.headers.get('content-length') || '0');
        } catch {}

        images.push({
          src,
          alt: $(el).attr('alt') || 'MISSING',
          size: size > 0 ? (size / 1024).toFixed(2) + ' KB' : 'Unknown',
          isLarge: size > 500 * 1024 // > 500KB
        });
      }).get();
      await Promise.all(imagePromises);

      const linksToCheck = new Set<string>();
      $('a[href]').each((_, el) => {
        let href = $(el).attr('href');
        if (href) {
            try {
                linksToCheck.add(new URL(href, url).href);
            } catch {}
        }
      });

      const brokenLinks: string[] = [];
      for (const link of Array.from(linksToCheck).slice(0, 5)) {
        try {
          const res = await fetch(link, { method: 'HEAD' });
          if (res.status >= 400) brokenLinks.push(link);
        } catch { brokenLinks.push(link); }
      }

      res.json({ title, description, h1Count, images: images.slice(0, 10), brokenLinks, performance: { ttfb: `${ttfb}ms` } });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Audit failed' });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
