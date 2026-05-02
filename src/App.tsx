/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { LayoutDashboard, Zap, Search, ShieldCheck, Mail } from 'lucide-react';

export default function App() {
  const [targetUrl, setTargetUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const startAudit = async () => {
    if (!targetUrl) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const safeFetch = async (endpoint: string, body: object) => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error(`API Error for ${endpoint}: Expected JSON, got ${contentType}. Response:`, text);
        throw new Error(`Server returned HTML instead of JSON (${res.status})`);
      }
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `API Error: ${res.status}`);
      return json;
    };

    try {
      const resultsArray = await Promise.allSettled([
        safeFetch('/api/crawl', { url: targetUrl }),
        safeFetch('/api/audit/seo', { url: targetUrl })
      ]);
      
      const [crawl, seo] = resultsArray.map(r => r.status === 'fulfilled' ? r.value : null);

      if (seo === null) throw new Error(`SEO Audit Failed: ${resultsArray[1].status === 'rejected' ? (resultsArray[1] as PromiseRejectedResult).reason : 'Unknown error'}`);

      setResults({ links: crawl?.links || [], seo });
    } catch (error: any) {
      console.error("Audit failed:", error);
      setError(error.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] font-sans text-white">
      <nav className="bg-[#0a0a0b]/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <img 
            src="https://onehoster.com/wp-content/uploads/2019/12/onehoster-logo_00ca002e0_2330.png" 
            alt="One Hoster Logo" 
            className="h-10" 
          />
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">History</button>
            <button className="px-5 py-2 text-sm font-medium bg-primary text-black rounded-full hover:opacity-90 transition-all shadow-md shadow-primary/20">New Audit</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-4xl font-light tracking-tight">QA <span className="text-primary">Automator</span></h1>
          <p className="text-zinc-500 mt-2">Automated site audits for superior delivery.</p>
        </header>

        <section className="bg-white/5 p-8 rounded-3xl border border-white/10 shadow-sm mb-12">
          <div className="flex gap-4">
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="Enter target URL (https://...)"
              className="flex-1 px-5 py-3 bg-white/5 border border-white/10 rounded-full focus:outline-none focus:border-primary transition-all text-white placeholder-zinc-500"
            />
            <button
              onClick={startAudit}
              disabled={loading}
              className="px-8 py-3 bg-primary text-black font-semibold rounded-full hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
            >
              <Zap size={18} />
              {loading ? 'Auditing...' : 'Run Audit'}
            </button>
          </div>
        </section>

        {error && (
          <div className="bg-red-900/20 border border-red-500/20 text-red-400 p-6 rounded-3xl mb-12 text-sm">
            <h3 className="font-bold mb-1">Audit Error</h3>
            <p>{error}</p>
          </div>
        )}

        {results && (
          <section className="bg-[#0a0a0b] p-8 rounded-3xl border border-white/5 shadow-sm mb-12 text-white space-y-8">
            <h2 className="text-2xl font-light tracking-tight text-white mb-6">Audit Results for <span className="text-primary">{targetUrl}</span></h2>
            
            <div className="grid grid-cols-4 gap-6">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">TTFB</p>
                    <p className="text-lg font-semibold text-primary">{results.seo.performance.ttfb}</p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Page Title</p>
                    <p className="text-sm font-medium truncate" title={results.seo.title}>{results.seo.title || 'Missing'}</p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Description</p>
                    <p className="text-sm font-medium">{results.seo.description ? 'Present' : 'Missing'}</p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">H1 Count</p>
                    <p className="text-sm font-medium">{results.seo.h1Count}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Broken Links */}
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-semibold mb-4 text-zinc-300">Broken Links ({results.seo.brokenLinks.length})</h3>
                    {results.seo.brokenLinks.length > 0 ? (
                    <ul className="space-y-2">
                        {results.seo.brokenLinks.map((link: string, i: number) => (
                          <li key={i} className="text-xs font-mono text-red-400 bg-red-900/10 p-2 rounded truncate">{link}</li>
                        ))}
                    </ul>
                    ) : (
                    <p className="text-green-400 text-sm flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>No broken links found.</p>
                    )}
                </div>

                {/* Images */}
                <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                    <h3 className="text-lg font-semibold mb-4 text-zinc-300">Image Assets</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {results.seo.images.map((img: any, i: number) => (
                            <div key={i} className="flex items-center justify-between bg-white/[0.02] p-3 rounded-lg text-[10px]">
                            <a href={img.src} target="_blank" rel="noreferrer" className="truncate flex-1 font-mono text-zinc-400 hover:text-primary transition-colors" title={img.src}>{img.src}</a>
                            <div className="flex gap-2">
                                <span className={`px-2 py-0.5 rounded ${img.isLarge ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                                    {img.size}
                                </span>
                                <span className={`px-2 py-0.5 rounded ${img.alt === 'MISSING' ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                                    Alt: {img.alt === 'MISSING' ? 'No' : 'Yes'}
                                </span>
                            </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </section>
        )}
        
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Search, title: 'SEO Validation', desc: 'Meta tags, H1 structure, Sitemap.' },
            { icon: Zap, title: 'Performance', desc: 'Core Web Vitals, LCP/CLS.' },
            { icon: ShieldCheck, title: 'Broken Links', desc: 'Internal/External 404s.' },
            { icon: LayoutDashboard, title: 'Optimizations', desc: 'WebP, Image sizes, Alt text.' },
          ].map((item, i) => (
            <div key={i} className="bg-white/5 p-6 rounded-2xl border border-white/5 flex flex-col gap-3">
              <item.icon className="text-primary" size={24} />
              <h3 className="font-semibold text-lg">{item.title}</h3>
              <p className="text-sm text-zinc-500">{item.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

