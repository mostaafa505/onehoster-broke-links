/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { LayoutDashboard, Zap, Search, ShieldCheck, CheckCircle, Download, Share2, Monitor, Layout, Image } from 'lucide-react';

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
        safeFetch('/api/audit/seo', { url: targetUrl }),
        safeFetch('/api/audit/broken-links', { url: targetUrl }),
        safeFetch('/api/audit/screenshots', { url: targetUrl })
      ]);
      
      const [crawl, seo, broken, screenshots] = resultsArray.map(r => r.status === 'fulfilled' ? r.value : null);

      if (seo === null) throw new Error(`SEO Audit Failed: ${resultsArray[1].status === 'rejected' ? (resultsArray[1] as PromiseRejectedResult).reason : 'Unknown error'}`);

      setResults({ 
        links: crawl?.links || [], 
        seo: { 
          ...seo, 
          advancedBrokenLinks: broken?.brokenLinks || [],
          screenshots: screenshots?.screenshots || []
        } 
      });
    } catch (error: any) {
      console.error("Audit failed:", error);
      setError(error.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] font-sans text-white">
      <nav className="bg-bg-deep/90 backdrop-blur-md border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <img 
            src="https://onehoster.com/wp-content/uploads/2019/12/onehoster-logo_00ca002e0_2330.png" 
            alt="One Hoster Logo" 
            className="h-8" 
          />
          <div className="flex items-center gap-2">
            <button className="px-5 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">History</button>
            <button className="px-6 py-2 text-sm font-medium bg-primary text-white rounded-full hover:bg-primary/90 transition-all shadow-md shadow-primary/10">New Audit</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-16">
        <header className="mb-16">
          <h1 className="text-5xl font-semibold tracking-tighter text-white">QA <span className="text-primary">Automator</span></h1>
          <p className="text-zinc-400 mt-3 text-lg font-light">Professional-grade site audits for superior delivery.</p>
        </header>

        <section className="bg-card-bg p-6 md:p-10 rounded-3xl border border-border shadow-xl shadow-black/20 mb-16">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-6 py-4 bg-bg-deep border border-border rounded-2xl focus:outline-none focus:border-primary transition-all text-white placeholder-zinc-600"
            />
            <button
              onClick={startAudit}
              disabled={loading}
              className="px-10 py-4 bg-primary text-white font-semibold rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Zap size={20} />
              {loading ? 'Running...' : 'Run Audit'}
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
          <div className="space-y-8" id="audit-report">
            <section className="bg-card-bg p-6 md:p-10 rounded-3xl border border-border shadow-xl shadow-black/20 text-white space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                   <h2 className="text-2xl md:text-3xl font-semibold tracking-tighter text-white">Full Quality Audit Results</h2>
                   <p className="text-zinc-500 text-sm">{targetUrl}</p>
                </div>
                <div className="flex gap-3">
                   <button 
                     onClick={() => {
                        alert("Generating Professional PDF Report... (Demo Mode - check browser console for structure)");
                        console.log("PDF Generation Triggered with jspdf & html2canvas");
                     }}
                     className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-zinc-700"
                   >
                     <Download size={14} className="text-primary" /> Export PDF Report
                   </button>
                   <button onClick={() => alert("Simulation: Report sent to Slack #qa-alerts")} className="px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-primary/20">
                     <Share2 size={14} /> Notify Developers
                   </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                    <div className="bg-bg-deep p-4 md:p-6 rounded-2xl border border-border relative overflow-hidden group">
                        <p className="text-[10px] md:text-[11px] uppercase tracking-widest text-zinc-500 mb-1">Server Speed (TTFB)</p>
                        <p className="text-xl md:text-2xl font-semibold text-white">{results.seo.performance.ttfb}</p>
                        <div className="absolute bottom-0 left-0 h-1 bg-primary w-full opacity-20"></div>
                    </div>
                    <div className="bg-bg-deep p-4 md:p-6 rounded-2xl border border-border relative overflow-hidden group">
                        <p className="text-[10px] md:text-[11px] uppercase tracking-widest text-zinc-500 mb-1">SSL Certificate</p>
                        <p className="text-xl md:text-2xl font-semibold text-white">{results.seo.security.ssl ? 'Valid ✓' : 'Invalid ✗'}</p>
                        <div className={`absolute bottom-0 left-0 h-1 w-full opacity-20 ${results.seo.security.ssl ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                    <div className="bg-bg-deep p-4 md:p-6 rounded-2xl border border-border relative overflow-hidden group">
                        <p className="text-[10px] md:text-[11px] uppercase tracking-widest text-zinc-500 mb-1">Content Integrity</p>
                        <p className="text-xl md:text-2xl font-semibold text-white">{results.seo.content.loremIpsum ? 'Dirty ✗' : 'Professional ✓'}</p>
                        <div className={`absolute bottom-0 left-0 h-1 w-full opacity-20 ${results.seo.content.loremIpsum ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    </div>
                    <div className="bg-bg-deep p-4 md:p-6 rounded-2xl border border-border relative overflow-hidden group">
                        <p className="text-[10px] md:text-[11px] uppercase tracking-widest text-zinc-500 mb-1">Accessibility Tags</p>
                        <p className="text-xl md:text-2xl font-semibold text-white">{results.seo.content.missingAlt > 0 ? `${results.seo.content.missingAlt} Missing` : 'Complete ✓'}</p>
                        <div className={`absolute bottom-0 left-0 h-1 w-full opacity-20 ${results.seo.content.missingAlt > 0 ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                    </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* SEO Compliance Summary */}
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 h-full">
                      <h3 className="text-sm font-bold mb-6 text-zinc-300 flex items-center justify-between">
                        <span>SEO & METADATA</span>
                        <span className="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-mono">AUTOMATED</span>
                      </h3>
                      {results.seo.seoIssues && results.seo.seoIssues.length > 0 ? (
                        <ul className="space-y-4">
                          {results.seo.seoIssues.map((issue: string, i: number) => (
                            <li key={i} className="text-[11px] text-zinc-400 flex items-start gap-3 bg-red-900/5 p-4 rounded-xl border border-red-900/10">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0 animate-pulse"></span>
                              <span className="leading-tight">{issue}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="bg-green-900/5 p-6 rounded-xl border border-green-900/20 flex flex-col items-center gap-3 text-center">
                          <CheckCircle size={32} className="text-green-500/50" />
                          <p className="text-[11px] text-green-400 font-medium">Structure follows delivery standards.</p>
                        </div>
                      )}
                  </div>

                  {/* ADVANCED BROKEN LINKS SCANNER */}
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/5 h-full col-span-1 md:col-span-2">
                       <h3 className="text-sm font-bold mb-6 text-zinc-300 flex items-center justify-between">
                        <span>BROKEN LINKS & ASSETS SCANNER</span>
                        <span className="text-[10px] text-zinc-500 uppercase">Interactive Probe</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                          {results.seo.advancedBrokenLinks && results.seo.advancedBrokenLinks.length > 0 ? (
                              results.seo.advancedBrokenLinks.map((asset: any, i: number) => (
                                  <div key={i} className="bg-bg-deep border border-red-900/20 p-4 rounded-xl space-y-3 hover:border-red-900/50 transition-colors">
                                      <div className="flex justify-between items-center">
                                          <span className="text-[9px] font-black px-2 py-1 rounded bg-red-900 text-white uppercase">
                                              {asset.statusCode === 'Network Error' ? 'OFFLINE' : `HTTP ${asset.statusCode}`}
                                          </span>
                                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                                              {asset.elementType}
                                          </span>
                                      </div>
                                      <p className="text-[11px] font-mono text-red-300 break-all leading-tight italic opacity-80" title={asset.brokenUrl}>
                                          {asset.brokenUrl}
                                      </p>
                                      <div className="pt-2 border-t border-white/5 space-y-1">
                                          <p className="text-[8px] text-zinc-600 uppercase font-bold">Failed Element Identifier</p>
                                          <p className="text-[10px] text-zinc-400 font-medium truncate">{asset.elementIdentifier}</p>
                                      </div>
                                  </div>
                              ))
                          ) : (
                              <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center bg-green-900/5 rounded-2xl border border-green-900/10">
                                  <ShieldCheck size={48} className="text-green-500/20 mb-4" />
                                  <span className="text-green-500 font-bold text-sm">Security & Integrity Pass</span>
                                  <p className="text-[10px] text-green-700/60 mt-1 uppercase tracking-widest">Zero broken assets detected on pre-delivery scan</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>

              {/* IMAGE ASSET AUDIT */}
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2 uppercase tracking-widest">
                        <Image size={16} className="text-primary" /> Image Asset Audit
                    </h3>
                    <div className="flex gap-2">
                        <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-bold">TOTAL: {results.seo.images.length}</span>
                        <span className="text-[9px] bg-red-900/20 text-red-400 px-2 py-0.5 rounded font-bold uppercase">Critical fixes: {results.seo.images.filter((img: any) => img.alt === 'MISSING' || img.isLarge).length}</span>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {results.seo.images.map((img: any, i: number) => (
                    <div key={i} className="bg-bg-deep border border-white/5 p-4 rounded-xl flex items-start gap-4 hover:border-primary/20 transition-colors group">
                      <div 
                        className="w-20 h-20 rounded-lg bg-zinc-800 overflow-hidden shrink-0 border border-white/5 relative cursor-zoom-in"
                        onClick={() => window.open(img.src, '_blank')}
                      >
                        <img src={img.src} alt={img.alt} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Search size={16} className="text-white" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="space-y-1">
                          <p className="text-[9px] text-zinc-500 uppercase font-black tracking-tighter">Image Source Link</p>
                          <a 
                            href={img.src} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[11px] text-primary hover:underline font-mono break-all line-clamp-2 block leading-relaxed" 
                            title={img.src}
                          >
                            {img.src}
                          </a>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className={`text-[9px] px-2 py-1 rounded font-bold ${img.size === 'Unknown' ? 'bg-zinc-800 text-zinc-500' : (img.isLarge ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400')}`}>
                            {img.size.toUpperCase()}
                          </span>
                          <span className={`text-[9px] px-2 py-1 rounded font-bold ${img.alt === 'MISSING' ? 'bg-red-900/20 text-red-400' : 'bg-green-900/20 text-green-400'}`}>
                            {img.alt === 'MISSING' ? 'MISSING ALT TAG' : `ALT: "${img.alt}"`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Responsive Benchmarking */}
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-8">
                     <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2 uppercase tracking-widest">
                        <Monitor size={16} className="text-primary" /> Visual Delivery Proofs
                     </h3>
                     <p className="text-[10px] text-zinc-500 font-medium">GENERATED BY HEADLESS ENGINE</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    {results.seo.screenshots && results.seo.screenshots.length > 0 ? (
                      results.seo.screenshots.map((shot: any, i: number) => (
                        <div key={i} className="space-y-4">
                          <div className="flex items-center justify-center gap-2">
                             <div className={`w-2 h-2 rounded-full ${shot.name === 'Mobile' ? 'bg-blue-400' : shot.name === 'Tablet' ? 'bg-purple-400' : 'bg-green-400'}`}></div>
                             <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">{shot.name} COMPATIBILITY</p>
                          </div>
                          <div className="bg-black/40 rounded-2xl border border-white/5 p-1.5 overflow-hidden shadow-2xl relative group ring-1 ring-white/10">
                            <div className="aspect-[3/4] overflow-hidden rounded-xl">
                               <img src={shot.data} alt={shot.name} className="w-full object-top hover:scale-110 transition-transform duration-700 cursor-zoom-in" />
                            </div>
                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                              <p className="text-[10px] text-white font-bold">{shot.name} Rendering OK</p>
                              <button onClick={() => window.open(shot.data)} className="px-5 py-2 bg-primary text-black text-[10px] font-black rounded-full shadow-xl shadow-primary/40 hover:scale-105 transition-transform active:scale-95">VIEW EVIDENCE</button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-3 py-20 text-center text-zinc-700 border border-border border-dashed rounded-3xl flex flex-col items-center gap-3 bg-white/[0.01]">
                         <Layout size={32} className="opacity-20" />
                         <p className="text-xs uppercase font-bold tracking-widest">Generating Visual Proofs...</p>
                      </div>
                    )}
                  </div>
              </div>
            </section>
          </div>
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

