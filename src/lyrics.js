// ── LRC Parser (两遍扫描法：先解析所有行，再按时间戳分组合并翻译) ──

export function parseLRC(text) {
  const rawLines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Skip metadata
  const isMetadata = (line) => /^\[(?:ti|ar|al|by|offset|re|ve|id|length):/i.test(line);

  const parseTS = (str) => {
    const m = str.match(/(\d{1,2}):(\d{2})([.:])(\d{1,3})/);
    if (!m) return null;
    let ms = parseInt(m[4]);
    if (m[4].length === 2) ms *= 10;
    if (m[4].length === 1) ms *= 100;
    return parseInt(m[1]) * 60 + parseInt(m[2]) + ms / 1000;
  };

  const getFirstTS = (line) => {
    const m = line.match(/\[(\d{1,2}:\d{2}[.:]\d{1,3})\]/);
    return m ? parseTS(m[1]) : null;
  };

  // Check if line has word-by-word timing: text between [ts] markers
  const hasWordTiming = (line) => {
    const timestamps = line.match(/\[\d{1,2}:\d{2}[.:]\d{1,3}\]/g) || [];
    // [start]whole line[end] is line-timed LRC. Word timing needs at
    // least one additional boundary between the line start and end.
    return timestamps.length >= 3;
  };

  // Parse word-timed line into individual words (syllables)
  // ?� 借鉴 BetterLyrics：syllable 保留原始文本（含空格），不 trim；PrimaryText=Concat 天然保留空格 ?�
  const parseWords = (line) => {
    const words = [];
    const regex = /\[(\d{1,2}:\d{2}[.:]\d{1,3})\]([^\[\]]*)/g;
    let lastTS = null;
    const segments = [...line.matchAll(regex)];

    segments.forEach((match, index) => {
      const time = parseTS(match[1]);
      const text = match[2] || '';
      const nextTime = index + 1 < segments.length
        ? parseTS(segments[index + 1][1])
        : null;
      if (time === null) return;
      lastTS = time;

      if (!text) return;
      if (/^\s+$/.test(text)) {
        // A timed whitespace segment is a gap between visible words, not a
        // karaoke word. Keep the separator on the preceding word while the
        // next visible word's timestamp preserves the actual gap duration.
        const previousWord = words[words.length - 1];
        if (previousWord) {
          if (!/\s$/.test(previousWord.text)) previousWord.text += text;
          previousWord.spaceAfter = true;
        }
        return;
      }

      words.push({
        time,
        end: nextTime,
        text,
        duration: nextTime !== null ? Math.max(0, nextTime - time) : 0,
        spaceAfter: /\s$/.test(text),
      });
    });
    return { words, lastTS };
  };

// Detect if text is primarily Latin (needs spaces between words)
const isLatin = (text) => /^[a-zA-Z\']/.test((text || '').trim());

// ?� 借鉴 BetterLyrics：PrimaryText = Concat(syllables.Text)，空格天然保留在原文中，无需补空格 ?�
const joinWords = (words) => {
  if (!words || words.length === 0) return '';
  return words.map(w => w.text).join('');
};

// ── Pass 1: Parse every line into an entry ──

  // Get plain text from a line (strip all timestamps)
  const getPlainText = (line) => {
    return line.replace(/\[\d{1,2}:\d{2}[.:]\d{1,3}\]/g, '').trim();
  };

  const getLastTS = (line) => {
    const matches = [...line.matchAll(/\[(\d{1,2}:\d{2}[.:]\d{1,3})\]/g)];
    if (matches.length < 2) return null;
    return parseTS(matches[matches.length - 1][1]);
  };

  // ── Pass 1: Parse every line into an entry ──
  const entries = [];
  for (const line of rawLines) {
    if (isMetadata(line)) continue;
    const ts = getFirstTS(line);
    if (ts === null) continue;

    const isWordTimed = hasWordTiming(line);
    const parsed = isWordTimed ? parseWords(line) : null;
    const words = parsed ? parsed.words : null;
    const lastTS = parsed ? parsed.lastTS : getLastTS(line);
    const plainText = isWordTimed ? joinWords(words) : getPlainText(line);

    if (plainText.length === 0) continue;

    entries.push({
      time: ts,
      text: plainText,
      words,
      isWordTimed,
      timingFormat: isWordTimed ? 'word-lrc' : 'lrc',
      end: lastTS,
    });
  }

  // ── Pass 2: Group by timestamp, merge word-timed + plain as main + translation ──
  const result = [];
  const used = new Set();

  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue;

    const entry = entries[i];

    // Look for a partner with the same timestamp (within 0.05s)
    let partnerIdx = -1;
    for (let j = 0; j < entries.length; j++) {
      if (j === i || used.has(j)) continue;
      if (Math.abs(entries[j].time - entry.time) < 0.05) {
        partnerIdx = j;
        break;
      }
    }

    if (partnerIdx >= 0) {
      const partner = entries[partnerIdx];
      used.add(i);
      used.add(partnerIdx);

      // The word-timed one is the main line, the other is translation
      let main, trans;
      if (entry.isWordTimed && !partner.isWordTimed) {
        main = entry; trans = partner;
      } else if (!entry.isWordTimed && partner.isWordTimed) {
        main = partner; trans = entry;
      } else {
        // Both same type: first one is main, second is translation
        main = entry; trans = partner;
      }

      result.push({
        time: main.time,
        text: main.text,
        words: main.words,
        timingFormat: main.timingFormat,
        translation: trans.text,
        translationEnd: trans.end,
        end: main.end,
      });
    } else {
      used.add(i);
      result.push({
        time: entry.time,
        text: entry.text,
        words: entry.words,
        timingFormat: entry.timingFormat,
        translation: null,
        end: entry.end,
      });
    }
  }

  result.sort((a, b) => a.time - b.time);
  return result;
}

function getRobustAttribute(el, attrName) {
  if (!el || !el.attributes) return null;
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    if (attr.name === attrName || attr.name.endsWith(':' + attrName)) {
      return attr.value;
    }
  }
  return el.getAttribute(attrName);
}

