import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { applyDynamicColor, getDefaultDynamicColor } from '../ui/theme.js';
import { transitionContent } from '../ui/transitions.js';
import { extractDominantColor } from '../utils/color.js';
import { getCoverSrc } from '../utils/cover.js';
import { renderAudioQualityBadgesHtml, renderArtistWithBadgesHtml } from '../utils/audio-quality.js';
import { recordPlay } from '../storage/play-stats.js';

export class PlaybackController {
  constructor({ createLyricsController }) {
    if (typeof createLyricsController !== 'function') {
      throw new TypeError('PlaybackController requires a lyrics controller factory.');
    }
    this.audio = new Audio();
    this.audio.crossOrigin = "anonymous";
    this.playlist = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.activeSearchQuery = null;
    this.lyrics = createLyricsController(this);
    this.setupEvents();
  }

  setupEvents() {
    // Seek to pending seek time on metadata load and refresh UI if duration is parsed
    const syncDurationUI = () => {
      if (this.currentIndex >= 0 && this.playlist[this.currentIndex]) {
        this.updateUI(this.playlist[this.currentIndex]);
      }
    };

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.pendingSeekTime !== undefined && this.pendingSeekTime !== null) {
        this.audio.currentTime = this.pendingSeekTime;
        this.pendingSeekTime = null;
      }
      syncDurationUI();
    });

    this.audio.addEventListener('durationchange', syncDurationUI);

    // Live real-time audio progress updates
    this.audio.addEventListener('timeupdate', () => {
      const audioDuration = this.audio.duration;
      const validAudioDuration = (audioDuration && isFinite(audioDuration) && audioDuration > 0) ? audioDuration : null;
      const currentSong = this.playlist[this.currentIndex];
      const duration = validAudioDuration || (currentSong && currentSong.duration ? currentSong.duration : 0);

      if (duration > 0) {
        const progress = Math.min(100, Math.max(0, (this.audio.currentTime / duration) * 100));
        
        try {
          localStorage.setItem('kimo-last-played-time', this.audio.currentTime.toString());
        } catch (e) {
          console.error('Failed to save last played time:', e);
        }
        
        // Update main player progress bar
        const mainBar = document.getElementById('progress-bar');
        if (mainBar) mainBar.style.width = `${progress}%`;
        
        // Update main player current elapsed time text
        const mainCurrentTimeText = document.querySelector('.player-progress-time.current');
        if (mainCurrentTimeText) {
          mainCurrentTimeText.innerText = Math.floor(this.audio.currentTime / 60) + ':' + (Math.floor(this.audio.currentTime) % 60).toString().padStart(2, '0');
        }

        // Update integrated lyrics progress bar
        const lyricsBar = document.getElementById('lyrics-progress-bar');
        if (lyricsBar) lyricsBar.style.width = `${progress}%`;
        
        // Update interactive current elapsed time text
        const currentTimeText = document.querySelector('.lyrics-progress-time.current');
        if (currentTimeText) {
          currentTimeText.innerText = Math.floor(this.audio.currentTime / 60) + ':' + (Math.floor(this.audio.currentTime) % 60).toString().padStart(2, '0');
        }
      }
    });

    // Elegant global state synchronization driven directly by HTML5 events
    const syncPlayState = (playing) => {
      this.isPlaying = playing;
      
      const clickArea = document.getElementById('lyrics-cover-click-area');
      if (clickArea) {
        clickArea.classList.toggle('is-playing', playing);
      }
      
      const playBtn = document.getElementById('play-btn');
      if (playBtn) {
        playBtn.classList.toggle('is-playing', playing);
      }

      // Sync active CSS Equalizers jumping state
      document.querySelectorAll('.song-item .eq-animation').forEach(el => {
        el.classList.toggle('paused', !playing);
      });

      // Synchronize Windows Native Media playback state (Prevent jitter during active track switching)
      if ('mediaSession' in navigator && !this.isSwitchingTrack) {
        navigator.mediaSession.playbackState = playing ? "playing" : "paused";
      }
    };

    this.audio.addEventListener('play', () => syncPlayState(true));
    this.audio.addEventListener('pause', () => syncPlayState(false));
    this.audio.addEventListener('ended', () => this.next());

    // ══ Windows Native SMTC Media Control Actions Integration ══
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        this.toggle();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.toggle();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.prev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.next();
      });
    }
  }

  async play(index) {
    if (index < 0 || index >= this.playlist.length) return;
    this.currentIndex = index;
    let song = this.playlist[index];

    // Save last played song path to localStorage
    try {
      localStorage.setItem('kimo-last-played-path', song.file_path);
      localStorage.setItem('kimo-last-played-time', '0');
    } catch (e) {
      console.error('Failed to save last played path to localStorage:', e);
    }

    // Set state lock to avoid intermediate play/pause flickering in SMTC
    this.isSwitchingTrack = true;

    // 1. Advance metadata and SMTC state BEFORE changing raw HTML5 src (smooth track swap)
    this.updateUI(song);

    // 2. Physical hot swap of the audio source
    this.audio.src = convertFileSrc(song.file_path);

    // 派发切歌事件，供评论面板等模块监听
    window.dispatchEvent(new CustomEvent('kimo-song-changed', { detail: { song, index } }));

    this.audio.play()
      .then(() => {
        this.isSwitchingTrack = false;
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      })
      .catch(e => {
        this.isSwitchingTrack = false;
        console.error('Play error:', e);
      });

        // Save to recent plays cache
    if (window.addToRecentPlays) {
      window.addToRecentPlays(song);
    }

    // Record play statistics
    recordPlay(song);

    // If cover is missing (loaded from cache), fetch it in the background to avoid storing megabytes in localStorage
    if (!song.cover_image) {
      try {
        const meta = await invoke('read_audio_metadata', { path: song.file_path });
        if (meta && meta.cover_image) {
          song.cover_image = meta.cover_image;
          this.playlist[index] = song;
          
          // Dynamically update UI cover art in real-time
          this.updateUI(song);
          const songItems = document.querySelectorAll('.song-item');
          if (songItems[index]) {
            const coverImg = songItems[index].querySelector('.song-cover');
            if (coverImg) coverImg.src = getCoverSrc(song.cover_image);
          }

          // Asynchronously extract and cache color
          extractDominantColor(getCoverSrc(song.cover_image)).then(color => {
            song.dominant_color = color;
            if (index === this.currentIndex) {
              applyDynamicColor(color.r, color.g, color.b, getCoverSrc(song.cover_image));
            }
          });
        }
      } catch (err) {
        console.error('Failed to dynamically fetch metadata on play:', err);
      }
    }

    // Dynamic color matching (fully non-blocking background task with caching)
    if (song.dominant_color) {
      applyDynamicColor(song.dominant_color.r, song.dominant_color.g, song.dominant_color.b, getCoverSrc(song.cover_image));
    } else if (song.cover_image) {
      extractDominantColor(getCoverSrc(song.cover_image)).then(color => {
        song.dominant_color = color;
        if (index === this.currentIndex) {
          applyDynamicColor(color.r, color.g, color.b, getCoverSrc(song.cover_image));
        }
      });
    } else {
      const defColor = getDefaultDynamicColor();
      applyDynamicColor(defColor.r, defColor.g, defColor.b, getCoverSrc(null));
    }

    // Load lyrics
    this.lyrics.load(song.file_path);

    // ⭐ 实时更新播放列表面板当前播放标记 ⭐
    if (typeof window.updatePlaylistPanelCurrent === 'function') {
      window.updatePlaylistPanelCurrent();
    }
  }

  toggle() {
    if (this.currentIndex === -1 && this.playlist.length > 0) { this.play(0); return; }
    if (this.isPlaying) { this.audio.pause(); } else { this.audio.play().catch(e => console.error(e)); }
  }

  // Play modes: 'list-loop' | 'single-loop' | 'shuffle'
  playMode = 'list-loop';
  speedSteps = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  speedIndex = 2; // default 1.0x

  next() {
    if (this.playlist.length === 0) return;
    if (this.playMode === 'shuffle') {
      this.play(Math.floor(Math.random() * this.playlist.length));
    } else {
      this.play((this.currentIndex + 1) % this.playlist.length);
    }
  }
  prev() { if (this.playlist.length > 0) this.play((this.currentIndex - 1 + this.playlist.length) % this.playlist.length); }

  cyclePlayMode() {
    const modes = ['list-loop', 'single-loop', 'shuffle'];
    const labels = { 'list-loop': '列表循环', 'single-loop': '单曲循环', 'shuffle': '随机播放' };
    const svgs = {
      'list-loop': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
      'single-loop': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><text x="12" y="15" text-anchor="middle" font-size="8" fill="currentColor" stroke="none" font-weight="bold">1</text></svg>',
      'shuffle': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>'
    };
    const idx = modes.indexOf(this.playMode);
    this.playMode = modes[(idx + 1) % modes.length];
    const btn = document.getElementById('play-mode-btn');
    if (btn) {
      btn.innerHTML = svgs[this.playMode];
      btn.title = '播放模式: ' + labels[this.playMode];
      btn.classList.toggle('is-active', this.playMode !== 'list-loop');
    }
    // Set audio loop for single-loop mode
    this.audio.loop = this.playMode === 'single-loop';
  }

  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % this.speedSteps.length;
    const speed = this.speedSteps[this.speedIndex];
    this.audio.playbackRate = speed;
    const btn = document.getElementById('speed-btn');
    if (btn) {
      const label = btn.querySelector('.speed-label');
      if (label) label.textContent = speed + 'x';
      btn.title = '倍速 ' + speed + 'x';
      btn.classList.toggle('is-active', speed !== 1.0);
    }
  }

  updateUI(song) {
    const title = song.title || 'Unknown Title';
    const artist = song.artist || 'Unknown Artist';
    const cover = getCoverSrc(song.cover_image);
    const miniCover = getCoverSrc(song.cover_image);

    // ══ Windows Native Toast Notifications (Silent for uninterrupted audio experience) ══
    if (window.Notification && this.lastNotifiedFilePath !== song.file_path) {
      this.lastNotifiedFilePath = song.file_path;
      const triggerNotification = () => {
        new Notification("KiomPlayer 正在播放", {
          body: `${title} - ${artist}`,
          silent: true
        });
      };
      if (Notification.permission === "granted") {
        triggerNotification();
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            triggerNotification();
          }
        });
      }
    }

    // ══ Windows Native SMTC Media Session Metadata Integration (High-precision Deduplication) ══
    const smtcKey = `${song.file_path}_${song.cover_image || ''}`;
    if ('mediaSession' in navigator && this.lastSMTCKey !== smtcKey) {
      this.lastSMTCKey = smtcKey;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist,
        album: song.album || 'Unknown Album',
        artwork: song.cover_image ? [
          {
            src: getCoverSrc(song.cover_image),
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ] : []
      });
    }

    const badgesHtml = renderAudioQualityBadgesHtml(song);
    const playerBarArtistHtml = renderArtistWithBadgesHtml(artist, song, { hideBitrate: true });
    const fullArtistHtml = renderArtistWithBadgesHtml(artist, song);

    transitionContent(document.getElementById('current-title'), title);
    transitionContent(document.getElementById('current-artist'), playerBarArtistHtml);

    transitionContent(document.getElementById('lyrics-header-artist'), fullArtistHtml);
    transitionContent(document.getElementById('lyrics-under-title'), title);
    transitionContent(document.getElementById('lyrics-under-artist'), artist);
    transitionContent(document.getElementById('lyrics-under-badges'), badgesHtml);
    
    if (this.lyrics.isVisible) {
      transitionContent(document.getElementById('lyrics-large-cover'), cover, true);
    }
    transitionContent(document.getElementById('current-cover'), miniCover, true);

    // Set duration text for the integrated lyrics progress container
    const audioDur = this.audio.duration;
    const validAudioDur = (audioDur && isFinite(audioDur) && audioDur > 0) ? audioDur : null;
    const totalDuration = validAudioDur || (song && song.duration ? song.duration : 0);

    const totalTimeText = document.querySelector('.lyrics-progress-time.total');
    if (totalTimeText) {
      totalTimeText.innerText = totalDuration ? Math.floor(totalDuration / 60) + ':' + (Math.floor(totalDuration) % 60).toString().padStart(2, '0') : '0:00';
    }

    const mainTotalTime = document.querySelector('.player-progress-time.total');
    if (mainTotalTime) {
      mainTotalTime.innerText = totalDuration ? Math.floor(totalDuration / 60) + ':' + (Math.floor(totalDuration) % 60).toString().padStart(2, '0') : '0:00';
    }

    document.querySelectorAll('.song-item').forEach((el) => {
      const filePath = el.getAttribute('data-file-path');
      const isCurrent = filePath && this.playlist[this.currentIndex] && filePath === this.playlist[this.currentIndex].file_path;
      el.classList.toggle('playing', isCurrent);
      const eq = el.querySelector('.eq-animation');
      if (eq) {
        if (isCurrent) {
          eq.classList.toggle('paused', this.audio.paused);
        } else {
          eq.classList.add('paused');
        }
      }
    });

    // Make sure interactive click areas have proper playing state classes on transition
    const clickArea = document.getElementById('lyrics-cover-click-area');
    if (clickArea) {
      clickArea.classList.toggle('is-playing', this.isPlaying);
    }

    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
      playBtn.classList.toggle('is-playing', this.isPlaying);
    }
  }
}
