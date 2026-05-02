// ====== src/App.tsx ======
import { useState } from 'react';

type BrokenLink = {
  page: string;
  link: string;
  status: number | string;
  error?: string;
};

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ brokenLinks: BrokenLink[] } | null>(null);

  const check = async () => {
    setLoading(true);
    setData(null);

    const res = await fetch('/api/audit/broken-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Broken Links Checker</h1>

      <input
        placeholder="https://example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{ width: 400, padding: 10 }}
      />

      <button onClick={check} style={{ marginLeft: 10, padding: 10 }}>
        {loading ? 'Checking...' : 'Check'}
      </button>

      <hr style={{ margin: '30px 0' }} />

      {data && (
        <div>
          <h2>Broken Links</h2>
          {data.brokenLinks.length === 0 && <p>No broken links 🎉</p>}

          {data.brokenLinks.map((b, i) => (
            <div key={i} style={{ marginBottom: 15 }}>
              <b>Page:</b> {b.page}
              <br />
              <b>Broken:</b> {b.link}
              <br />
              <b>Status:</b> {b.status}
              <hr />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
