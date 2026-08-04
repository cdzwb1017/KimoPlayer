// Download amll-core and scan its exports + find LyricPlayer parse/render implementation, plus lyric fetch API samples
import fs from 'node:fs';

const BASE = 'http://10.166.25.130:8787';

// Check if there are more assets by searching HTML for other JS imports
const page = fs.readFileSync('_lb_app.js', 'utf8');
const imports = [...page.matchAll(/from\s+['"]([^'"]+)['"];?/g)].map(m => m[1]);
console.log('All imports referenced in app.js:');
imports.forEach(i => console.log('  -', i));

// find lyrics fetch API: search for "/api/lyric" calls in app.js
const lyricApiHits = [...page.matchAll(/\/api\/lyric[^'"].{0,300}/g)];
console.log('\n=== /api/lyric references in app.js (up to 300 chars each:');
lyricApiHits.slice(0,10).forEach(h => console.log(' ', h[0].slice(0, 400)));

// find "/amll-core
{
  const r = await fetch(BASE + '/amll-core.js?v=20260730-5');
  const c = await r.text();
  fs.writeFileSync('_lb_amll-core.js', c);
  console.log('\namll-core.js size=', c.length);
}
const lp = fs.readFileSync('_lb_amll-core.js', 'utf8');

// Find LyricPlayer: scan for parse functions and setLyricLines/update/parse
console.log('\n=== TOP 100 LINES of amll-core ===');
console.log(lp.split('\n').slice(0, 100).join('\n'));

console.log('\n=== KEY DEFINITIONS: LyricPlayer, parse, lines, update ===');
const patterns = [
  new RegExp('class LyricPlayer'),
  new RegExp('setLyricLines'),
  new RegExp('setCurrentTime'),
  new RegExp('\\bupdate\\s*\\('),
  new RegExp('function\\s+\\w*[Pp]arse\\w*\\s*\\('),
  new RegExp('const\\s+\\w*[Pp]arse\\w*\\s*='),
  new RegExp('normalizeLine|\\.words\\b|translatedLyric|romanLyric|startTime|endTime'),
];
const all = [];
for (const re of patterns) {
  const hits = [...lp.matchAll(re)].slice(0, 30);
  if (hits.length) {
    console.log('\nPattern:', re.toString().slice(0, 100));
    hits.forEach(h => {
      const idx = h.index;
      const lineStart = lp.lastIndexOf('\n', idx) + 1;
      const lineEnd = lp.indexOf('\n', idx);
      const end = lineEnd < 0 ? lp.length : lineEnd;
      const lineNum = lp.slice(0, lineStart).split('\n').length;
      const snippet = lp.slice(lineStart, end).trim().slice(0, 200);
      all.push({ L: lineNum, s: snippet });
    });
  }
}
// unique lines
const seen = new Set();
for (const x of all) {
  const key = x.L + ':' + x.s.slice(0,80);
  if (seen.has(key)) continue; seen.add(key);
  console.log('  L' + x.L + ':', x.s);
}

// Try to check API calls in amll-core for line structure
console.log('\n=== LYRICS API RESULT samples (from app.js search /api/lyric pattern) ===');
// now also get actual api call URL with auth? We already saw /api/auth returned authenticated:true so songs and lyrics
try {
  const songs = await fetch(BASE + '/api/songs').then(r => r.json());
  console.log('/api/songs sample 3 songs:', songs.slice ? songs.slice(0,3).map(s => ({id:s.id||s.audioId,title:s.title,artist:s.artist})) : songs);
  if (songs && songs[0]) {
    const id = songs[0].audioId || songs[0].id;
    const lyric = await fetch(BASE + '/api/lyric?id=' + id).then(r => r.json());
    console.log('\nLYRIC SAMPLE /api/lyric?id=', id, 'KEYS:', Object.keys(lyric));
    // Show top level
    for (const k of Object.keys(lyric)) {
      const v = lyric[k];
      if (typeof v === 'string') console.log(' ', k, ':', v.slice(0,200));
      else console.log(' ', k, ':', typeof v, JSON.stringify(v).slice(0,200));
    }
  }
} catch (e) {
  console.error('songs/lyric fetch failed:', e.message);
}
