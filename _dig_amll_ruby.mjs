// Dig for AMLL kanji <-> furigana (romanWord) distribution algorithm.
import fs from 'node:fs';

const core = fs.readFileSync('_lb_amll-core.js', 'utf8');
const flow = fs.readFileSync('_lb_flow-light.js', 'utf8');

// Find occurrences of romanWord / transliteration usage near word concatenation logic.
console.log('=== core.js: romanWord / transliteration contexts (150 chars each side) ===');
[...core.matchAll(/romanWord|transliteration|isCJK|[\u4e00-\u9faf]|split\(|charCodeAt|fromCodePoint|furigana|ruby|Kanji|CJK/gi)].forEach((m, i) => {
  const start = Math.max(0, m.index - 220);
  const end = Math.min(core.length, m.index + 380);
  console.log(`\n--- match[${i}] @${m.index} "${m[0]}" ---`);
  console.log(core.slice(start, end));
});

console.log('\n\n\n=== flow-light.js: romanWord / transliteration contexts ===');
[...flow.matchAll(/romanWord|transliteration|isCJK|furigana|ruby|kanji|CJK|\.split\(|fromCodePoint|charCodeAt/gi)].forEach((m, i) => {
  const start = Math.max(0, m.index - 220);
  const end = Math.min(flow.length, m.index + 380);
  console.log(`\n--- match[${i}] @${m.index} "${m[0]}" ---`);
  console.log(flow.slice(start, end));
});

// Also dump normalizeWord / normalizeLine area from flow/lyric-player if found
// Already have in _lb_lyric-player.js. Now look for render/layout of rt/furigana span.
