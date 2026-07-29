export function updateLyricLineEndTimes(lines) {
  lines.forEach((line, index) => {
    let realWordEnd = line.time + 3.5;

    // 逐字 LRC 末尾的空时间戳就是权威行结束边界，不应再由
    // 渲染阶段调整过的单词时长反推，否则行状态可能出现细小偏差。
    if (Number.isFinite(line.end) && line.end > line.time) {
      realWordEnd = line.end;
    } else if (line.charWords && line.charWords.length > 0) {
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
