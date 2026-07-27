export function initializeProgressScrubbing(player) {
  const getDuration = () => {
    const audioDur = player.audio.duration;
    if (audioDur && isFinite(audioDur) && audioDur > 0) return audioDur;
    const song = player.playlist && player.playlist[player.currentIndex];
    return song && song.duration ? song.duration : 0;
  };

  const setupProgressScrubbing = (trackEl, fillEl) => {
    let isDragging = false;
    let didMove = false;
    let wasPlayingBeforeDrag = false;
    let clickPercent = 0;
    let downX = 0;
    let downTime = 0;
    let dragStartTime = 0;
    const MOVE_THRESHOLD = 5;
    const SHORT_PRESS_MS = 400;

    const handleStart = (e) => {
      if (e.type !== 'touchstart') {
        e.preventDefault();
      }
      const duration = getDuration();
      if (!duration) return;

      isDragging = true;
      didMove = false;

      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      downX = clientX;
      downTime = Date.now();

      wasPlayingBeforeDrag = !player.audio.paused;
      if (wasPlayingBeforeDrag) {
        player.audio.pause();
      }

      const rect = trackEl.getBoundingClientRect();
      clickPercent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      dragStartTime = player.audio.currentTime;
      trackEl.classList.add('is-dragging');
    };

    const handleMove = (e) => {
      const duration = getDuration();
      if (!isDragging || !duration) return;

      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;

      if (!didMove && Math.abs(clientX - downX) > MOVE_THRESHOLD) {
        didMove = true;
      }

      if (!didMove) return;
      if (e.type === 'touchmove') e.preventDefault();

      const rect = trackEl.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const deltaPercent = percent - clickPercent;
      const newTime = Math.max(0, Math.min(duration, dragStartTime + deltaPercent * duration));

      player.audio.currentTime = newTime;
      if (fillEl) {
        fillEl.style.width = `${(newTime / duration) * 100}%`;
      }
    };

    const handleEnd = () => {
      const duration = getDuration();
      if (isDragging && duration) {
        if (!didMove && (Date.now() - downTime) < SHORT_PRESS_MS) {
          player.audio.currentTime = clickPercent * duration;
        }
        if (wasPlayingBeforeDrag) {
          player.audio.play().catch(err => console.error('Resume failed:', err));
        }
      }
      isDragging = false;
      wasPlayingBeforeDrag = false;
      trackEl.classList.remove('is-dragging');
    };

    trackEl.addEventListener('mousedown', handleStart);
    trackEl.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchend', handleEnd);

    trackEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const duration = getDuration();
      if (!duration) return;
      const delta = e.deltaY < 0 ? 3 : -3;
      const newTime = Math.max(0, Math.min(duration, player.audio.currentTime + delta));
      player.audio.currentTime = newTime;
      if (fillEl) {
        fillEl.style.width = `${(newTime / duration) * 100}%`;
      }
    }, { passive: false });
  };

  const lyricsProgressTrack = document.getElementById('lyrics-progress-track');
  const lyricsProgressBar = document.getElementById('lyrics-progress-bar');
  if (lyricsProgressTrack) {
    setupProgressScrubbing(lyricsProgressTrack, lyricsProgressBar);
  }

  const mainProgressTrack = document.querySelector('.player-bar .progress-track');
  const mainProgressBar = document.getElementById('progress-bar');
  if (mainProgressTrack) {
    setupProgressScrubbing(mainProgressTrack, mainProgressBar);
  }
}
