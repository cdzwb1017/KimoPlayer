export function updateLyricsVisualizer({
  player,
  audioContext,
  audioSource,
  analyser,
  dataArray,
  visualizerHeights,
}) {
  const visEl = document.getElementById('lyrics-visualizer');
  if (!visEl) {
    return { audioContext, audioSource, analyser, dataArray, visualizerHeights };
  }

  const paused = player.audio.paused;
  if (paused) {
    visEl.classList.remove('playing');
    return { audioContext, audioSource, analyser, dataArray, visualizerHeights };
  }

  visEl.classList.add('playing');

  const bars = visEl.querySelectorAll('.visualizer-bar');
  if (!bars.length) {
    return { audioContext, audioSource, analyser, dataArray, visualizerHeights };
  }

  if (!audioContext) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContextClass();
      player.audio.crossOrigin = 'anonymous';

      audioSource = audioContext.createMediaElementSource(player.audio);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;

      audioSource.connect(analyser);
      analyser.connect(audioContext.destination);

      dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (err) {
      console.warn('[LyricsVisualizer] Web Audio API initialization blocked or failed, using simulated waves:', err);
      audioContext = null;
    }
  }

  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }

  let realDataAvailable = false;
  if (analyser && dataArray) {
    analyser.getByteFrequencyData(dataArray);

    let energy = 0;
    for (let index = 0; index < 24; index += 1) {
      energy += dataArray[index] || 0;
    }
    realDataAvailable = energy > 0;
  }

  if (!visualizerHeights) {
    visualizerHeights = new Float32Array(24);
    visualizerHeights.fill(4);
  }

  const time = performance.now() / 1000;
  const volume = player.audio.volume !== undefined ? player.audio.volume : 0.8;
  const volMod = 0.6 + 0.4 * volume;

  bars.forEach((bar, index) => {
    let amp = 0;

    if (realDataAvailable) {
      const rawAmp = dataArray[index] || 0;
      amp = rawAmp / 255;

      let gain = 1.15;
      if (index > 16) {
        gain = 2.1;
      } else if (index > 6) {
        gain = 1.6;
      }

      amp = 1.0 - Math.exp(-amp * gain);
    } else {
      let wave = 0;
      if (index < 6) {
        wave = Math.sin(time * 3.5 + index * 0.8) * 0.45
          + Math.cos(time * 8.2 - index * 1.2) * 0.35
          + Math.sin(time * 22.0 + index) * 0.2;
      } else if (index < 18) {
        wave = Math.sin(time * 6.8 - index * 0.5) * 0.4
          + Math.cos(time * 14.5 + index * 0.9) * 0.35
          + Math.sin(time * 35.0 - index) * 0.25;
      } else {
        wave = Math.sin(time * 12.0 + index * 1.5) * 0.3
          + Math.cos(time * 28.0 - index * 2.2) * 0.45
          + Math.sin(time * 58.0 + index) * 0.25;
      }

      amp = Math.abs(wave);
      const beatProgress = (player.audio.currentTime * 2.2) % 1.0;
      const punch = 1.2 + 0.4 * Math.exp(-Math.pow(beatProgress - 0.1, 2) * 20);
      amp = Math.min(1.0, amp * punch);
    }

    const minHeight = 4;
    const maxHeight = 54;
    const targetHeight = minHeight + amp * (maxHeight - minHeight) * volMod;
    const currentHeight = visualizerHeights[index] || minHeight;
    const nextHeight = targetHeight > currentHeight
      ? currentHeight + (targetHeight - currentHeight) * 0.92
      : currentHeight - (currentHeight - targetHeight) * 0.22;

    const clampedHeight = Math.max(minHeight, nextHeight);
    visualizerHeights[index] = clampedHeight;
    bar.style.height = `${clampedHeight.toFixed(1)}px`;
  });

  return { audioContext, audioSource, analyser, dataArray, visualizerHeights };
}
