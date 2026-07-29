export function calculateSimpleCharProgress(charWords, currentTime) {
  const totalChars = charWords.length;
  let charC = -1;
  let lastPassedIndex = -1;

  for (let index = 0; index < totalChars; index++) {
    const word = charWords[index];
    if (currentTime >= word.time && currentTime < word.time + word.duration) {
      charC = index + (currentTime - word.time) / word.duration;
      lastPassedIndex = index;
      break;
    } else if (currentTime >= word.time + word.duration) {
      lastPassedIndex = index;
    }
  }

  if (charC === -1) {
    if (lastPassedIndex === -1) charC = 0;
    else if (lastPassedIndex === totalChars - 1) charC = totalChars + 1;
    else charC = lastPassedIndex + 1;
  }

  return charC;
}

export function calculateSmoothCharProgress(charWords, currentTime) {
  const totalChars = charWords.length;
  let charC = -1;
  let lastPassedIndex = -1;

  for (let index = 0; index < totalChars; index++) {
    const word = charWords[index];
    if (currentTime >= word.time && currentTime < word.time + word.duration) {
      charC = index + ((currentTime - word.time) / word.duration);
      lastPassedIndex = index;
      break;
    } else if (currentTime >= word.time + word.duration) {
      lastPassedIndex = index;
    }
  }

  if (charC === -1) {
    if (lastPassedIndex === -1) {
      charC = 0 - ((charWords[0].time - currentTime) / 0.3);
    } else if (lastPassedIndex === totalChars - 1) {
      const lastWord = charWords[lastPassedIndex];
      charC = (lastPassedIndex + 1) + ((currentTime - (lastWord.time + lastWord.duration)) / 0.3);
    } else {
      const previousWord = charWords[lastPassedIndex];
      const nextWord = charWords[lastPassedIndex + 1];
      const gap = nextWord.time - (previousWord.time + previousWord.duration);
      if (gap > 0.08 && currentTime < nextWord.time) {
        charC = lastPassedIndex + 1;
      } else {
        charC = lastPassedIndex + 1;
      }
    }
  }

  return charC;
}

export function calculateKaraokePlayheadState(charWords, currentTime) {
  let charC = -1;
  let inGap = false;
  let gapPrevIdx = -1;
  let currentGapT = 0;

  const totalChars = charWords.length;
  let lastIdx = -1;
  for (let index = 0; index < totalChars; index++) {
    const charWord = charWords[index];
    if (currentTime >= charWord.time && currentTime < (charWord.time + charWord.duration)) {
      charC = index + ((currentTime - charWord.time) / charWord.duration);
      lastIdx = index;
      break;
    } else if (currentTime >= charWord.time + charWord.duration) {
      lastIdx = index;
    }
  }

  if (charC === -1) {
    if (lastIdx === -1) {
      charC = 0 - ((charWords[0].time - currentTime) / 0.3);
    } else if (lastIdx === totalChars - 1) {
      const lastCharWord = charWords[lastIdx];
      charC = (lastIdx + 1) + ((currentTime - (lastCharWord.time + lastCharWord.duration)) / 0.3);
    } else {
      const previousCharWord = charWords[lastIdx];
      const nextCharWord = charWords[lastIdx + 1];
      const gapStart = previousCharWord.time + previousCharWord.duration;
      const gapEnd = nextCharWord.time;
      const gapDuration = gapEnd - gapStart;
      if (gapDuration > 0.001) {
        const t = Math.min(1, Math.max(0, (currentTime - gapStart) / gapDuration));
        inGap = true;
        gapPrevIdx = lastIdx;
        // Keep separator travel linear. Ease-out moved too much at the start
        // and almost stopped at the end, which was especially visible after
        // narrow one-letter English words such as "I" or "a".
        currentGapT = t;
      }
      charC = lastIdx + 1;
    }
  }

  return {
    charC,
    inGap,
    gapPrevIdx,
    currentGapT,
    totalChars,
  };
}

export function projectPlayheadToRow({
  row,
  wordSpans,
  charC,
  totalChars,
  inGap,
  gapPrevIdx,
  currentGapT,
  transitionWidthPx,
}) {
  const rowWidth = row.width;
  const rowLeft = row.left;

  if (charC <= 0) {
    return 0 - transitionWidthPx - 20;
  }

  if (charC >= totalChars) {
    const lastWordWidth = row.words[row.words.length - 1]?.offsetWidth || 40;
    return rowWidth + (charC - totalChars) * lastWordWidth + 10;
  }

  if (charC >= row.startIdx && charC <= row.endIdx + 1) {
    if (inGap && gapPrevIdx >= row.startIdx && gapPrevIdx <= row.endIdx) {
      const prevSpan = wordSpans[gapPrevIdx];
      const nextSpan = wordSpans[gapPrevIdx + 1];
      if (prevSpan && nextSpan) {
        const nextWordIsOnThisRow = row.words.includes(nextSpan);
        if (!nextWordIsOnThisRow) {
          // A wrapped line restarts from the opposite horizontal edge. Never
          // interpolate the completed row toward that coordinate, otherwise
          // its karaoke fill visibly runs backwards during the inter-row gap.
          return rowWidth + 1;
        }
        const prevRight = prevSpan.offsetLeft - rowLeft + prevSpan.offsetWidth;
        const nextLeft = nextSpan.offsetLeft - rowLeft;
        return prevRight + (nextLeft - prevRight) * currentGapT;
      }
      if (prevSpan) {
        return rowWidth + 1;
      }
      return 0;
    }

    const currentInt = Math.floor(charC);
    const currentDec = charC - currentInt;
    const activeSpan = wordSpans[currentInt];
    if (activeSpan) {
      return activeSpan.offsetLeft - rowLeft + activeSpan.offsetWidth * currentDec;
    }
    return 0;
  }

  if (charC < row.startIdx) {
    const distance = row.startIdx - charC;
    const firstWordWidth = row.words[0]?.offsetWidth || 40;
    return 0 - distance * firstWordWidth;
  }

  const distance = charC - (row.endIdx + 1);
  const lastWordWidth = row.words[row.words.length - 1]?.offsetWidth || 40;
  return rowWidth + distance * lastWordWidth;
}