export function parseTTML(xmlText) {
  const result = [];
  const transMap = {};

  // Strip any leading/trailing LRC timestamps or non-XML characters to ensure DOMParser gets clean XML
  const startIndex = xmlText.indexOf('<');
  let cleanXml = startIndex >= 0 ? xmlText.substring(startIndex) : xmlText;
  const endIndex = cleanXml.lastIndexOf('>');
  if (endIndex >= 0) {
    cleanXml = cleanXml.substring(0, endIndex + 1);
  }
  cleanXml = cleanXml.trim();

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanXml, "text/xml");
  
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    console.error("[parseTTML Error] XML parsing failed:", parserError.textContent);
  }

  // 1. Extract transliterations (Furigana / Ruby) from <text> nodes in <head>
  const textElements = doc.querySelectorAll("text");
  textElements.forEach(textEl => {
    const lineKey = getRobustAttribute(textEl, "for");
    if (!lineKey) return;
    
    const transWords = [];
    const spanElements = textEl.querySelectorAll("span");
    spanElements.forEach(spanEl => {
      const beginVal = getRobustAttribute(spanEl, "begin");
      const endVal = getRobustAttribute(spanEl, "end");
      const begin = parseTTMLTime(beginVal);
      const end = parseTTMLTime(endVal);
      const text = spanEl.textContent.trim();
      if (begin !== null && end !== null && text) {
        transWords.push({ begin, end, text });
      }
    });
    transMap[lineKey] = transWords;
  });

  // 2. Parse paragraph <p> tags in <body>
  const pElements = doc.querySelectorAll("p");
  pElements.forEach((pEl, rowIdx) => {
    const beginVal = getRobustAttribute(pEl, "begin");
    if (!beginVal) return;
    const begin = parseTTMLTime(beginVal);

    const endVal = getRobustAttribute(pEl, "end");
    const end = endVal ? parseTTMLTime(endVal) : null;

    const key = getRobustAttribute(pEl, "key") || getRobustAttribute(pEl, "id") || "";
    
    let role = getRobustAttribute(pEl, "agent") || getRobustAttribute(pEl, "role") || "";
    const hasBackgroundMarker = (value) => /(?:^|[-_:])(?:xr-)?bg(?:$|[-_:])|background/i.test(value || '');
    const pAttributeValues = pEl.attributes
      ? Array.from(pEl.attributes).map(attribute => attribute.value).join(' ')
      : '';
    let isBackground = hasBackgroundMarker(role)
      || hasBackgroundMarker(pAttributeValues)
      || pEl.classList.contains("background");

    const spans = [];
    const backgroundGroups = [];
    let translation = null;
    let lastNodeWasSpace = false;
    let inParentheticalBackground = false;
    let backgroundWrapperDepth = 0;

    // Recursively process nodes to handle nested span elements and spaceBefore correctly
    const processNode = (node) => {
      if (node.nodeType === 3) { // TEXT_NODE
        const textVal = node.nodeValue;
        if (textVal && /\s/.test(textVal)) {
          lastNodeWasSpace = true;
        }
      } else if (node.nodeType === 1 && node.nodeName.toLowerCase() === "span") { // ELEMENT_NODE
        const spanAttrsRole = getRobustAttribute(node, "role");
        
        if (spanAttrsRole === "x-translation") {
          if (node.parentNode === pEl) {
            translation = node.textContent.trim();
          }
        } else if (spanAttrsRole === "x-bg") {
          // Some TTML writers put the background-vocal marker on a wrapper
          // span rather than on the paragraph itself. Keep it at word level
          // because one paragraph may contain both main and background text.
          const groupStart = spans.length;
          const groupTranslation = Array.from(node.querySelectorAll("span"))
            .find(child => getRobustAttribute(child, "role") === "x-translation")
            ?.textContent.trim() || null;
          backgroundWrapperDepth += 1;
          node.childNodes.forEach(child => processNode(child));
          backgroundWrapperDepth -= 1;
          const groupSpans = spans.splice(groupStart);
          if (groupSpans.length > 0) {
            backgroundGroups.push({ spans: groupSpans, translation: groupTranslation });
          }
        } else {
          const wBegin = parseTTMLTime(getRobustAttribute(node, "begin"));
          const wEnd = parseTTMLTime(getRobustAttribute(node, "end"));
          
          if (wBegin !== null) {
            // ?� 借鉴 BetterLyrics：保留原文（含空格），duration 由 begin/end 推断 ?�
            const rawText = node.textContent;
            // ⭐ 修复：同时检查前一个节点是否是空格，以及当前文本是否以空格开头 ⭐
            const hasLeadingSpace = /^\s/.test(rawText);
            spans.push({
              begin: wBegin,
              end: wEnd,
              text: rawText,
              duration: (wEnd && wBegin) ? (wEnd - wBegin) : 0,
              spaceBefore: lastNodeWasSpace || hasLeadingSpace,
              isBackground: backgroundWrapperDepth > 0
                || inParentheticalBackground
                || rawText.includes('('),
            });
            if (rawText.includes('(')) inParentheticalBackground = true;
            if (rawText.includes(')')) inParentheticalBackground = false;
            lastNodeWasSpace = false;
          } else {
            node.childNodes.forEach(child => processNode(child));
          }
        }
      }
    };

    pEl.childNodes.forEach(child => processNode(child));

    const lineTrans = transMap[key] || [];
    const words = [];
    
    for (const s of spans) {
      let ruby = null;
      if (s.begin !== null && s.end !== null) {
        // ?� 修复：用 filter 取所有匹配的 translit span 并拼接，避免 "何度" 只得到 "なん" 缺 "ど" ?�
        const matchTransAll = lineTrans.filter(t => {
          if (t.begin === null || t.end === null) return false;
          const start = Math.max(t.begin, s.begin);
          const end = Math.min(t.end, s.end);
          const overlap = end - start;
          const tDur = t.end - t.begin;
          if (overlap > 0 && (overlap / tDur) > 0.5) return true;
          if (t.begin >= s.begin - 0.05 && t.end <= s.end + 0.05) return true;
          return false;
        });
        if (matchTransAll.length > 0) {
          ruby = matchTransAll.map(t => t.text).join('');
        }
      }
      words.push({
        time: s.begin,
        end: s.end,
        text: s.text,
        duration: s.duration,
        ruby: ruby,
        spaceBefore: s.spaceBefore,
        isBackground: s.isBackground
      });
    }

    // Extract exact text using cloned element with translation removed
    let text = "";
    if (words.length > 0) {
      const clonedP = pEl.cloneNode(true);
      clonedP.querySelectorAll("span").forEach(s => {
        if (getRobustAttribute(s, "role") === "x-translation") {
          s.remove();
        }
        if (getRobustAttribute(s, "role") === "x-bg") {
          s.remove();
        }
      });
      text = clonedP.textContent.replace(/\s+/g, ' ').trim();

      // Some TTML producers omit the separator text node between adjacent
      // timed spans and rely on xml:space/word boundaries instead. The word
      // parser has already captured those boundaries in `spaceBefore`, so use
      // them to keep the line text consistent with the karaoke renderer.
      if (words.length > 1) {
        const wordText = words.map((word, index) => {
          const value = word.text || '';
          if (index === 0 || !word.spaceBefore || /^\s/.test(value)) return value;
          return ` ${value}`;
        }).join('');
        const normalizedWordText = wordText.replace(/\s+/g, ' ').trim();
        if (normalizedWordText) text = normalizedWordText;
      }
    } else {
      const clonedP = pEl.cloneNode(true);
      clonedP.querySelectorAll("span").forEach(s => {
        if (getRobustAttribute(s, "role") === "x-translation") {
          s.remove();
        }
      });
      text = clonedP.textContent.trim();
    }

    if (text.length > 0) {
      result.push({
        time: begin,
        end,
        text,
        translation,
        words: words.length > 1 ? words : null,
        role,
        isBackground
      });
    }

    // x-bg is a complete secondary lyric row nested inside the main <p>.
    // Emit it separately so it can be positioned, highlighted, and collapsed
    // independently while still sharing the main phrase's timing context.
    backgroundGroups.forEach(group => {
      const groupWords = group.spans.map(s => ({
        time: s.begin,
        end: s.end,
        text: s.text,
        duration: s.duration,
        ruby: null,
        spaceBefore: s.spaceBefore,
        // The emitted row itself carries isBackground. Do not apply the
        // inline background-word treatment a second time.
        isBackground: false,
      }));
      if (groupWords.length === 0) return;
      const groupText = groupWords.map((word, index) => {
        const value = word.text || '';
        return index > 0 && word.spaceBefore && !/^\s/.test(value) ? ` ${value}` : value;
      }).join('').replace(/\s+/g, ' ').trim();
      if (!groupText) return;
      result.push({
        time: groupWords[0].time,
        end: groupWords[groupWords.length - 1].end,
        text: groupText,
        translation: group.translation,
        words: groupWords,
        // Keep the parent singer lane so the background row sits directly
        // below the corresponding main line (left/right), while retaining
        // the background marker for its visual treatment.
        role: role ? `${role} xr-BG` : 'xr-BG',
        isBackground: true,
      });
    });
  });

  // Deduplicate and Sort
  const deduplicated = [];
  const seen = new Set();
  for (const item of result) {
    const key = `${item.time.toFixed(2)}_${item.text.substring(0, 20)}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(item);
    }
  }
  deduplicated.sort((a, b) => a.time - b.time);
  return deduplicated;
}


function parseTTMLTime(timeStr) {
  if (!timeStr) return null;
  const hms = timeStr.match(/^(\d+):(\d+):(\d+)([.:]\d+)?$/);
  if (hms) return parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3]) + (hms[4] ? parseFloat(hms[4].replace(':', '.')) : 0);
  const ms = timeStr.match(/^(\d+):(\d+)([.:]\d+)?$/);
  if (ms) return parseInt(ms[1]) * 60 + parseInt(ms[2]) + (ms[3] ? parseFloat(ms[3].replace(':', '.')) : 0);
  const secMatch = timeStr.match(/^(\d+\.?\d*)s?$/);
  if (secMatch) return parseFloat(secMatch[1]);
  return null;
}

export function parseJSONLyrics(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    const list = data.lyrics || [];
    return list.map(item => {
      const words = (item.words || item.syllables || []).map(w => ({
        time: parseFloat(w.time),
        duration: w.duration ? parseFloat(w.duration) : null,
        text: w.text
      }));
      return {
        time: parseFloat(item.time),
        text: item.text,
        words: words.length > 0 ? words : null,
        translation: item.translation || null,
        end: item.end ? parseFloat(item.end) : null
      };
    });
  } catch (e) {
    return [];
  }
}
