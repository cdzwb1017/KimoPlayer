import { projectPlayheadToRow } from './playhead.js';

const DEFAULT_TRANSITION_RATIO = 0.08;

function clearProgressWord(word) {
  word.classList.remove('word-singing', 'word-active');
  word.style.removeProperty('--line-percent');
  word.style.removeProperty('--char-fill');
  word._lastPercent = null;
}

function completeProgressWord(word) {
  // 保持渐变层直到整行切换为过去状态，避免单元唱满时切换到
  // word-active 的纯色层，从而在相邻单元交界产生闪断。
  word.classList.add('word-singing');
  word.classList.remove('word-active');
  setRowSingingProgress(word, 100);
}

function setRowSingingProgress(word, rowPercent) {
  word.classList.add('word-singing');
  word.classList.remove('word-active');

  const clampedPercent = Math.max(0, Math.min(100, rowPercent));
  const roundedPercent = clampedPercent.toFixed(1);

  if (word._lastPercent !== roundedPercent) {
    word._lastPercent = roundedPercent;
    word.style.setProperty('--line-percent', `${roundedPercent}%`);
  }
}

export function renderRowKaraokeProgress({
  rowsData,
  wordSpans,
  charC,
  totalChars,
  inGap,
  gapPrevIdx,
  currentGapT,
  transitionRatio = DEFAULT_TRANSITION_RATIO,
}) {
  rowsData.forEach(row => {
    const rowWidth = row.width;
    const transitionWidthPx = rowWidth * transitionRatio;

    const playheadX = projectPlayheadToRow({
      row,
      wordSpans,
      charC,
      totalChars,
      inGap,
      gapPrevIdx,
      currentGapT,
      transitionWidthPx,
    });

    const rowPercent = (playheadX / rowWidth) * 100;
    // 像素投影会受字体取整或尚未刷新的 DOM 几何影响。最后一个词刚开始时，
    // playheadX 偶尔已经落到行尾，从而被误判为整行唱完并瞬间染色。
    // 行完成状态应以单调递增的逻辑字符游标为准。
    const rowCompletionPlayhead = row.endIdx + 1;
    const isRowComplete =
      charC >= rowCompletionPlayhead - 0.001 ||
      charC >= totalChars;

    row.words.forEach(word => {
      if (charC <= 0 || playheadX <= 0) {
        clearProgressWord(word);
      } else if (isRowComplete || charC >= totalChars) {
        completeProgressWord(word);
      } else {
        setRowSingingProgress(word, rowPercent);
      }
    });
  });
}

export function renderClassicCharProgress({ wordSpans, charWords, currentTime, charC, totalChars }) {
  const firstCharTime = charWords[0]?.time;

  wordSpans.forEach((span, index) => {
    const charWord = charWords[index];
    if (!charWord) return;

    let fill;
    if (firstCharTime !== undefined && currentTime < firstCharTime + 0.05) {
      fill = 0;
    } else {
      fill = charC < 0
        ? 0
        : charC >= totalChars
          ? 100
          : index < Math.floor(charC)
            ? 100
            : index > Math.floor(charC)
              ? 0
              : (charC - Math.floor(charC)) * 100;
    }

    const clampedFill = Math.max(0, Math.min(100, fill));
    const roundedFill = clampedFill.toFixed(1);

    if (span._lastFill !== roundedFill) {
      span._lastFill = roundedFill;
      span.style.setProperty('--char-fill', `${roundedFill}%`);
    }

    if (fill >= 99.5) {
      // 同一行内保持在渐变渲染层；整行结束后才由行状态统一转为完成态。
      span.classList.add('word-singing');
      span.classList.remove('word-active');
    } else if (fill <= 0.5) {
      span.classList.remove('word-active', 'word-singing');
    } else {
      span.classList.add('word-singing');
      span.classList.remove('word-active');
    }
  });
}
