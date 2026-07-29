export function getLineEnd(line) {
  return line.endTime || (line.words && line.words.length > 0
    ? line.words[line.words.length - 1].time + 0.5
    : line.time + 3.0);
}

// End boundary used for the actual singing state. `endTime` is intentionally
// padded for scroll/layout warmup, so it must not make adjacent non-overlapping
// lines appear to sing at the same time.
function getActiveLineEnd(line) {
  if (Number.isFinite(line.end)) return line.end;
  if (line.words && line.words.length > 0) {
    const lastWord = line.words[line.words.length - 1];
    const wordEnd = Number.isFinite(lastWord.end)
      ? lastWord.end
      : (Number.isFinite(lastWord.duration) ? lastWord.time + lastWord.duration : null);
    if (Number.isFinite(wordEnd)) return wordEnd;
  }
  return line.endTime || line.time + 3.0;
}

export function isOverlappingInTime(lineA, lineB) {
  return (lineA.time < getLineEnd(lineB)) && (lineB.time < getLineEnd(lineA));
}

export function buildLyricTimeIndex(lines) {
  const starts = [];
  const prefixMaxEnds = [];
  let maxEnd = -Infinity;

  lines.forEach((line, index) => {
    starts.push(line.time);
    const effectiveEnd = line.isInterlude
      ? Math.max(line.endTime + 0.4, (lines[index + 1]?.time ?? 0) + 0.5)
      : line.endTime + 0.4;
    maxEnd = Math.max(maxEnd, effectiveEnd);
    prefixMaxEnds.push(maxEnd);
  });

  return { starts, prefixMaxEnds };
}

function upperBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function calculateActiveLineState(lines, currentTime, timeIndex = null) {
  let activeIndices = [];
  let activeIndex = -1;
  const index = timeIndex || buildLyricTimeIndex(lines);
  const latestPossibleIndex = upperBound(index.starts, currentTime + 0.5) - 1;

  for (let lineIndex = latestPossibleIndex; lineIndex >= 0; lineIndex--) {
    if (index.prefixMaxEnds[lineIndex] < currentTime) break;
    const line = lines[lineIndex];
    const endBoundary = line.isInterlude
      ? Math.max(line.endTime + 0.4, (lines[lineIndex + 1]?.time ?? 0) + 0.5)
      : getActiveLineEnd(line);
    // Ordinary lyric rows use half-open intervals: [begin, end). When one
    // row ends exactly as the next begins, they are consecutive rather than
    // concurrent. The former ±50 ms tolerance made such shared boundaries
    // briefly activate both rows and incorrectly trigger the duet layout.
    const startBoundary = line.isInterlude ? line.time - 0.05 : line.time;
    if (currentTime >= startBoundary && currentTime < endBoundary) {
      activeIndices.unshift(lineIndex);
    }
  }

  // Background vocals follow the foreground phrase lifecycle. They should
  // appear while an overlapping main line is singing, but must collapse as
  // soon as the main phrase ends instead of becoming an independent focus.
  const foregroundActive = activeIndices.filter(index => !lines[index].isBackground);
  const hasForegroundLines = lines.some(line => !line.isBackground);
  if (hasForegroundLines) {
    activeIndices = activeIndices.filter(index => {
      if (!lines[index].isBackground) return true;
      if (foregroundActive.length === 0) return false;
      const background = lines[index];
      const backgroundEnd = getActiveLineEnd(background);
      return foregroundActive.some(foregroundIndex => {
        const foreground = lines[foregroundIndex];
        return foreground.time < backgroundEnd
          && background.time < getActiveLineEnd(foreground);
      });
    });
  }

  const laneEndTimes = [];
  for (const index of activeIndices) {
    const line = lines[index];
    let assignedLane = -1;
    for (let lane = 0; lane < laneEndTimes.length; lane++) {
      if (line.time >= laneEndTimes[lane] - 0.05) {
        assignedLane = lane;
        break;
      }
    }
    if (assignedLane === -1) {
      assignedLane = laneEndTimes.length;
      laneEndTimes.push(getActiveLineEnd(line));
    } else {
      laneEndTimes[assignedLane] = getActiveLineEnd(line);
    }
    line.laneIndex = assignedLane;
  }

  let primaryIndex = -1;
  let primaryTime = -Infinity;
  for (const index of activeIndices) {
    const line = lines[index];
    if (currentTime >= line.time - 0.1 && line.laneIndex === 0 && line.time > primaryTime) {
      primaryTime = line.time;
      primaryIndex = index;
    }
  }
  if (primaryIndex === -1 && activeIndices.length > 0) {
    primaryIndex = activeIndices[0];
  }
  activeIndex = primaryIndex;

  if (activeIndices.length === 0 && activeIndex >= 0) {
    activeIndices.push(activeIndex);
  }

  // During an overlap, keep the established primary lane as the scroll
  // anchor. Scrolling to the newest start immediately would make the
  // previous line jump away at the exact moment the next line begins.
  // Do not use the look-ahead window here. It is useful for preparing rows,
  // but moving the scroll anchor before a line actually starts causes a
  // second correction when that line becomes part of an overlapping group.
  let latestStartedIndex = upperBound(index.starts, currentTime) - 1;
  // An x-bg row is an expandable child of its foreground phrase, never an
  // independent scroll destination. Selecting it when it finishes would
  // scroll toward a row whose height is simultaneously collapsing.
  while (latestStartedIndex >= 0 && lines[latestStartedIndex].isBackground) {
    latestStartedIndex -= 1;
  }
  let scrollIndex = activeIndices.length > 1
    ? activeIndex
    : Math.max(activeIndex, latestStartedIndex);
  if (scrollIndex < 0 && lines.length > 0) {
    scrollIndex = 0;
  }

  return {
    activeIndices,
    activeIndex,
    scrollIndex,
  };
}

export function calculateViewActiveIndices(lines, currentTime) {
  const viewActiveIndices = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const windowStart = line.time - 0.4;
    const windowEnd = getLineEnd(line) + 0.4;
    if (currentTime >= windowStart && currentTime <= windowEnd) {
      viewActiveIndices.push(index);
    }
  }
  return viewActiveIndices;
}

export function calculateLinesToProcess(lines, currentTime, scrollIndex, activeIndices) {
  const linesToProcess = new Set([scrollIndex]);
  activeIndices.forEach(index => {
    linesToProcess.add(index);
    if (index > 0) {
      const previousLine = lines[index - 1];
      if (previousLine && currentTime < previousLine.endTime + 0.4) {
        linesToProcess.add(index - 1);
      }
    }
  });
  return linesToProcess;
}
