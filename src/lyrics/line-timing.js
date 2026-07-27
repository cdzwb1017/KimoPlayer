export function updateLyricLineEndTimes(lines) {
  lines.forEach((line, index) => {
    let realWordEnd = line.time + 3.5;

    if (line.charWords && line.charWords.length > 0) {
      const lastWord = line.charWords[line.charWords.length - 1];
      realWordEnd = lastWord.time + (lastWord.duration || 0.4);
    }

    if (index < lines.length - 1) {
      const nextTime = lines[index + 1].time;
      line.endTime = line.isInterlude
        ? nextTime - 0.05
        : Math.max(realWordEnd + 0.3, Math.min(nextTime + 0.6, line.time + 8.0));
    } else {
      line.endTime = realWordEnd + 0.6;
    }
  });
}
