import { parseJSONLyrics, parseTTML } from '../../lyrics.js';
import {
  formatLrcTime,
  formatLrcTimePrefix,
  formatTTMLTime,
  parseMinSecMsToSeconds,
} from '../../utils/time.js';

function escapeXml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseEditableLrc(rawText) {
  const lines = rawText.split('\n');
  const tempRows = [];
  let isEnhanced = false;

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) return;

    const rowTimeMatch = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (!rowTimeMatch) {
      tempRows.push({ time: 0, text: line, translation: null });
      return;
    }

    const rowTime = parseInt(rowTimeMatch[1], 10) * 60 + parseFloat(rowTimeMatch[2]);
    const remainingText = rowTimeMatch[3].trim();
    const inlineTimeRegex = /(?:<|\[)(\d+:\d+(?:\.\d+)?)(?:>|\])/;

    if (!inlineTimeRegex.test(remainingText)) {
      tempRows.push({ time: rowTime, text: remainingText, translation: null });
      return;
    }

    isEnhanced = true;
    const words = [];
    const wordRegex = /([^<\[]+)(?:<|\[)(\d+:\d+(?:\.\d+)?)(?:>|\])/g;
    let match;
    let lastEndTime = rowTime;

    while ((match = wordRegex.exec(remainingText)) !== null) {
      let wordText = match[1];
      const wordEndTime = parseMinSecMsToSeconds(match[2]);
      const duration = Math.max(0, wordEndTime - lastEndTime);
      const hasCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(wordText);

      if (hasCJK) {
        wordText = wordText.trim();
      }

      words.push({
        time: lastEndTime,
        duration,
        text: wordText,
      });
      lastEndTime = wordEndTime;
    }

    if (words.length > 0) {
      tempRows.push({
        time: rowTime,
        text: remainingText,
        words,
        end: lastEndTime,
        translation: null,
      });
    } else {
      tempRows.push({ time: rowTime, text: remainingText, translation: null });
    }
  });

  const list = [];
  tempRows.forEach(row => {
    if (list.length > 0) {
      const lastRow = list[list.length - 1];
      if (Math.abs(row.time - lastRow.time) <= 0.15 && !lastRow.translation) {
        let textVal = row.text || '';
        let transEndTime = null;
        const tailTimeMatch = textVal.match(/^(.*?)\s*(?:\[|<)(\d+:\d+(?:\.\d+)?)(?:\]|>)\s*$/);

        if (tailTimeMatch) {
          textVal = tailTimeMatch[1].trim();
          transEndTime = parseMinSecMsToSeconds(tailTimeMatch[2]);
        }

        lastRow.translation = textVal;
        lastRow.translationTime = row.time;
        if (transEndTime) {
          lastRow.translationEnd = transEndTime;
        }
        return;
      }
    }

    list.push(row);
  });

  return {
    type: isEnhanced ? 'enhanced-lrc' : 'lrc',
    lyrics: list,
  };
}

export function parseEditableLyrics(rawText) {
  try {
    const parsed = parseJSONLyrics(rawText);
    if (parsed && parsed.length > 0 && parsed.some(item => item.words)) {
      return { type: 'json', lyrics: parsed };
    }
  } catch (error) {
    // Not JSON; continue trying other formats.
  }

  if (rawText.includes('<tt') || rawText.includes('xmlns="http://www.w3.org/ns/ttml"')) {
    return { type: 'ttml', lyrics: parseTTML(rawText) };
  }

  return parseEditableLrc(rawText);
}

export function serializeTTML(lyricsList) {
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<tt xml:lang="zh" xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">\n';
  xml += '  <head>\n    <metadata>\n      <ttm:title>Lyrics</ttm:title>\n    </metadata>\n  </head>\n  <body>\n    <div>\n';

  lyricsList.forEach(row => {
    const pBegin = formatTTMLTime(row.time);
    const pEnd = row.end ? formatTTMLTime(row.end) : null;
    let pAttr = `begin="${pBegin}"`;
    if (pEnd) pAttr += ` end="${pEnd}"`;
    if (row.tag) pAttr += ` ttm:role="${row.tag}"`;

    xml += `      <p ${pAttr}>`;

    if (row.words && Array.isArray(row.words) && row.words.length > 0) {
      xml += '\n';
      row.words.forEach((word, index) => {
        const wordBegin = formatTTMLTime(word.time);
        const nextTime = index < row.words.length - 1
          ? row.words[index + 1].time
          : row.end || (word.time + (word.duration || 0.1));
        const wordEnd = formatTTMLTime(nextTime);
        xml += `        <span begin="${wordBegin}" end="${wordEnd}">${escapeXml(word.text)}</span>\n`;
      });
      xml += '      </p>\n';
    } else {
      xml += `${escapeXml(row.text)}</p>\n`;
    }
  });

  xml += '    </div>\n  </body>\n</tt>';
  return xml;
}

export function serializeEditableLyrics({ lyricsList, lyricsType }) {
  if (lyricsType === 'ttml') {
    return serializeTTML(lyricsList);
  }

  if (lyricsType === 'json') {
    const list = lyricsList.map(row => {
      let rowText = row.text;
      if (row.words && Array.isArray(row.words)) {
        rowText = row.words.map(word => word.text).join('');
      }

      return {
        time: row.time,
        text: rowText,
        tag: row.tag || null,
        translation: row.translation || null,
        end: row.end || null,
        words: row.words ? row.words.map(word => ({
          time: word.time,
          duration: word.duration,
          text: word.text,
        })) : null,
      };
    });

    return JSON.stringify({ lyrics: list });
  }

  const resultLines = [];
  lyricsList.forEach(row => {
    const rowTimeStr = formatLrcTimePrefix(row.time);

    if (lyricsType === 'enhanced-lrc' && row.words && Array.isArray(row.words)) {
      const wordParts = row.words.map(word => {
        const endTimeStr = formatLrcTime(word.time + (word.duration || 0));
        return `${word.text || ''}[${endTimeStr}]`;
      }).join('');
      resultLines.push(`${rowTimeStr}${wordParts}`);
    } else {
      resultLines.push(`${rowTimeStr}${row.text || ''}`);
    }

    if (row.translation !== null && row.translation !== undefined) {
      const transTimeStr = formatLrcTimePrefix(row.translationTime ?? row.time);
      const transEndTimeStr = row.translationEnd !== undefined && row.translationEnd !== null
        ? `[${formatLrcTime(row.translationEnd)}]`
        : '';
      resultLines.push(`${transTimeStr}${row.translation}${transEndTimeStr}`);
    }
  });

  return resultLines.join('\n');
}
