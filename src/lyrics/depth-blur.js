import { getLyricsPreferences } from './preferences.js';

export function shouldEnableDepthBlur() {
  const isPerfMode = document.body.classList.contains('perf-mode') || localStorage.getItem('kimo-performance-mode') === 'true';
  return getLyricsPreferences().blurEnabled && !isPerfMode;
}

export function applyDepthBlur({
  activeIndices,
  scrollIdx,
  activeIndex,
  allLines,
}) {
  const normalizedActive = Array.isArray(activeIndices)
    ? activeIndices
    : (activeIndices !== undefined && activeIndices !== null ? [activeIndices] : []);
  const normalizedScrollIdx = scrollIdx ?? normalizedActive[0] ?? 0;
  const foregroundActive = normalizedActive.filter(index => {
    const line = allLines[index];
    return line && !line.classList.contains('is-background-line');
  });
  // Blur should follow the newest foreground phrase immediately, even while
  // the scroll anchor intentionally remains on an overlapping previous line.
  const currentPrimaryIdx = foregroundActive.length > 0
    ? Math.max(...foregroundActive)
    : (activeIndex >= 0 ? activeIndex : normalizedScrollIdx);
  const isBlurEnabled = shouldEnableDepthBlur();

  const container = document.getElementById('lyrics-scroll') || document.querySelector('.lyrics-scroll-container');
  if (container) {
    container.classList.toggle('has-depth-blur', isBlurEnabled);
  }

  if (!isBlurEnabled) {
    allLines.forEach(el => {
      el.classList.remove('depth-1', 'depth-2', 'depth-3', 'depth-past');
      el.style.removeProperty('filter');
      el.style.opacity = '1';
      el._lastFilter = null;
      el._lastOpacity = '1';
    });
    return;
  }

  allLines.forEach((el, idx) => {
    let newOpacity;

    if (normalizedActive.includes(idx) || idx === normalizedScrollIdx || idx === currentPrimaryIdx) {
      el.classList.remove('depth-1', 'depth-2', 'depth-3', 'depth-past');
      newOpacity = '1';
    } else if (idx < currentPrimaryIdx) {
      el.classList.add('depth-past');
      el.classList.remove('depth-1', 'depth-2', 'depth-3');
      const distance = currentPrimaryIdx - idx;
      if (distance === 1) el.classList.add('depth-1');
      else if (distance === 2) el.classList.add('depth-2');
      else if (distance >= 3) el.classList.add('depth-3');
      newOpacity = `${Math.max(0.4, 1 - distance * 0.15).toFixed(2)}`;
    } else {
      const distance = idx - currentPrimaryIdx;
      el.classList.remove('depth-past', 'depth-1', 'depth-2', 'depth-3');
      if (distance === 1) el.classList.add('depth-1');
      else if (distance === 2) el.classList.add('depth-2');
      else if (distance >= 3) el.classList.add('depth-3');

      newOpacity = `${Math.max(0.25, 1 - distance * 0.15).toFixed(2)}`;
    }

    if (el.style.filter) {
      el.style.removeProperty('filter');
      el._lastFilter = null;
    }

    if (el._lastOpacity !== newOpacity) {
      el.style.opacity = newOpacity;
      el._lastOpacity = newOpacity;
    }
  });
}

export function clearDepthBlur(lines) {
  const container = document.getElementById('lyrics-scroll') || document.querySelector('.lyrics-scroll-container');
  if (container) {
    container.classList.remove('has-depth-blur');
  }
  lines.forEach(el => {
    el.classList.remove('depth-1', 'depth-2', 'depth-3', 'depth-past');
    el.style.filter = 'none';
    el.style.opacity = '1';
    el._lastFilter = 'none';
    el._lastOpacity = '1';
  });
}

export function markDepthBlurDirty(lines) {
  lines.forEach(el => {
    el._lastFilter = null;
    el._lastOpacity = null;
  });
}
