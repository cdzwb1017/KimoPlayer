function getWordSpans(lineEl) {
  if (!lineEl._wordSpans) {
    lineEl._wordSpans = lineEl.querySelectorAll('.lyrics-word');
  }

  return lineEl._wordSpans;
}

function resetFutureWord(word) {
  word.style.setProperty('--char-fill', '-10%');
  word.dataset.fillVal = '-10.0';
  word.classList.remove('word-active', 'word-singing');
  word.style.transition = '';
  word.style.transform = '';
  word.style.setProperty('--word-lift', '0px');
  word.dataset.liftVal = '0.000';
  // 清理 word-effects applyLift 可能残留的动态图层（seek 回退等场景，
  // 收敛中的行被 reset 后不再处理，残留 willChange 会让静止层常驻）
  word.style.willChange = '';
  delete word._liftStableFrames;
}

function completePastWord({ word, lineIndex, liftAmplitude, lines }) {
  word.style.setProperty('--char-fill', '112%');
  word.dataset.fillVal = '112.0';
  word.classList.add('word-active');
  word.classList.remove('word-singing');

  const isBackground = lines[lineIndex]?.isBackground;
  const finalLift = isBackground ? (-liftAmplitude * 0.5) : -liftAmplitude;

  word.style.setProperty('--word-lift', `${finalLift.toFixed(2)}px`);
  word.dataset.liftVal = finalLift.toFixed(3);
  word.style.transform = '';
  word.style.transition = '';
}

export function updateInactiveLineFixedState({
  lineEl,
  lineIndex,
  activeIndices,
  viewActiveIndices,
  linesToProcess,
  currentTime,
  minActiveIndex,
  scrollIndex,
  liftAmplitude,
  lines,
}) {
  const lineTime = lines[lineIndex]?.time || 0;
  const lineEndTime = lines[lineIndex]?.endTime || 0;
  const lineEndWarmup = lineEndTime + 0.4;
  const inWarmup = currentTime <= lineEndWarmup && currentTime > lineTime;

  // 已经唱完的行：currentTime 超过 line.endTime + 0.4s（这一行的所有字都该是 word-active 保持高亮）
  const isPastLine = currentTime > lineEndWarmup;
  // 还没唱到的行：currentTime 还没到 line.time（这一行才是真正的 future，可以 resetFutureWord）
  const isFutureLine = currentTime < lineTime;

  if (!activeIndices.includes(lineIndex)
    && lineIndex !== scrollIndex
    && !linesToProcess.has(lineIndex)
    && isPastLine) {
    const targetState = 'past';
    if (lineEl.dataset.fixedState === targetState) {
      return;
    }

    const words = getWordSpans(lineEl);
    words.forEach(word => {
      completePastWord({
        word,
        lineIndex,
        liftAmplitude,
        lines,
      });
    });

    lineEl.dataset.fixedState = targetState;
    return;
  }

  // 只在用户 seek 回到「这行还没开始唱之前」时，才清掉唱完留下的 past fixedState，允许动画重放。
  // 其他场景（比如播放完自然往后走）不要清！！否则下一段 if 会把唱完的字当 future 去 reset → 褪色
  if (lineEl.dataset.fixedState === 'past' && isFutureLine) {
    delete lineEl.dataset.fixedState;
  } else if (lineEl.dataset.fixedState && lineEl.dataset.fixedState !== 'past' && !inWarmup) {
    // 保留旧逻辑：其他非 past 的临时 fixedState 在 !inWarmup 时清掉
    delete lineEl.dataset.fixedState;
  }

  if (!activeIndices.includes(lineIndex)
    && !linesToProcess.has(lineIndex)
    && lineIndex !== scrollIndex
    && !inWarmup
    && lineIndex >= minActiveIndex
    // ⭐ 关键修复：只对「真正还没播到的未来行」做 resetFutureWord。
    // 已经唱完的 past 行（currentTime > lineEndTime）应该保持 word-active 的完成态高亮，
    // 绝对不能 reset（会把 word-active 清掉 + char-fill 拉回 -10%，字就褪成灰色 unfilled-color = 截图那种）
    && isFutureLine) {
    const words = getWordSpans(lineEl);
    words.forEach(resetFutureWord);
  }
}
