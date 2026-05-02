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

  // ADVANCED BROKEN LINK & ASSET SCANNER API
  app.post("/api/audit/broken-links", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    let browser;
    try {
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
      });
      const page = await browser.newPage();
      
      // Navigate to URL and wait for network idle to catch JS-rendered elements
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // Extract all potential links and assets
      const assets = await page.evaluate(() => {
        const results: any[] = [];
        
        // 1. Standard links and buttons
        document.querySelectorAll('a, button').forEach(el => {
          const href = (el as any).href || (el as any).getAttribute('onclick');
          const text = el.textContent?.trim().slice(0, 50) || el.id || el.className || 'Unnamed Element';
          if (href && href.startsWith('http')) {
            results.push({ url: href, type: el.tagName === 'A' ? 'Link' : 'Button', identifier: text });
          }
        });

        // 2. Images, Videos, Sources
        document.querySelectorAll('img, video, source').forEach(el => {
          const src = (el as any).src || (el as any).srcset;
          if (src) {
            results.push({ url: src, type: el.tagName, identifier: (el as any).alt || 'Media Asset' });
          }
        });

        // 3. Forms
        document.querySelectorAll('form').forEach(el => {
          if (el.action) {
            results.push({ url: el.action, type: 'Form Action', identifier: el.id || 'Form' });
          }
        });

        // 4. Scripts and Styles
        document.querySelectorAll('link[rel="stylesheet"], script[src]').forEach(el => {
          const href = (el as any).href || (el as any).src;
          if (href) {
            results.push({ url: href, type: el.tagName === 'LINK' ? 'CSS' : 'JS', identifier: 'Resource' });
          }
        });

        return results;
      });

      await browser.close();

      // Parallel Validation with Concurrency Control
      interface Asset {
        url: string;
        type: string;
        identifier: string;
      }
      const uniqueAssets = Array.from(new Map(assets.map((a: Asset) => [a.url, a])).values()) as Asset[];
      const brokenLinks: any[] = [];
      const CONCURRENCY = 5;
      
      for (let i = 0; i < uniqueAssets.length; i += CONCURRENCY) {
        const chunk = uniqueAssets.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (asset: Asset) => {
          try {
            const fetchRes = await fetch(asset.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            if (!fetchRes.ok) {
              brokenLinks.push({
                sourcePage: url,
                brokenUrl: asset.url,
                statusCode: fetchRes.status,
                elementType: asset.type,
                elementIdentifier: asset.identifier
              });
            }
          } catch (err: any) {
             brokenLinks.push({
                sourcePage: url,
                brokenUrl: asset.url,
                statusCode: 'Network Error',
                elementType: asset.type,
                elementIdentifier: asset.identifier
              });
          }
        }));
      }

      res.json({ brokenLinks });
    } catch (e: any) {
      if (browser) await browser.close();
      res.status(500).json({ error: e.message || 'Advanced Audit failed' });
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
      
      // Lorem Ipsum Detector
      const text = $('body').text().toLowerCase();
      const loremIpsum = text.includes('lorem ipsum') || text.includes('dolor sit');

      const images: any[] = [];
      let missingAltCount = 0;
      const imagePromises = $('img').map(async (_, el) => {
        const src = $(el).attr('src');
        const alt = $(el).attr('alt');
        if (!alt) missingAltCount++;
        if (!src) return;
        
        // Try to get image size
        let size = 0;
        try {
            const imgRes = await fetch(new URL(src, url).href, { method: 'HEAD' });
            size = parseInt(imgRes.headers.get('content-length') || '0');
        } catch {}

        let formattedSize = "Unknown";
        if (size > 0) {
            if (size > 1024 * 1024) {
                formattedSize = (size / (1024 * 1024)).toFixed(2) + ' MB';
            } else {
                formattedSize = (size / 1024).toFixed(2) + ' KB';
            }
        }

        images.push({
          src,
          alt: alt || 'MISSING',
          size: formattedSize,
          isLarge: size > 500 * 1024 // > 500KB
        });
      }).get();
      await Promise.all(imagePromises);

      // SEO Basic Checks
      const seoIssues = [];
      if (!title) seoIssues.push("Missing page title");
      if (!description) seoIssues.push("Missing meta description");
      if (h1Count === 0) seoIssues.push("Missing H1 tag");
      if (h1Count > 1) seoIssues.push("Multiple H1 tags found");

      // Broken Links Check
      const links = new Set<string>();
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
            try {
                const absoluteUrl = new URL(href, url);
                links.add(absoluteUrl.href);
            } catch {}
        }
      });
      const linksArray = Array.from(links).slice(0, 10); // Limit to top 10 for performance
      const brokenLinks: string[] = [];
      await Promise.all(linksArray.map(async (link) => {
          try {
              const res = await fetch(link, { method: 'GET' });
              if (res.status >= 400) brokenLinks.push(link);
          } catch { brokenLinks.push(link); }
      }));

      // Security: SSL check (head request)
      const ssl = url.startsWith('https://');

      // Security: Basic response headers inspection
      const headers = Object.fromEntries(response.headers.entries());

      res.json({ 
        title, 
        description, 
        h1Count, 
        images: images.slice(0, 10), 
        brokenLinks,
        performance: { ttfb: `${ttfb}ms` },
        security: { ssl, headers },
        content: { loremIpsum, missingAlt: missingAltCount },
        seoIssues
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Audit failed' });
    }
  });

  // RESPONSIVE SCREENSHOTS API
  app.post("/api/audit/screenshots", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    let browser;
    try {
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
      });
      const page = await browser.newPage();
      
      const devices = [
        { name: 'Mobile', width: 375, height: 667 },
        { name: 'Tablet', width: 768, height: 1024 },
        { name: 'Desktop', width: 1440, height: 900 }
      ];

      const screenshots: any[] = [];

      for (const device of devices) {
        await page.setViewport({ width: device.width, height: device.height });
        await page.goto(url, { waitUntil: 'networkidle2' });
        const screenshot = await page.screenshot({ encoding: 'base64' });
        screenshots.push({ name: device.name, data: `data:image/png;base64,${screenshot}` });
      }

      await browser.close();
      res.json({ screenshots });
    } catch (e: any) {
      if (browser) await browser.close();
      res.status(500).json({ error: e.message || 'Screenshot failed' });
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
