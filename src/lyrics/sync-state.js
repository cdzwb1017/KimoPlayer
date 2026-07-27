export function getLineEnd(line) {
  return line.endTime || (line.words && line.words.length > 0
    ? line.words[line.words.length - 1].time + 0.5
    : line.time + 3.0);
}

export function isOverlappingInTime(lineA, lineB) {
  return (lineA.time < getLineEnd(lineB)) && (lineB.time < getLineEnd(lineA));
}

export function calculateActiveLineState(lines, currentTime) {
  const activeIndices = [];
  let activeIndex = -1;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const endBoundary = line.isInterlude
      ? Math.max(line.endTime + 0.4, (lines[index + 1]?.time ?? 0) + 0.5)
      : line.endTime + 0.4;
    if (currentTime >= line.time - 0.5 && currentTime <= endBoundary) {
      activeIndices.push(index);
    }
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
      laneEndTimes.push(line.endTime);
    } else {
      laneEndTimes[assignedLane] = line.endTime;
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

  let scrollIndex = activeIndex;
  for (let index = lines.length - 1; index >= 0; index--) {
    if (currentTime >= lines[index].time - 0.5) {
      if (index > scrollIndex) {
        scrollIndex = index;
      }
      break;
    }
  }
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
