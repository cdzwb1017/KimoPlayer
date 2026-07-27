export function syncMiniBarSpans({ cachedSpans, charC, totalChars }) {
  let barWordSpans = cachedSpans;

  if (!barWordSpans || barWordSpans.length === 0) {
    barWordSpans = Array.from(document.querySelectorAll('#bar-lyric-text-1 .lyrics-word'));
  }

  if (barWordSpans.length === 0) {
    return barWordSpans;
  }

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

    barSpan.style.setProperty('--char-fill', charFillVal);

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

    let barSubSpans = barSpan._barSubSpans;
    if (!barSubSpans) {
      barSubSpans = Array.from(barSpan.querySelectorAll('span'));
      barSpan._barSubSpans = barSubSpans;
    }

    for (let subIndex = 0; subIndex < barSubSpans.length; subIndex += 1) {
      barSubSpans[subIndex].style.setProperty('--char-fill', charFillVal);
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
