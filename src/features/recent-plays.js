import { renderAudioQualityBadgesHtml, renderArtistWithBadgesHtml } from '../utils/audio-quality.js';

const RECENT_PLAYS_KEY = 'kimo-recent-plays';
const MAX_RECENT_PLAYS = 50;

export const getRecentPlays = () => {
  try {
    const cached = localStorage.getItem(RECENT_PLAYS_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('[RecentPlays] Failed to read history:', error);
    return [];
  }
};

export const addRecentPlay = (song) => {
  const recents = getRecentPlays().filter(item => item.file_path !== song.file_path);
  recents.unshift(song);
  localStorage.setItem(RECENT_PLAYS_KEY, JSON.stringify(recents.slice(0, MAX_RECENT_PLAYS)));
};

export const createRecentPlaysRenderer = ({
  player,
  getCoverSrc,
  renderPlaylist,
  isRecentTab,
}) => {
  const renderRecentPlaysTab = () => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;

    const recents = getRecentPlays();
    if (recents.length === 0) {
      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: var(--text-secondary); gap: 16px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div style="font-size: 14px; font-weight: 500;">暂无播放记录，快去听听歌吧！</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    recents.forEach(song => {
      const div = document.createElement('div');
      const isCurrent = player.currentIndex >= 0
        && player.playlist[player.currentIndex]?.file_path === song.file_path;

      div.className = `song-item${isCurrent ? ' playing' : ''}`;
      div.setAttribute('data-file-path', song.file_path);
      const isPaused = player.audio.paused;
      div.innerHTML = `
        <img src="${getCoverSrc(song.cover_image)}" class="song-cover" />
        <div class="song-info">
          <div class="song-title">${song.title || 'Unknown'}</div>
          <div class="song-artist">${renderArtistWithBadgesHtml(song.artist, song)}</div>
        </div>
        <div class="eq-animation ${isPaused ? 'paused' : ''}">
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
          <div class="eq-bar"></div>
        </div>
        <div class="song-duration">${song.duration ? Math.floor(song.duration / 60) + ':' + (song.duration % 60).toString().padStart(2, '0') : ''}</div>
      `;

      div.addEventListener('click', () => {
        const playlistIndex = player.playlist.findIndex(item => item.file_path === song.file_path);
        if (playlistIndex >= 0) {
          player.play(playlistIndex);
        } else {
          player.playlist.push(song);
          renderPlaylist(player.playlist);
          player.play(player.playlist.length - 1);
        }

        setTimeout(() => {
          if (isRecentTab()) renderRecentPlaysTab();
        }, 60);
      });
      listEl.appendChild(div);
    });
  };

  return renderRecentPlaysTab;
};
