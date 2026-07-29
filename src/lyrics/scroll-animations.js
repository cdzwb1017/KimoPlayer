import { getLyricsScrollAlign } from './scroll-position.js';

export function staggeredScrollToLine({
  lineEl,
  scrollTimers,
  scrollAnimation,
  setAutoScrolling,
  setScrollTimers,
  setScrollAnimation,
}) {
  const container = document.getElementById('lyrics-scroll');
  const containerRect = container.getBoundingClientRect();
  const lineRect = lineEl.getBoundingClientRect();
  const alignOffset = getLyricsScrollAlign();
  const targetScroll = container.scrollTop + (lineRect.top - containerRect.top) - containerRect.height * alignOffset;
  const totalDiff = targetScroll - container.scrollTop;

  if (Math.abs(totalDiff) < 2) return;

  if (scrollTimers) {
    scrollTimers.forEach(timer => clearTimeout(timer));
  }
  if (scrollAnimation) cancelAnimationFrame(scrollAnimation);

  const nextTimers = [];
  setScrollTimers(nextTimers);

  const steps = 5;
  const stepDelay = 100;
  const stepDuration = 400;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  for (let index = 0; index < steps; index += 1) {
    const stepAmount = totalDiff / steps;
    const timer = setTimeout(() => {
      const startPos = container.scrollTop;
      const startTime = performance.now();

      const animate = now => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / stepDuration);
        container.scrollTop = startPos + stepAmount * easeOut(progress);

        if (progress < 1) {
          setScrollAnimation(requestAnimationFrame(animate));
        } else if (index === steps - 1) {
          setAutoScrolling(false);
        }
      };

      setScrollAnimation(requestAnimationFrame(animate));
    }, index * stepDelay);

    nextTimers.push(timer);
  }
}

export function smoothScrollToLine({
  lineEl,
  scrollAnimation,
  setAutoScrolling,
  setScrollAnimation,
}) {
  const container = document.getElementById('lyrics-scroll');
  const containerRect = container.getBoundingClientRect();
  const lineRect = lineEl.getBoundingClientRect();
  const alignOffset = getLyricsScrollAlign();
  const targetScroll = container.scrollTop + (lineRect.top - containerRect.top) - containerRect.height * alignOffset;
  const startScroll = container.scrollTop;
  const diff = targetScroll - startScroll;

  if (Math.abs(diff) < 2) return;

  if (scrollAnimation) cancelAnimationFrame(scrollAnimation);

  const duration = 900;
  const startTime = performance.now();
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  const step = now => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    container.scrollTop = startScroll + diff * easeOutCubic(progress);

    if (progress < 1) {
      setScrollAnimation(requestAnimationFrame(step));
    } else {
      setAutoScrolling(false);
    }
  };

  setScrollAnimation(requestAnimationFrame(step));
}
