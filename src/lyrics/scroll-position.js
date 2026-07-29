import { getLyricsPreferences } from './preferences.js';

export function getLyricsScrollAlign() {
  return getLyricsPreferences().scrollAlign;
}

export function getAlignedScrollTop(container, lineEl, alignOffset = getLyricsScrollAlign()) {
  if (!container || !lineEl) return 0;
  const containerHeight = container.clientHeight || container.getBoundingClientRect().height || 500;
  const topSpacerHeight = containerHeight * alignOffset;
  return lineEl.offsetTop - topSpacerHeight;
}

export function getRelativeAlignedScrollTop(container, lineEl, alignOffset = getLyricsScrollAlign()) {
  if (!container || !lineEl) return 0;
  const lineRect = lineEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return container.scrollTop + (lineRect.top - containerRect.top) - containerRect.height * alignOffset;
}

export function clampScrollTop(container, targetOffset) {
  if (!container) return 0;
  const maxScroll = container.scrollHeight - container.clientHeight;
  return Math.max(0, Math.min(maxScroll > 0 ? maxScroll : 0, targetOffset));
}
