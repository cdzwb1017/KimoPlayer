// Simplified analysis: dump lyric API sample, normalizeLine code in lyric-player,
// and read amll-core LyricPlayer class for lines structure.
import fs from 'node:fs';
const BASE = 'http://10.166.25.130:8787';

// 1) API samples: songs then lyric
console.log('=== Step A: fetch songs and lyric ===');
try {
  const songs = await fetch(BASE + '/api/songs').then(r => r.json());
  const sample = (songs || []).slice(0, 5);
  console.log('First 5 songs:');
  sample.forEach(s => {
    console.log(' -', { id: s.audioId || s.id, title: s.title, artist: s.artist, durationMs: s.durationMs, duration: s.duration });
  });
  for (const s of sample) {
    const id = s.audioId || s.id;
    const r = await fetch(BASE + '/api/lyric?id=' + id);
    const t = await r.text();
    let json; try { json = JSON.parse(t); } catch { json = { raw: t.slice(0,500) }; }
    console.log(`\n=== LYRIC id=${id} title=${s.title} ===`);
    for (const k of Object.keys(json)) {
      const v = json[k];
      if (typeof v === 'string' && v.length < 3000) console.log(`  ${k}: ${v}`);
      else if (typeof v === 'string') console.log(`  ${k} (str ${v.length}):`, v.slice(0, 600).replace(/\n/g, '\\n'));
      else if (v && typeof v === 'object') console.log(`  ${k} (${Array.isArray(v)?'arr':'obj'}):`, JSON.stringify(v).slice(0, 600));
      else console.log(`  ${k}:`, v);
    }
    console.log('---');
    break; // just 1
  }
} catch (e) {
  console.error('LYRIC API ERROR:', e.message);
}

// 2) normalizeLine / LyricPlayer.setLyricLines contract from downloaded files
console.log('\n=== Step B: lyric-player normalizeLine ===');
const lp = fs.readFileSync('_lb_lyric-player.js', 'utf8');
// Find normalizeLine and normalizeWord functions fully
const extractFn = (name) => {
  const re = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?^\\}`, 'm');
  const m = lp.match(re);
  return m ? m[0] : null;
};
console.log('normalizeLine:\n' + (extractFn('normalizeLine') || 'not found'));
console.log('\nnormalizeWord:\n' + (extractFn('normalizeWord') || 'not found'));

// 3) Find LyricPlayer class in amll-core for key methods
console.log('\n=== Step C: amll-core LyricPlayer class ===');
const core = fs.readFileSync('_lb_amll-core.js', 'utf8');
const clsMatch = core.match(/class\s+LyricPlayer\s*\{[\s\S]{0,20000}/);
if (clsMatch) {
  // Cut until we have class opening brace matched (approx): grab key methods signatures
  const src = clsMatch[0];
  const methodRes = [
    new RegExp('setLyricLines\\s*\\(', 'g'),
    new RegExp('setCurrentTime\\s*\\(', 'g'),
    new RegExp('update\\s*\\(', 'g'),
    new RegExp('getElement\\s*\\(', 'g'),
    new RegExp('getBottomLineElement\\s*\\(', 'g'),
    new RegExp('constructor\\s*\\(', 'g'),
    new RegExp('setEnableBlur\\s*\\(', 'g'),
    new RegExp('setEnableSpring\\s*\\(', 'g'),
    new RegExp('setAlignPosition\\s*\\(', 'g'),
    new RegExp('resetScroll\\s*\\(', 'g'),
    new RegExp('dispose\\s*\\(', 'g'),
    new RegExp('addEventListener\\s*\\(', 'g'),
    new RegExp('setEnableScale\\s*\\(', 'g'),
    new RegExp('setWordFadeWidth\\s*\\(', 'g'),
    new RegExp('resume\\s*\\(', 'g'),
  ];
  for (const re of methodRes) {
    const hits = [];
    for (let m; (m = re.exec(src)) !== null; ) {
      const idx = m.index;
      const lineStart = src.lastIndexOf('\n', idx) + 1;
      const lineEnd = src.indexOf('\n', idx);
      const end = lineEnd < 0 ? Math.min(src.length, idx + 260) : lineEnd;
      hits.push('  L' + src.slice(0, lineStart).split('\n').length + ': ' + src.slice(lineStart, end).trim().slice(0, 260));
    }
    if (hits.length) { console.log('\n-- ' + re.toString().replace(/\\s|\[.*?\]|\\/g, ' ').slice(0, 40) + ' --'); hits.slice(0, 3).forEach(h => console.log(h)); }
  }
} else {
  console.log('Could not locate class LyricPlayer {');
}
