// Scan LunaBeat: fetch home HTML, discover JS assets, download them, search for lyrics parsing/rendering
import fs from 'node:fs';

const BASE = 'http://10.166.25.130:8787';
const PAIRING_CODE = '579991';

async function http(path, opts = {}) {
  const r = await fetch(BASE + path, { ...opts, headers: { ...(opts.headers || {}) } });
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) return { ok: r.ok, status: r.status, json: await r.json(), text: null };
  const text = await r.text();
  try { return { ok: r.ok, status: r.status, json: JSON.parse(text), text }; }
  catch { return { ok: r.ok, status: r.status, json: null, text }; }
}

console.log('=== Step 1: get home HTML ===');
const home = await http('/');
fs.writeFileSync('page.html', home.text || '');
console.log('HTML length:', (home.text || '').length);

const scriptSrcs = [...(home.text || '').matchAll(/<script[^>]+src="([^"]+)"/gi)].map(m => m[1]);
console.log('Script URLs found:');
scriptSrcs.forEach(s => console.log('  -', s));
const cssSrcs = [...(home.text || '').matchAll(/<link[^>]+href="([^"]+)"[^>]*rel="stylesheet"/gi)].map(m => m[1]);
console.log('CSS URLs found:');
cssSrcs.forEach(s => console.log('  -', s));

console.log('\n=== Step 2: try auth API (pairing code flow) ===');
// 先看看现有 LunaBeatAdapter 用的是什么路径
const authPaths = [
  '/api/auth', '/api/auth/pair', '/api/auth/request', '/api/pairing', '/api/pair',
  '/api/auth?code=' + PAIRING_CODE,
];
for (const p of authPaths.slice(0, 3)) {
  const r = await http(p, { method: 'POST', body: JSON.stringify({ pairingCode: PAIRING_CODE, code: PAIRING_CODE }) });
  console.log(p, '->', r.status, r.json ? JSON.stringify(r.json).slice(0, 500) : r.text?.slice(0, 300));
}
for (const p of authPaths.slice(3)) {
  const r = await http(p);
  console.log(p, '->', r.status, r.json ? JSON.stringify(r.json).slice(0, 500) : r.text?.slice(0, 300));
}

console.log('\n=== Step 3: fetch all JS files and grep lyrics/render/parse patterns ===');
const lyricHits = [];
const patterns = [
  /lyric/gi, /lrc/gi, /yrc/gi, /逐字/gi, /逐行/gi, /word/gi,
  /parse.*time|parseLine|timedLine|timestamp|\[(\d{1,2}):(\d{1,2})\.(\d{1,3})/gi,
  /ttml|ttaf/i,
];
for (const src of scriptSrcs) {
  const url = src.startsWith('http') ? src : (BASE + src);
  try {
    const r = await fetch(url);
    const code = await r.text();
    const name = (src.split('/').pop() || 'script.js').replace(/[?#].*$/, '');
    fs.writeFileSync('_lb_' + name, code);
    const hitted = patterns.filter(re => re.test(code));
    if (hitted.length) {
      lyricHits.push({ name, url, size: code.length, hitPatterns: [...new Set(hitted.map(r => r.toString()))] });
      // search for function definitions around "lyric"
      const regex = /[a-zA-Z_$][\w$]*\s*(=|:)\s*(\([^)]*\)|function[^(]*\([^)]*\))\s*=>?\s*\{[\s\S]{0,400}?(lyric|lrc|parseLine|timestamp|逐字|逐行)/gi;
      const matches = [...code.matchAll(regex)].slice(0, 8).map(m => m[0].slice(0, 500));
      if (matches.length) {
        console.log('\n-----', name, 'LYRIC FUNC SNIPPETS -----');
        matches.forEach(s => console.log(s + '\n---'));
      }
      // also grep renderLyric / updateLyric / formatLyric / currentLyric
      const re2 = /[\w$]*(render|update|format|draw|highlight|active|current)[\w$]*\s*\([^)]*lyric[^)]*\)|[\w$]*Lyric[\w$]*\s*[:=]\s*(function|\()/gi;
      const m2 = [...code.matchAll(re2)].slice(0, 10).map(m => m[0]);
      if (m2.length) {
        console.log('\n-----', name, 'LYRIC RENDER SNIPPETS -----');
        m2.forEach(s => console.log(s));
      }
    }
  } catch (e) {
    console.error('Failed', url, e.message);
  }
}
console.log('\n=== Lyric-related JS summary ===');
console.log(JSON.stringify(lyricHits, null, 2));
