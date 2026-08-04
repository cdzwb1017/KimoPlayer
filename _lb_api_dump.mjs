// Fetch songs + lyric API properly, dumping JSON structure
import fs from 'node:fs';
const BASE = 'http://10.166.25.130:8787';
const r1 = await fetch(BASE + '/api/songs');
const songsJson = await r1.json();
console.log('songs JSON typeof:', typeof songsJson);
console.log('songs JSON top-level keys / structure preview:');
if (Array.isArray(songsJson)) {
  console.log('  -> is Array, length =', songsJson.length);
  console.log('  first 2:', JSON.stringify(songsJson.slice(0,2)).slice(0, 1200));
} else if (songsJson && typeof songsJson === 'object') {
  console.log('  keys:', Object.keys(songsJson));
  for (const k of Object.keys(songsJson)) {
    const v = songsJson[k];
    if (Array.isArray(v)) console.log('   ', k, 'Array len=', v.length, JSON.stringify(v.slice(0,1)).slice(0, 700));
    else console.log('   ', k, typeof v, JSON.stringify(v).slice(0, 400));
  }
}

// Determine first song ID correctly
const first = Array.isArray(songsJson) ? songsJson[0] : (songsJson?.data?.[0] || songsJson?.songs?.[0] || songsJson?.items?.[0] || songsJson?.list?.[0]);
console.log('\nfirst song object:', first ? JSON.stringify(first).slice(0, 1200) : 'N/A');
const id = first?.audioId ?? first?.id;
console.log('first id:', id);

if (id != null) {
  const r2 = await fetch(BASE + '/api/lyric?id=' + id);
  const text = await r2.text();
  console.log('\n/api/lyric raw content type:', r2.headers.get('content-type'), 'length:', text.length);
  let obj;
  try { obj = JSON.parse(text); } catch { obj = null; }
  if (obj) {
    console.log('/api/lyric parsed JSON keys:', Object.keys(obj));
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string') console.log('  KEY', k, 'string len=', v.length, 'preview=', v.slice(0, 800).replace(/\n/g,'\\n'));
      else console.log('  KEY', k, typeof v, JSON.stringify(v).slice(0, 1000));
    }
  } else {
    // maybe non-JSON (lrc text directly?)
    console.log('Raw lyric content (non-JSON) first 2000 chars:');
    console.log(text.slice(0, 2000));
  }
  // Save it for later parse test
  fs.writeFileSync('_lb_lyric_raw.txt', text);
}
