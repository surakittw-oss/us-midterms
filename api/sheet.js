// Caching proxy for the newsroom's Google Sheet.
// Readers never call Google directly: Vercel's CDN serves this response to everyone and
// refetches from Google at most about every 30 seconds per tab, however many people are watching.
// If Google is slow or failing, the CDN keeps serving the last good copy for up to 5 minutes.

const SHEET_ID = process.env.SHEET_ID || '15Bq_0XLvVhgR3MhvmjbQDmLrvoXAyzKOcpE6beV-SaA';
const TABS = new Set(['results', 'house']);

export default async function handler(req, res) {
  const tab = TABS.has(req.query.tab) ? req.query.tab : 'results';
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${tab}`;

  // Pages on other hosts (e.g. an old GitHub Pages copy) may read this too
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) throw new Error(`Google responded ${upstream.status}`);
    const csv = await upstream.text();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // Browsers revalidate every time; the CDN holds it 30 s and may serve it stale for 5 min while refreshing
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=300');
    res.status(200).send(csv);
  } catch (err) {
    // Never cache a failure, so the next request tries Google again
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).send(`Results sheet unavailable: ${err.message}`);
  }
}
