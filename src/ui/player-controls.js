export function initializePlayerControls(player) {
  document.getElementById('play-btn')?.addEventListener('click', () => player.toggle());
  document.getElementById('next-btn')?.addEventListener('click', () => player.next());
  document.getElementById('prev-btn')?.addEventListener('click', () => player.prev());

  document.getElementById('play-mode-btn')?.addEventListener('click', () => player.cyclePlayMode());
  document.getElementById('speed-btn')?.addEventListener('click', () => player.cycleSpeed());

  document.getElementById('player-bar-lyric-trigger')?.addEventListener('click', () => player.lyrics.show());

  document.getElementById('lyrics-cover-click-area')?.addEventListener('click', () => player.toggle());
  document.getElementById('lyrics-next-btn')?.addEventListener('click', () => player.next());
  document.getElementById('lyrics-prev-btn')?.addEventListener('click', () => player.prev());
}
