export function initializeLyricsPreferencesControls(player) {
  let currentFontSize = parseFloat(localStorage.getItem('kimo-lyrics-font-size')) || 22;
  const fontSizeSlider = document.getElementById('slider-font-size');
  const fontSizeValue = document.getElementById('lyric-font-size-value');

  const resetLyricsAlignment = () => {
    if (player?.lyrics) player.lyrics.resetAlignmentCache();
  };

  const syncLyricsToCurrentTime = () => {
    if (player?.lyrics && player.audio) {
      player.lyrics.syncToTime(player.audio.currentTime);
    }
  };

  const updateFontSize = (size) => {
    currentFontSize = Math.max(16, Math.min(48, size));
    document.documentElement.style.setProperty('--lyrics-font-size', `${currentFontSize}px`);
    if (fontSizeSlider) fontSizeSlider.value = currentFontSize;
    if (fontSizeValue) fontSizeValue.innerText = `字号: ${currentFontSize.toFixed(1)}px`;
    resetLyricsAlignment();
  };

  if (fontSizeSlider) {
    fontSizeSlider.value = currentFontSize;
    fontSizeSlider.addEventListener('input', (e) => {
      updateFontSize(parseFloat(e.target.value));
    });
    fontSizeSlider.addEventListener('change', (e) => {
      localStorage.setItem('kimo-lyrics-font-size', parseFloat(e.target.value));
    });

    const handleFontSizeWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      const nextVal = Math.max(16, Math.min(48, currentFontSize + delta));
      updateFontSize(nextVal);
      localStorage.setItem('kimo-lyrics-font-size', nextVal);
    };
    fontSizeSlider.addEventListener('wheel', handleFontSizeWheel, { passive: false });
    fontSizeSlider.closest('.lyrics-control-item')?.addEventListener('wheel', handleFontSizeWheel, { passive: false });
  }
  updateFontSize(currentFontSize);

  const savedLineSpacing = localStorage.getItem('kimo-lyrics-line-spacing');
  if (savedLineSpacing !== null && !isNaN(parseFloat(savedLineSpacing))) {
    document.documentElement.style.setProperty('--lyrics-line-spacing', parseFloat(savedLineSpacing));
  }

  let currentFontWeight = parseInt(localStorage.getItem('kimo-lyrics-font-weight'), 10) || 400;
  const fontWeightSlider = document.getElementById('slider-font-weight');
  const fontWeightValue = document.getElementById('lyric-font-weight-value');

  const getWeightLabel = (weight) => {
    if (weight < 250) return '极细';
    if (weight < 350) return '细';
    if (weight < 450) return '常规';
    if (weight < 550) return '中等';
    if (weight < 650) return '半粗';
    if (weight < 750) return '粗';
    return '极粗';
  };

  const updateFontWeight = (weight) => {
    currentFontWeight = Math.max(150, Math.min(900, weight));
    document.documentElement.style.setProperty('--lyrics-font-weight', currentFontWeight);
    if (fontWeightSlider) fontWeightSlider.value = currentFontWeight;
    if (fontWeightValue) fontWeightValue.innerText = `字重: ${getWeightLabel(currentFontWeight)} (${currentFontWeight})`;
    resetLyricsAlignment();
  };

  if (fontWeightSlider) {
    fontWeightSlider.min = 150;
    fontWeightSlider.max = 900;
    fontWeightSlider.step = 1;
    fontWeightSlider.value = currentFontWeight;
    fontWeightSlider.addEventListener('input', (e) => {
      updateFontWeight(parseInt(e.target.value, 10));
    });
    fontWeightSlider.addEventListener('change', () => {
      localStorage.setItem('kimo-lyrics-font-weight', currentFontWeight);
    });

    const handleFontWeightWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      const nextWeight = Math.max(150, Math.min(900, currentFontWeight + delta));
      updateFontWeight(nextWeight);
      localStorage.setItem('kimo-lyrics-font-weight', nextWeight);
    };
    fontWeightSlider.addEventListener('wheel', handleFontWeightWheel, { passive: false });
    fontWeightSlider.closest('.lyrics-control-item')?.addEventListener('wheel', handleFontWeightWheel, { passive: false });
  }
  updateFontWeight(currentFontWeight);

  const alignBtn = document.getElementById('btn-align-toggle');
  const scrollEl = document.getElementById('lyrics-scroll');
  let currentAlign = localStorage.getItem('kimo-lyrics-align') || 'center';

  const applyAlign = (align) => {
    if (!scrollEl || !alignBtn) return;
    if (align === 'left') {
      scrollEl.classList.remove('align-center');
      scrollEl.classList.add('align-left');
      alignBtn.classList.add('left-active');
    } else {
      scrollEl.classList.remove('align-left');
      scrollEl.classList.add('align-center');
      alignBtn.classList.remove('left-active');
    }
    resetLyricsAlignment();
  };

  if (alignBtn) {
    applyAlign(currentAlign);
    alignBtn.addEventListener('click', () => {
      currentAlign = currentAlign === 'center' ? 'left' : 'center';
      localStorage.setItem('kimo-lyrics-align', currentAlign);
      applyAlign(currentAlign);
    });
  }

  let currentTimeOffset = parseFloat(localStorage.getItem('kimo-lyrics-time-offset')) || 0.0;
  const lyricOffsetSlider = document.getElementById('slider-lyric-offset');
  const lyricOffsetValue = document.getElementById('lyric-offset-value');

  const updateOffsetLabel = (val) => {
    if (!lyricOffsetValue) return;
    if (val === 0) {
      lyricOffsetValue.innerText = '无延迟 (0.0s)';
    } else if (val > 0) {
      lyricOffsetValue.innerText = `延迟 +${val.toFixed(1)}s`;
    } else {
      lyricOffsetValue.innerText = `提前 ${val.toFixed(1)}s`;
    }
  };

  if (lyricOffsetSlider) {
    lyricOffsetSlider.value = currentTimeOffset;
    updateOffsetLabel(currentTimeOffset);
    lyricOffsetSlider.addEventListener('input', (e) => {
      updateOffsetLabel(parseFloat(e.target.value));
    });
    lyricOffsetSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      currentTimeOffset = val;
      localStorage.setItem('kimo-lyrics-time-offset', val);
      updateOffsetLabel(val);
      syncLyricsToCurrentTime();
    });

    const handleOffsetWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      const min = parseFloat(lyricOffsetSlider.min) || -5.0;
      const max = parseFloat(lyricOffsetSlider.max) || 5.0;
      const nextVal = Math.max(min, Math.min(max, currentTimeOffset + delta));
      currentTimeOffset = nextVal;
      lyricOffsetSlider.value = nextVal;
      updateOffsetLabel(nextVal);
      localStorage.setItem('kimo-lyrics-time-offset', nextVal);
      syncLyricsToCurrentTime();
    };
    lyricOffsetSlider.addEventListener('wheel', handleOffsetWheel, { passive: false });
    lyricOffsetSlider.closest('.lyrics-control-item')?.addEventListener('wheel', handleOffsetWheel, { passive: false });
  }

  let currentScrollAlign = parseFloat(localStorage.getItem('kimo-lyrics-scroll-align')) || 0.5;
  const lyricAlignSlider = document.getElementById('slider-lyric-align');
  const lyricAlignValue = document.getElementById('lyric-align-value');

  const updateAlignLabel = (val) => {
    if (!lyricAlignValue) return;
    const percentage = Math.round(val * 100);
    if (val === 0.35) {
      lyricAlignValue.innerText = `默认居中偏上 (${percentage}%)`;
    } else if (val < 0.35) {
      lyricAlignValue.innerText = `偏上 (${percentage}%)`;
    } else {
      lyricAlignValue.innerText = `偏下 (${percentage}%)`;
    }
  };

  if (lyricAlignSlider) {
    lyricAlignSlider.value = currentScrollAlign;
    updateAlignLabel(currentScrollAlign);

    const applyScrollAlign = (val) => {
      currentScrollAlign = val;
      updateAlignLabel(val);
      localStorage.setItem('kimo-lyrics-scroll-align', val);
      if (player.lyrics) player.lyrics.realign();
    };

    lyricAlignSlider.addEventListener('input', (e) => applyScrollAlign(parseFloat(e.target.value)));
    lyricAlignSlider.addEventListener('change', (e) => applyScrollAlign(parseFloat(e.target.value)));

    const handleAlignWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const min = parseFloat(lyricAlignSlider.min) || 0.1;
      const max = parseFloat(lyricAlignSlider.max) || 0.8;
      const nextVal = Math.max(min, Math.min(max, currentScrollAlign + delta));
      lyricAlignSlider.value = nextVal;
      applyScrollAlign(nextVal);
    };
    lyricAlignSlider.addEventListener('wheel', handleAlignWheel, { passive: false });
    lyricAlignSlider.closest('.lyrics-control-item')?.addEventListener('wheel', handleAlignWheel, { passive: false });
  }

  let currentLiftAmp = parseFloat(localStorage.getItem('kimo-lyrics-lift-amplitude')) ?? 4.0;
  const lyricLiftSlider = document.getElementById('slider-lyric-lift');
  const lyricLiftValue = document.getElementById('lyric-lift-value');

  const updateLiftLabel = (val) => {
    if (!lyricLiftValue) return;
    lyricLiftValue.innerText = `抬起: ${val.toFixed(1)}px`;
  };

  if (lyricLiftSlider) {
    lyricLiftSlider.value = currentLiftAmp;
    updateLiftLabel(currentLiftAmp);

    const applyLift = (val) => {
      currentLiftAmp = val;
      updateLiftLabel(val);
      localStorage.setItem('kimo-lyrics-lift-amplitude', val);
      syncLyricsToCurrentTime();
    };

    lyricLiftSlider.addEventListener('input', (e) => applyLift(parseFloat(e.target.value)));
    lyricLiftSlider.addEventListener('change', (e) => applyLift(parseFloat(e.target.value)));

    const handleLiftWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.5 : -0.5;
      const min = parseFloat(lyricLiftSlider.min) || 0.0;
      const max = parseFloat(lyricLiftSlider.max) || 15.0;
      const nextVal = Math.max(min, Math.min(max, currentLiftAmp + delta));
      lyricLiftSlider.value = nextVal;
      applyLift(nextVal);
    };
    lyricLiftSlider.addEventListener('wheel', handleLiftWheel, { passive: false });
    lyricLiftSlider.closest('.lyrics-control-item')?.addEventListener('wheel', handleLiftWheel, { passive: false });
  }

  const staggerToggleBtn = document.getElementById('btn-stagger-toggle');
  if (staggerToggleBtn) {
    staggerToggleBtn.addEventListener('click', () => {
      if (player.lyrics) {
        player.lyrics.toggleStaggerMode();
        syncLyricsToCurrentTime();
      }
    });
  }

  document.getElementById('lyrics-back-btn')?.addEventListener('click', () => {
    player.lyrics.hide();
  });

  const triggerLyricsShow = () => {
    if (player.currentIndex >= 0) player.lyrics.show();
  };
  document.getElementById('player-meta-trigger')?.addEventListener('click', triggerLyricsShow);
  document.getElementById('player-bar-lyric-trigger')?.addEventListener('click', triggerLyricsShow);
}
