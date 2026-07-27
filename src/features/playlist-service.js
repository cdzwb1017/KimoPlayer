import { invoke } from '@tauri-apps/api/core';
import {
  generatePlaylistId,
  getPlaylists,
  parseM3U,
  savePlaylists,
} from '../storage/playlist-store.js';

const LIKED_PLAYLIST_ID = '__liked__';

export async function importM3UPlaylist(file) {
  const parsed = parseM3U(await file.text());
  const playlist = {
    id: generatePlaylistId(),
    name: parsed.name || file.name.replace(/\.m3u8?$/i, ''),
    songs: parsed.songs,
    source: 'm3u',
    createdAt: Date.now(),
  };
  const playlists = getPlaylists();
  playlists.unshift(playlist);
  savePlaylists(playlists);
  return playlist;
}

export function createManualPlaylist(name) {
  const playlist = {
    id: generatePlaylistId(),
    name,
    songs: [],
    source: 'manual',
    createdAt: Date.now(),
  };
  const playlists = getPlaylists();
  playlists.unshift(playlist);
  savePlaylists(playlists);
  return playlist;
}

export function deletePlaylistById(id) {
  savePlaylists(getPlaylists().filter((playlist) => playlist.id !== id));
}

export function addSongToPlaylist(playlistId, song) {
  const playlists = getPlaylists();
  const playlist = playlists.find((candidate) => candidate.id === playlistId);
  if (!playlist) return false;

  const entry = {
    file_path: song.file_path || song.path || '',
    title: song.title || '未知',
    artist: song.artist || '',
    album: song.album || '',
    duration: typeof song.duration === 'number' ? song.duration : 0,
    cover_image: song.cover_image || '',
  };

  if (playlist.songs.some((item) => item.file_path === entry.file_path)) return true;

  playlist.songs.push(entry);
  savePlaylists(playlists);

  if (!entry.cover_image) {
    invoke('read_audio_metadata', { path: entry.file_path })
      .then((metadata) => {
        if (metadata?.cover_image) {
          entry.cover_image = metadata.cover_image;
          savePlaylists(playlists);
        }
      })
      .catch((error) => {
        console.error('Failed to fetch cover for playlist song:', entry.file_path, error);
      });
  }

  return true;
}

export function addSongsToPlaylist(playlistId, songs) {
  if (!Array.isArray(songs) || songs.length === 0) return 0;
  const playlists = getPlaylists();
  const playlist = playlists.find(candidate => candidate.id === playlistId);
  if (!playlist) return 0;

  let added = 0;
  const entriesNeedingCover = [];

  songs.forEach(song => {
    const filePath = song.file_path || song.path || '';
    if (!filePath || playlist.songs.some(item => item.file_path === filePath)) return;

    const entry = {
      file_path: filePath,
      title: song.title || '未知',
      artist: song.artist || '',
      album: song.album || '',
      duration: typeof song.duration === 'number' ? song.duration : 0,
      cover_image: song.cover_image || '',
    };
    playlist.songs.push(entry);
    added += 1;

    if (!entry.cover_image) {
      entriesNeedingCover.push(entry);
    }
  });

  if (added > 0) savePlaylists(playlists);

  // 异步批量读取封面并更新
  if (entriesNeedingCover.length > 0) {
    const loadCovers = async () => {
      for (const entry of entriesNeedingCover) {
        try {
          const metadata = await invoke('read_audio_metadata', { path: entry.file_path });
          if (metadata?.cover_image) {
            entry.cover_image = metadata.cover_image;
          }
        } catch (err) {
          console.error('Failed to load cover for:', entry.file_path, err);
        }
      }
      savePlaylists(playlists);
    };
    loadCovers();
  }

  return added;
}

export function removeSongFromPlaylist(playlistId, index) {
  const playlists = getPlaylists();
  const playlist = playlists.find((candidate) => candidate.id === playlistId);
  if (!playlist) return;
  playlist.songs.splice(index, 1);
  savePlaylists(playlists);
}

export function getLikedPlaylist() {
  const playlists = getPlaylists();
  let likedPlaylist = playlists.find((playlist) => playlist.id === LIKED_PLAYLIST_ID);
  if (!likedPlaylist) {
    likedPlaylist = {
      id: LIKED_PLAYLIST_ID,
      name: '我喜欢',
      songs: [],
      source: 'manual',
      createdAt: Date.now(),
    };
    playlists.unshift(likedPlaylist);
    savePlaylists(playlists);
  }
  return likedPlaylist;
}

export function isSongLiked(filePath) {
  return getLikedPlaylist().songs.some((song) => song.file_path === filePath);
}

export function toggleLikedSong(songData) {
  const playlists = getPlaylists();
  let likedPlaylist = playlists.find((playlist) => playlist.id === LIKED_PLAYLIST_ID);
  if (!likedPlaylist) {
    getLikedPlaylist();
    return toggleLikedSong(songData);
  }

  const filePath = songData.file_path || songData.path || '';
  const index = likedPlaylist.songs.findIndex((song) => song.file_path === filePath);
  if (index >= 0) {
    likedPlaylist.songs.splice(index, 1);
  } else {
    likedPlaylist.songs.push({
      file_path: filePath,
      title: songData.title || '',
      artist: songData.artist || '',
      album: songData.album || '',
      duration: typeof songData.duration === 'number' ? songData.duration : 0,
      cover_image: songData.cover_image || '',
    });
  }
  savePlaylists(playlists);
  return index < 0;
}
