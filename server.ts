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
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
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
            const fetchRes = await fetch(asset.url, { 
              method: 'HEAD', 
              signal: AbortSignal.timeout(5000),
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });
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
      console.log(`Starting SEO audit for: ${url}`);
      const { load } = await import('cheerio');
      const start = Date.now();
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(10000)
      });
      
      const ttfb = Date.now() - start;
      const html = await response.text();
      const $ = load(html);
      
      const title = $('title').text() || $('meta[property="og:title"]').attr('content') || '';
      const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '';
      const h1Count = $('h1').length;
      
      // Lorem Ipsum Detector
      const bodyText = $('body').text().toLowerCase();
      const loremIpsum = bodyText.includes('lorem ipsum') || bodyText.includes('dolor sit amet');

      const images: any[] = [];
      let missingAltCount = 0;
      
      // Select first 20 images to avoid overwhelming the server
      const $imgs = $('img').slice(0, 20);
      
      const imagePromises = $imgs.map(async (_, el) => {
        let src = $(el).attr('src');
        const alt = $(el).attr('alt');
        const dataSrc = $(el).attr('data-src') || $(el).attr('data-lazy') || $(el).attr('data-original');
        const srcset = $(el).attr('srcset');

        if (!alt) missingAltCount++;

        // Handle logical priority: prefer data-src or first srcset item if src is a placeholder/missing
        if (!src || src.startsWith('data:image') || src.length < 5) {
          if (dataSrc) {
            src = dataSrc;
          } else if (srcset) {
            // Take the first link from srcset (usually the smallest or first variant)
            src = srcset.split(',')[0].trim().split(' ')[0];
          }
        }

        if (!src) return;

        // Resolve absolute URL
        try {
          src = new URL(src, url).href;
        } catch {
          if (!src.startsWith('data:')) return;
        }
        
        // Handle Data URIs size estimation
        let size = 0;
        if (src.startsWith('data:')) {
          // Approximate size from base64 string
          size = Math.round((src.split(',')[1] || '').length * 0.75);
          
          // Skip tiny data URIs (usually placeholders or tiny icons)
          if (size < 1000 && (src.includes('svg+xml') || src.length < 500)) return;
        } else {
          try {
              // Try HEAD with timeout
              const imgRes = await fetch(src, { 
                method: 'HEAD', 
                signal: AbortSignal.timeout(3000),
                headers: { 'User-Agent': 'Mozilla/5.0' }
              });
              size = parseInt(imgRes.headers.get('content-length') || '0');
              
              if (size === 0 && imgRes.ok) {
                const getRes = await fetch(src, { 
                  method: 'GET',
                  signal: AbortSignal.timeout(5000),
                  headers: { 'Range': 'bytes=0-1024' } // Just check if it's there
                });
                size = parseInt(getRes.headers.get('content-length') || '0');
              }
          } catch (e) {
            // Silently fail for size detection
          }
        }

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
          isLarge: size > 800 * 1024 // Adjusted to 800KB for quality audit
        });
      }).get();
      
      await Promise.allSettled(imagePromises);

      // SEO Basic Checks
      const seoIssues = [];
      if (!title) seoIssues.push("Missing page title");
      if (!description) seoIssues.push("Missing meta description");
      if (h1Count === 0) seoIssues.push("Missing H1 tag");
      if (h1Count > 1) seoIssues.push("Multiple H1 tags found");
      
      const ssl = url.startsWith('https://');
      const headers = Object.fromEntries(response.headers.entries());

      console.log(`SEO audit completed for: ${url} in ${Date.now() - start}ms`);

      res.json({ 
        title, 
        description, 
        h1Count, 
        images: images.slice(0, 15), 
        performance: { ttfb: `${ttfb}ms` },
        security: { ssl, headers },
        content: { loremIpsum, missingAlt: missingAltCount },
        seoIssues
      });
    } catch (e: any) {
      console.error(`Audit failed for ${url}:`, e);
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
