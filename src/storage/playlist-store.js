const PLAYLISTS_KEY = 'kimo-playlists';

export function getPlaylists() {
  try {
    return JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function savePlaylists(playlists) {
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
}

export function generatePlaylistId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function parseM3U(content) {
  const lines = content.split(/\r?\n/);
  const songs = [];
  let playlistName = null;
  let currentMetadata = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === '\r') continue;

    if (line.startsWith('#PLAYLIST:')) {
      playlistName = line.slice('#PLAYLIST:'.length).trim() || null;
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/^#EXTINF:([^,]*),(.+)$/);
      if (match) {
        const duration = parseFloat(match[1]) || 0;
        const label = match[2].trim();
        const separator = label.lastIndexOf(' - ');
        currentMetadata = {
          artist: separator > 0 ? label.slice(0, separator).trim() : '',
          title: separator > 0 ? label.slice(separator + 3).trim() : label,
          duration: Math.round(duration),
        };
      }
      continue;
    }

    if (line.startsWith('#')) continue;

    const entry = { file_path: line.replace(/\\/g, '/') };
    if (currentMetadata) {
      Object.assign(entry, currentMetadata);
      currentMetadata = null;
    } else {
      const name = line.replace(/^.*[/\\]/, '').replace(/\.[^.]+$/, '');
      const separator = name.lastIndexOf(' - ');
      entry.artist = separator > 0 ? name.slice(0, separator).trim() : '';
      entry.title = separator > 0 ? name.slice(separator + 3).trim() : name;
      entry.duration = 0;
    }
    songs.push(entry);
  }

  return { name: playlistName || '导入的歌单', songs };
}
