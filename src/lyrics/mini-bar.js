import { calculateKaraokePlayheadState } from './playhead.js';

const scrollTargets = new Set();
let isScrollLoopActive = false;

export function updateTargetProgress(el, container, ratio = 0) {
  if (!el || !container) return;

  const textKey = el.textContent || '';
  // 🌟 仅在文本变动时测量 Layout 尺寸，绝对不在 60fps 循环中触碰 DOM 读取 🌟
  if (el._overflowTextKey !== textKey) {
    el._overflowTextKey = textKey;
    const containerW = container.clientWidth || 0;
    el._overflowDist = Math.max(0, el.scrollWidth - containerW);
    el._currentOffset = el._overflowDist / 2;
    el._lastTransform = 'translate3d(0px, 0, 0)';
    el.style.transform = 'translate3d(0px, 0, 0)';
  }

  el._scrollContainer = container;
  el._targetProgressRatio = ratio;
  scrollTargets.add(el);
  ensureScrollLoopRunning();
}

export function applyOverflowScroll(el, container, progressRatio = 0) {
  updateTargetProgress(el, container, progressRatio);
}

function ensureScrollLoopRunning() {
  if (isScrollLoopActive) return;
  isScrollLoopActive = true;

  function frame() {
    if (scrollTargets.size === 0) {
      isScrollLoopActive = false;
      return;
    }

    scrollTargets.forEach((el) => {
      const container = el._scrollContainer;
      if (!container || !document.contains(el)) {
        scrollTargets.delete(el);
        return;
      }

      const overflow = el._overflowDist || 0;
      if (overflow > 4) {
        const now = performance.now();
        const dt = el._lastTick ? Math.min(0.05, (now - el._lastTick) / 1000) : 0.0166;
        el._lastTick = now;

        const progressRatio = Math.max(0, Math.min(1, el._targetProgressRatio || 0));
        
        // 🌟 居中模式全程 1:1 稳态线性映射：0% 时首字靠左起点，100% 时末字靠右终点，绝对不提前卡停 🌟
        const startOffset = overflow / 2;
        const endOffset = -overflow / 2;
        const targetOffset = startOffset + progressRatio * (endOffset - startOffset);
        
        if (typeof el._currentOffset !== 'number') el._currentOffset = startOffset;
        
        const stepFactor = Math.min(1, dt * 50);
        el._currentOffset += (targetOffset - el._currentOffset) * stepFactor;

        if (Math.abs(el._currentOffset - targetOffset) < 0.01) {
          el._currentOffset = targetOffset;
        }

        const transformVal = `translate3d(${el._currentOffset.toFixed(2)}px, 0, 0)`;
        if (el._lastTransform !== transformVal) {
          el._lastTransform = transformVal;
          el.style.transform = transformVal;
        }
      } else {
        if (el._lastTransform !== '') {
          el._lastTransform = '';
          el.style.transform = '';
          el._currentOffset = 0;
        }
        scrollTargets.delete(el);
      }
    });

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

export function syncMiniBarSpans({ cachedSpans, charWords, currentTime }) {
  let barWordSpans = cachedSpans;

  if (!barWordSpans || barWordSpans.length === 0) {
    barWordSpans = Array.from(document.querySelectorAll('#bar-lyric-text-1 .lyrics-word'));
  }

  if (barWordSpans.length === 0) {
    return barWordSpans;
  }

  // 统一计算播放头
  const { charC, totalChars } = calculateKaraokePlayheadState(charWords || [], currentTime || 0);

  const el1 = document.getElementById('bar-lyric-text-1');
  const transEl1 = document.getElementById('bar-lyric-translation-1');
  const line1 = document.getElementById('bar-lyric-line-1');
  const ratio = totalChars > 0 ? Math.max(0, Math.min(1, charC / totalChars)) : 0;
  if (el1 && line1) applyOverflowScroll(el1, line1, ratio);
  if (transEl1 && line1) applyOverflowScroll(transEl1, line1, ratio);

  for (let index = 0; index < barWordSpans.length; index += 1) {
    const barSpan = barWordSpans[index];
    if (!barSpan) continue;

    let fill;
    if (charC < 0) {
      fill = 0;
    } else if (charC >= totalChars) {
      fill = 100;
    } else {
      const intPart = Math.floor(charC);
      if (index < intPart) fill = 100;
      else if (index > intPart) fill = 0;
      else fill = (charC - intPart) * 100;
    }

    const clamped = Math.max(0, Math.min(100, fill));
    const charFillVal = `${clamped.toFixed(1)}%`;

    // ⭐ 值守卫：fill 恒定则跳过写入（每帧省大部分字）
    if (barSpan._lastBarFill !== charFillVal) {
      barSpan._lastBarFill = charFillVal;
      barSpan.style.setProperty('--char-fill', charFillVal);

      let barSubSpans = barSpan._barSubSpans;
      if (!barSubSpans) {
        barSubSpans = Array.from(barSpan.querySelectorAll('span'));
        barSpan._barSubSpans = barSubSpans;
      }

      for (let subIndex = 0; subIndex < barSubSpans.length; subIndex += 1) {
        barSubSpans[subIndex].style.setProperty('--char-fill', charFillVal);
      }
    }

    if (clamped >= 99) {
      barSpan.classList.add('word-singing');
      barSpan.classList.remove('word-active');
    } else if (clamped <= 1) {
      if (barSpan.classList.contains('word-active') || barSpan.classList.contains('word-singing')) {
        barSpan.classList.remove('word-active', 'word-singing');
      }
    } else if (!barSpan.classList.contains('word-singing')) {
      barSpan.classList.add('word-singing');
      barSpan.classList.remove('word-active');
    }
  }

  return barWordSpans;
}

export function updateMiniBarLyrics({ lines, activeIndex, getLineText }) {
  const el1 = document.getElementById('bar-lyric-text-1');
  const el2 = document.getElementById('bar-lyric-text-2');
  const transEl1 = document.getElementById('bar-lyric-translation-1');
  const line1 = document.getElementById('bar-lyric-line-1');

  if (!el1) {
    return [];
  }

  const currentLine = lines[activeIndex];
  const nextLine = lines[activeIndex + 1];

  if (line1) {
    line1.classList.remove('mini-lyric-enter');
    line1.style.removeProperty('transition');
    line1.style.removeProperty('opacity');
  }

  const mainLyricLine = document.querySelector(`#lyrics-lines .lyrics-line[data-index="${activeIndex}"]`);
  if (mainLyricLine) {
    el1.innerHTML = '';
    const clonedMain = mainLyricLine.querySelector('.lyrics-main, .lyrics-interlude')?.cloneNode(true);
    if (clonedMain) {
      while (clonedMain.firstChild) {
        el1.appendChild(clonedMain.firstChild);
      }
    } else {
      el1.textContent = getLineText(currentLine);
    }
  } else {
    el1.textContent = getLineText(currentLine);
  }

  if (transEl1) {
    transEl1.textContent = currentLine?.translation ? currentLine.translation : '';
  }

  if (el2) {
    el2.textContent = getLineText(nextLine);
  }

  const barWordSpans = Array.from(el1.querySelectorAll('.lyrics-word'));
  barWordSpans.forEach(span => {
    span._barSubSpans = null;
    span.classList.add('word-singing');
    span.classList.remove('word-active');
  });

  if (line1) {
    // Force a fresh keyframe run for every line change, including rapid lyrics.
    void line1.offsetWidth;
    line1.classList.add('mini-lyric-enter');
  }

  return barWordSpans;
}
