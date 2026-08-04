const CREDIT_LABEL_PATTERN = /^(?:(?:作\s*词|填\s*词|词\s*曲|词|作\s*曲|谱\s*曲|编\s*曲|曲|歌词|演\s*唱|歌\s*手|主\s*唱|原\s*唱|翻\s*唱|和\s*声|制\s*作(?:人)?|混\s*音|录\s*音|母\s*带|监\s*制|出\s*品|发行|版权|OP|SP)|(?:lyrics?|lyricist|composer|music|arranger|vocal(?:s|ist)?|singer|artist|producer|mix(?:ed|ing)?|master(?:ed|ing)?|record(?:ed|ing)?|written\s+by))\s*(?:[:：]|$)/iu;

function getLineText(line) {
  if (!line || line.isInterlude) return '';
  if (typeof line.text === 'string' && line.text.trim()) return line.text.trim();
  if (Array.isArray(line.words)) {
    return line.words.map(word => word?.text || '').join('').trim();
  }
  return '';
}

function unwrapText(text) {
  let value = String(text || '').trim();
  const wrappers = [
    ['(', ')'],
    ['（', '）'],
    ['[', ']'],
    ['【', '】'],
  ];

  for (const [open, close] of wrappers) {
    if (value.startsWith(open) && value.endsWith(close)) {
      value = value.slice(open.length, -close.length).trim();
      break;
    }
  }
  return value;
}

function compactIdentity(text) {
  return unwrapText(text)
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\-‐‑‒–—―·•・:：/／\\|｜_[\]【】()（）《》〈〉「」『』“”"'‘’，,。.！!？?]+/gu, '');
}

function isCreditLine(text) {
  return CREDIT_LABEL_PATTERN.test(unwrapText(text));
}

function isSongIdentityLine(text, song, allowSingleField) {
  const value = compactIdentity(text);
  const title = compactIdentity(song?.title);
  const artist = compactIdentity(song?.artist);
  if (!value) return false;

  if (title && artist && (value === `${artist}${title}` || value === `${title}${artist}`)) {
    return true;
  }

  return Boolean(allowSingleField && (
    (title && value === title)
    || (artist && value === artist)
  ));
}

/**
 * Remove non-lyrical title/artist/credit rows without mutating parsed timing
 * objects. Explicitly labelled credits are safe to remove anywhere; bare
 * title/artist rows are only removed from the opening information block.
 */
export function filterLyricInformationLines(lines, { enabled = false, song = null } = {}) {
  if (!enabled || !Array.isArray(lines) || lines.length === 0) return lines;

  const texts = lines.map(getLineText);
  const openingIndices = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => (
      index < 10
      && Number.isFinite(line?.time)
      && line.time <= 35
      && !line.isBackground
    ))
    .map(({ index }) => index);
  const openingSet = new Set(openingIndices);
  const hasOpeningCredits = openingIndices.some(index => isCreditLine(texts[index]));

  return lines.filter((line, index) => {
    const text = texts[index];
    if (!text) return true;
    if (isCreditLine(text)) return false;
    if (!openingSet.has(index)) return true;

    return !isSongIdentityLine(text, song, hasOpeningCredits);
  });
}
