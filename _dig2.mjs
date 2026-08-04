// Extract Wn (CJK detector) + full w1 body + buildWord/createWord area
import fs from 'node:fs';
const core = fs.readFileSync('_lb_amll-core.js', 'utf8');

// 1) Find Wn definition (used like Wn(p) && p.length>1)
console.log('=== Wn / isCJK definition area (grep Wn= / function Wn) ===');
const wnIdx = core.indexOf('Wn(') > -1 ? core.indexOf('function Wn') : -1;
const wnIdx2 = core.search(/Wn\s*=\s*(?!undefined)/);
if (wnIdx > -1) console.log(core.slice(Math.max(0, wnIdx - 80), wnIdx + 500));
else if (wnIdx2 > -1) console.log(core.slice(Math.max(0, wnIdx2 - 200), wnIdx2 + 500));

// 2) Full w1 function body
console.log('\n\n=== w1 function full body ===');
const w1Start = core.indexOf('function w1(r)');
if (w1Start > -1) {
  // find matching closing brace:
  let depth = 0, i = w1Start;
  let foundOpen = false;
  while (i < core.length) {
    if (core[i] === '{') { depth++; foundOpen = true; }
    else if (core[i] === '}') {
      depth--;
      if (foundOpen && depth === 0) { console.log(core.slice(w1Start, i + 1)); break; }
    }
    i++;
  }
}

// 3) createWord function full body
console.log('\n\n=== createWord function full body ===');
const cwStart = core.search(/createWord\s*\(\s*t\s*,\s*e\s*,\s*i\s*,\s*s\s*\)/);
if (cwStart > -1) {
  let depth = 0, i = cwStart;
  let foundOpen = false;
  while (i < core.length) {
    if (core[i] === '{') { depth++; foundOpen = true; }
    else if (core[i] === '}') {
      depth--;
      if (foundOpen && depth === 0) { console.log(core.slice(cwStart, i + 1)); break; }
    }
    i++;
  }
}
