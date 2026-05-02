// ====== api/audit/broken-links.js ======
import axios from 'axios';
import * as cheerio from 'cheerio';

const MAX_PAGES = 20;

function isBad(href) {
  if (!href) return true;
  return (
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:')
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  const base = new URL(url);
  const baseHost = base.hostname.replace('www.', '');

  const visited = new Set();
  const queue = [url];
  const brokenLinks = [];

  while (queue.length && visited.size < MAX_PAGES) {
    const page = queue.shift();
    if (visited.has(page)) continue;

    visited.add(page);

    let html;
    try {
      const r = await axios.get(page, { timeout: 5000 });
      html = r.data;
    } catch {
      continue;
    }

    const $ = cheerio.load(html);

    $('a[href]').each(async (_, el) => {
      const href = $(el).attr('href');
      if (isBad(href)) return;

      let full;
      try {
        full = new URL(href, page).toString();
      } catch {
        return;
      }

      const host = new URL(full).hostname.replace('www.', '');

      // مهم جدًا: نفس الدومين فقط
      if (host !== baseHost) return;

      try {
        const resp = await axios.head(full, { timeout: 5000 });
        if (resp.status >= 400) {
          brokenLinks.push({ page, link: full, status: resp.status });
        }
      } catch {
        brokenLinks.push({ page, link: full, status: 'Network Error' });
      }

      if (!visited.has(full)) {
        queue.push(full);
      }
    });
  }

  res.json({ brokenLinks });
}