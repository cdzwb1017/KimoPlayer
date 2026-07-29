import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function initializeMetadataSavedSync({
  player,
  renderPlaylist,
  updateHeartButton,
  showToast,
  getCoverSrc,
  extractDominantColor,
  applyDynamicColor,
  getDefaultDynamicColor,
  getColorOptions,
}) {
  listen('metadata-saved', async (event) => {
    const { filePath, title, artist, album, coverPath, removeCover } = event.payload;
    try {
      const updatedMeta = await invoke('read_audio_metadata', { path: filePath });

      if (player?.playlist) {
        const songIdx = player.playlist.findIndex(s => s.file_path === filePath);
        if (songIdx !== -1) {
          const originalSong = player.playlist[songIdx];
          const updatedSong = {
            ...originalSong,
            title: updatedMeta.title || title,
            artist: updatedMeta.artist || artist || '未知艺术家',
            album: updatedMeta.album || album || '未知专辑',
            cover_image: updatedMeta.cover_image || null,
          };

          if (coverPath || removeCover) {
            updatedSong.dominant_color = null;
          }

          player.playlist[songIdx] = updatedSong;
          localStorage.setItem('kimo-playlist-cache', JSON.stringify(player.playlist));
          renderPlaylist(player.playlist);

          if (songIdx === player.currentIndex) {
            player.updateUI(updatedSong);
            updateHeartButton();
            if (player.lyrics && typeof player.lyrics.load === 'function') {
              await player.lyrics.load(filePath);
            }

            if (updatedSong.cover_image) {
              extractDominantColor(getCoverSrc(updatedSong.cover_image), getColorOptions ? getColorOptions() : undefined).then(color => {
                updatedSong.dominant_color = color;
                if (player.currentIndex === songIdx) {
                  applyDynamicColor(color.r, color.g, color.b, getCoverSrc(updatedSong.cover_image));
                }
              });
            } else {
              const defColor = getDefaultDynamicColor();
              applyDynamicColor(defColor.r, defColor.g, defColor.b, getCoverSrc(null));
            }
          }
        }
      }

      showToast('已同步新保存的歌曲元数据与歌词');
    } catch (e) {
      console.error('[MetadataListener] Failed to sync saved data:', e);
    }
  });
}
