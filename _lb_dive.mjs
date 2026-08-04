// Deep dive into lyric-player.js and app.js
import fs from 'node:fs';

const BASE = 'http://10.166.25.130:8787';

const assets = [
  '/lyric-player.js?v=20260730-5',
  '/flow-light.js?v=20260730-5',
  '/side-rays.js?v=20260730-5',
];

for (const a of assets) {
  const r = await fetch(BASE + a);
  const c = await r.text();
  const name = a.split('/').pop().replace(/[?#].*$/, '');
  fs.writeFileSync('_lb_' + name, c);
  console.log(a, 'size=', c.length);
}

// ---- Now examine lyric-player.js for parse + render functions ----
const lp = fs.readFileSync('_lb_lyric-player.js', 'utf8');
console.log('\n=== LYRIC-PLAYER.JS SNIPPET (top 100 lines) ===');
console.log(lp.split('\n').slice(0, 120).join('\n'));

// Search for key lines: parse*, lyric*, render*, update*, seek
console.log('\n=== KEY DEFINITIONS IN lyric-player.js ===');
const patterns = [
  /(export\s+)?(const|function|let|var)\s+\w*(parse|lyric|render|update|seek|draw|line|word|active|index|format)[\w$]*\s*[=(:]/gi,
  /^\s*(parse[\w$]*|render[\w$]*|update[\w$]*|format[\w$]*|draw[\w$]*|apply[\w$]*)\s*\(/gmi,
  /\.lyrics?\s*[=:]|\.lines?\s*[=:]|\.words?\s*[=:]/gi,
];
for (const re of patterns) {
  const hits = [...lp.matchAll(re)].slice(0, 30);
  if (hits.length) {
    console.log('\nPattern:', re.toString());
    hits.forEach(h => {
      const idx = h.index;
      const lineStart = lp.lastIndexOf('\n', idx) + 1;
      const lineEnd = lp.indexOf('\n', idx);
      console.log('  L~', lp.slice(0, lineStart).split('\n').length, ':', lp.slice(lineStart, lineEnd < 0 ? lp.length : lineEnd).trim().slice(0, 220));
    });
  }
}

// Also dump contextual chunks around "parse"/"render"/"lines ="/"activeLineIndex"
console.log('\n=== CONTEXT CHUNKS ===');
const keywords = ['parseLyric', 'parseLRC', 'parseLine', 'parse', 'render', 'updateLyric', 'update', 'activeIndex', 'activeLine', 'currentLine', 'currentTime', 'lines', 'words'];
for (const kw of keywords) {
  const re = new RegExp(`(?:const|let|var|function|=|:)\\s*\\b${kw}\\b[^\\n]{0,200}|\\b${kw}\\s*\\([^)]*\\)\\s*=>?\\s*\\{[^}]{0,400}`, 'gi');
  const hits = [...lp.matchAll(re)].slice(0, 5);
  if (hits.length) {
    console.log(`\n--- keyword: ${kw} ---`);
    hits.forEach(h => console.log('  ', h[0].slice(0, 500)));
  }
}

// Also get the full createLyricPlayer factory signature
const factory = lp.match(/export\s+(?:function|const|default\s+function|default|async\s+function)\s+(createLyricPlayer\s*\([^)]*\)[\s\S]{0,3000}?^\s*\}?\s*\n)/m);
if (factory) {
  console.log('\n=== createLyricPlayer head 3000chars ===');
  console.log(factory[0].slice(0, 3000));
}
