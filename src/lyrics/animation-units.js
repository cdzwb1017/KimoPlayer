export function aggregateLatinWords(words) {
  if (!words || words.length === 0) return [];

  const isLatin = (text) => /^[a-zA-Z']/.test(text.trim());
  const result = [];

  words.forEach((word) => {
    if (result.length === 0) {
      result.push({ ...word });
      return;
    }

    const last = result[result.length - 1];
    const lastText = last.text || '';
    const currentText = word.text || '';
    const hasSpaceBetween = lastText.endsWith(' ') || currentText.startsWith(' ') || word.spaceBefore || last.spaceAfter;

    if (isLatin(lastText) && isLatin(currentText) && !hasSpaceBetween) {
      last.text += word.text;
      const duration = word.duration || 0;
      if (word.time !== null && last.time !== null) {
        last.duration = (word.time + duration) - last.time;
      } else {
        last.duration = (last.duration || 0) + duration;
      }
      if (word.ruby) {
        last.ruby = (last.ruby || '') + word.ruby;
      }
    } else {
      result.push({ ...word });
    }
  });

  return result;
}

export function splitLatinWordsToChars(words) {
  if (!words || words.length === 0) return [];

  const result = [];
  words.forEach((word) => {
    const text = word.text || '';
    const chars = Array.from(text);
    const count = chars.length;
    if (count === 0) return;

    const wordDuration = Math.max(0.05, word.duration || 0.3);
    const charDuration = wordDuration / count;
    chars.forEach((char, index) => {
      const isSpace = /^\s$/.test(char);
      result.push({
        time: (word.time || 0) + index * charDuration,
        duration: charDuration,
        text: char,
        isCharLevel: true,
        isSpace,
      });
    });
  });

  return result;
}

export function synthesizePerCharWords(line, nextLine) {
  const text = line.text || '';
  const chars = Array.from(text);
  const count = chars.length;
  if (count === 0) return [];

  let lineEnd = (line.end && line.end > line.time + 0.05) ? line.end : 0;
  if (!lineEnd) {
    lineEnd = nextLine ? nextLine.time : line.time + 3.0;
  }

  const lineEndClamped = Math.max(lineEnd, line.time + 0.5);
  const lineDuration = lineEndClamped - line.time;
  const charDuration = lineDuration / count;
  line.end = lineEndClamped;

  return chars.map((char, index) => {
    const isSpace = /^\s$/.test(char);
    return {
      time: line.time + index * charDuration,
      duration: charDuration,
      text: char,
      isCharLevel: true,
      isSpace,
    };
  });
}

export function getLyricLineText(line) {
  return line ? (line.isInterlude ? '...' : (line.text || '')) : '';
}
