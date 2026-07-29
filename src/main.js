import './styles.css';
import { renderAudioQualityBadgesHtml, renderArtistWithBadgesHtml } from './utils/audio-quality.js';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { parseLRC, parseTTML, parseJSONLyrics } from './lyrics.js';
import {
  getLyricLineText,
  synthesizePerCharWords,
} from './lyrics/animation-units.js';
import {
  applyDepthBlur,
  clearDepthBlur,
  markDepthBlurDirty,
} from './lyrics/depth-blur.js';
import {
  clampScrollTop,
  getAlignedScrollTop,
  getLyricsScrollAlign,
} from './lyrics/scroll-position.js';
import {
  calculateActiveLineState,
  calculateLinesToProcess,
  calculateViewActiveIndices,
} from './lyrics/sync-state.js';
import {
  calculateKaraokePlayheadState,
  calculateSimpleCharProgress,
} from './lyrics/playhead.js';
import { alignLyricRows } from './lyrics/row-layout.js';
import {
  renderClassicCharProgress,
  renderRowKaraokeProgress,
} from './lyrics/progress-renderer.js';
import {
  collectLongGlowIndices,
  renderWordMotionEffects,
} from './lyrics/word-effects.js';
import {
  syncMiniBarSpans,
  updateMiniBarLyrics,
} from './lyrics/mini-bar.js';
import { updateLyricLineEndTimes } from './lyrics/line-timing.js';
import { renderTimedLyricWords } from './lyrics/line-renderer.js';
import { updateInactiveLineFixedState } from './lyrics/line-visual-state.js';
import {
  showFullLyricsModal,
  showLyricContextMenu,
} from './lyrics/lyrics-overlays.js';
import {
  smoothScrollToLine,
  staggeredScrollToLine,
} from './lyrics/scroll-animations.js';
import { updateLyricsVisualizer } from './lyrics/visualizer.js';
import {
  runSingleLineAlignment,
  saveLyricsCache as saveLyricsCacheForAudio,
  showCalibrationModal,
} from './lyrics/calibration.js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { initializeWindowControls } from './core/window-controls.js';
import {
  getLikedPlaylist,
  isSongLiked,
  toggleLikedSong,
} from './features/playlist-service.js';
import { initializePlaylistPanel } from './features/playlist-panel.js';
import { toggleCommentsPanel, isCommentsPanelVisible, updateCommentsPanel } from './features/comments-panel.js';
import { createDiscoverPage } from './features/discover-page.js';
import { createLocalLibraryPage } from './features/local-library-page.js';
import { initializeMetadataSavedSync } from './features/metadata-sync.js';
import { createPlaylistsPage } from './features/playlists-page.js';

import {
  parseEditableLyrics,
  serializeEditableLyrics,
} from './features/metadata-editor/lyrics-codec.js';
import { bindLyricsEditorControls } from './features/metadata-editor/lyrics-editor-controls.js';
import { renderLyricsTimeline as renderMetadataLyricsTimeline } from './features/metadata-editor/lyrics-timeline.js';
import {
  bindCoverControls,
  fillMetadataForm,
  getMetadataFormValues,
  setMetadataSaveBusy,
  toWriteMetadataPayload,
} from './features/metadata-editor/metadata-form.js';
import {
  addRecentPlay,
  createRecentPlaysRenderer,
  getRecentPlays,
} from './features/recent-plays.js';
import { createSettingsPage } from './features/settings-page.js';
import { PlaybackController } from './player/playback-controller.js';
import { createSearchController } from './search/search-controller.js';
import { SEARCH_WORKER_SOURCE } from './search/worker-source.js';
import { clearLyricsDB, loadAllLyricsFromDB, saveLyricsToDB } from './storage/lyrics-cache-db.js';
import { customConfirm, customPrompt } from './ui/dialogs.js';
import { initializeAlbumCoverMenu } from './ui/album-cover-menu.js';

import { initializeImmersiveMode } from './ui/immersive-mode.js';
import { initializeLyricsPreferencesControls } from './ui/lyrics-preferences-controls.js';
import { initializeCustomContextMenu } from './ui/context-menu.js';
import { initializePlayerControls } from './ui/player-controls.js';
import { initializeProgressScrubbing } from './ui/progress-scrubbing.js';
import { initializeContentAreaWheelFix } from './ui/scroll-fix.js';
import { createDesktopLyricsController } from './ui/desktop-lyrics-controller.js';
import { showToast } from './ui/toast.js';
import { initializeVolumeControls } from './ui/volume-controls.js';
import { applyStoredInterfaceFont } from './ui/interface-font.js';
import {
  applyMiniLyricsTranslationSetting,
  initializeLyricsSettingsToolbar,
} from './ui/lyrics-controls.js';
import { showStartupUpdateAnnouncement } from './ui/update-announcement.js';
import { startupUpdateCheck } from './ui/update-checker.js';
import { getCoverSrc } from './utils/cover.js';
import { extractDominantColor } from './utils/color.js';
import { transitionContent } from './ui/transitions.js';
import {
  applyDynamicColor,
  applyTheme,
  applyLyricsTheme,
  applyUiStyle,
  applyBackgroundStyle,
  initLyricsTheme,
  configureThemePlayer,
  configureThemeDesktopLyrics,
  currentTheme,
  cycleTheme,
  getDefaultDynamicColor,
  getColorOptions,
  reapplyCurrentColor,
} from './ui/theme.js';

// ══ Early Shell Window Controls (Rust-Command Driven) ══
initializeWindowControls();

// Shared in-memory state for the structured lyrics editor.
let currentEditableLyrics = [];
let currentLyricsType = 'lrc'; // 'json', 'enhanced-lrc', 或者是 'lrc'
let currentLyricsEditorMode = 'timeline'; // 'timeline' 或者是 'raw'

// ══ Lyrics Controller ══
class LyricsController {
  constructor(player) {
    this.player = player;
    this.lines = [];
    this.activeIndex = -1;
    this.miniBarIndex = -1;
    this.desktopLyricsController = null;
    this.isVisible = false;
    this.animFrameId = null;
    this.isUserScrolling = false;
    this.isAutoScrolling = false;
    this.currentScrollIndex = -1;
    this._lastViewActiveKey = '';
    this._lastInterludeVisualKey = '';
    this._scrollTimeout = null;
    // Cache lyric row nodes to avoid repeated DOM tree scans.
    this._cachedAllLines = null;

    // Detect manual scroll: clear blur so user can read
    const scrollEl = document.getElementById('lyrics-scroll');
    if (scrollEl) {
      scrollEl.addEventListener('wheel', () => this.onUserScroll(), { passive: true });
      scrollEl.addEventListener('touchmove', () => this.onUserScroll(), { passive: true });
      scrollEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const oldMenu = document.getElementById('kimo-lyrics-context-menu');
        if (oldMenu) oldMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'kimo-lyrics-context-menu';
        menu.className = 'kimo-context-menu';
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;

        const menuItemFull = document.createElement('div');
        menuItemFull.className = 'kimo-context-menu-item';
        menuItemFull.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px; color:var(--text-secondary);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>查看完整歌词文本</span>
        `;
        menuItemFull.addEventListener('click', () => {
          menu.remove();
          this.viewFullLyrics();
        });
        menu.appendChild(menuItemFull);
        document.body.appendChild(menu);

        const clickOut = () => {
          menu.remove();
          document.removeEventListener('click', clickOut);
        };
        setTimeout(() => {
          document.addEventListener('click', clickOut);
        }, 50);
      });
    }

    this.lyricsStaggerMode = localStorage.getItem('kimo-lyrics-stagger-mode') || 'word';
    this.updateStaggerUI();
  }

  updateStaggerUI() {
    const btn = document.getElementById('btn-stagger-toggle');
    const label = document.getElementById('lyric-stagger-value');
    if (btn) {
      if (this.lyricsStaggerMode === 'stagger') {
        btn.classList.add('stagger-active');
        btn.title = '当前模式: 字母依次上移 (点击切换为单词整体)';
      } else {
        btn.classList.remove('stagger-active');
        btn.title = '当前模式: 单词整体上移 (点击切换为字母依次)';
      }
    }
    if (label) {
      label.textContent = this.lyricsStaggerMode === 'stagger' ? '字母依次上移' : '单词整体上移';
    }
  }

  toggleStaggerMode() {
    this.lyricsStaggerMode = this.lyricsStaggerMode === 'stagger' ? 'word' : 'stagger';
    localStorage.setItem('kimo-lyrics-stagger-mode', this.lyricsStaggerMode);
    this.updateStaggerUI();
    this.render();
  }

  onUserScroll() {
    this.isUserScrolling = true;
    this.clearBlur();
    // Restore blur after 3s of no manual scrolling
    clearTimeout(this._scrollTimeout);
    this._scrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
      const allLines = document.querySelectorAll('#lyrics-lines .lyrics-line');
      if (this.activeIndex >= 0) {
        this.applyBlur(this.activeIndex, this.currentScrollIndex, allLines);
      }
    }, 3000);
  }

  applyBlur(activeIndices, scrollIdx, allLines) {
    applyDepthBlur({
      activeIndices,
      scrollIdx,
      activeIndex: this.activeIndex,
      allLines,
      isAutoScrolling: this.isAutoScrolling,
    });
  }

  clearBlur() {
    const lines = this._cachedAllLines || Array.from(document.querySelectorAll('#lyrics-lines .lyrics-line'));
    clearDepthBlur(lines);
  }

  setBlurEnabled(enabled) {
    localStorage.setItem('kimo-lyrics-blur-enabled', enabled ? 'true' : 'false');
    const lines = this._cachedAllLines || Array.from(document.querySelectorAll('#lyrics-lines .lyrics-line'));
    markDepthBlurDirty(lines);
    this.applyBlur(this.activeIndices || [], this.currentScrollIndex || 0, lines);
  }

  updateSpacerHeights() {
    const container = document.getElementById('lyrics-scroll');
    if (!container) return;
    const spacers = container.querySelectorAll('.lyrics-spacer');
    if (spacers.length >= 2) {
      const containerHeight = container.clientHeight || container.getBoundingClientRect().height || 500;
      const alignOffset = getLyricsScrollAlign();
      
      const topSpacerHeight = containerHeight * alignOffset;
      const bottomSpacerHeight = containerHeight * (1 - alignOffset);
      
      spacers[0].style.height = `${topSpacerHeight}px`;
      spacers[1].style.height = `${bottomSpacerHeight}px`;
    }
  }

  realign() {
    this.updateSpacerHeights();
    const container = document.getElementById('lyrics-scroll');
    const allLines = document.querySelectorAll('#lyrics-lines .lyrics-line');
    // 鑻ユ湭寮€濮嬫挱鏀撅紝榛樿浠ョ涓€琛?0) 杩涜鐗╃悊瀵归綈璁＄畻
    const scrollIndex = this.currentScrollIndex >= 0 ? this.currentScrollIndex : 0;
    if (container && allLines && allLines[scrollIndex]) {
      const lineEl = allLines[scrollIndex];
      container.scrollTop = getAlignedScrollTop(container, lineEl);
    }
  }

  resetAlignmentCache() {
    const allLines = document.querySelectorAll('#lyrics-lines .lyrics-line');
    allLines.forEach(el => {
      el.removeAttribute('data-bg-aligned');
      el.dataset.bgAligned = 'false';
      delete el.rowsData;
      delete el._wordSpans;
      delete el._wordsList;
      delete el._prevFirstRelativeTop;
      delete el._prevLastRelativeTop;
      delete el.dataset.fixedState;
      delete el._lastFilter;
      delete el._lastOpacity;
      
      el.style.removeProperty('--line-width');
      el.querySelectorAll('.lyrics-word').forEach(w => {
        w.style.removeProperty('--line-width');
        w.style.removeProperty('--char-offset');
        w.style.removeProperty('--glow-left-pct');
        w.style.removeProperty('--glow-right-pct');
        w.style.removeProperty('--glow-mid-pct');
        w.style.removeProperty('--char-fill');
        w.removeAttribute('data-row-index');
        delete w.dataset.rowIndex;
        delete w.dataset.fillVal;
        delete w.dataset.liftVal;
        delete w._lastFill;
        delete w._lastPercent;
      });
      el.querySelectorAll('.lyrics-ruby-suffix').forEach(s => {
        s.style.removeProperty('--char-offset');
      });
    });
  }

  _getLineText(line) {
    return getLyricLineText(line);
  }

  _synthesizePerCharWords(line, idx) {
    return synthesizePerCharWords(line, this.lines[idx + 1]);
  }

  syncBarSpans(wordSpans, charC, totalChars) {
    this._barWordSpans = syncMiniBarSpans({
      cachedSpans: this._barWordSpans,
      charC,
      totalChars,
    });
  }

  updateBarLyrics(activeIdx) {
    this._barWordSpans = updateMiniBarLyrics({
      lines: this.lines,
      activeIndex: activeIdx,
      getLineText: line => this._getLineText(line),
    });
  }

  setDesktopLyricsController(controller) {
    this.desktopLyricsController = controller;
  }

  async load(audioPath) {
    this.audioPath = audioPath;
    this.lines = [];
    this.activeIndex = -1;
    this.miniBarIndex = -1;
    this._barWordSpans = null; // 清空迷你歌词缓存，避免引用已失效的DOM
    const linesEl = document.getElementById('lyrics-lines');
    // 独立元数据编辑窗口不包含主歌词容器，不应执行播放器歌词渲染。
    if (!linesEl) {
      return;
    }
    linesEl.innerHTML = '';
    
    const barLyric1 = document.getElementById('bar-lyric-text-1');
    const barLyric2 = document.getElementById('bar-lyric-text-2');
    if (barLyric1) barLyric1.textContent = '';
    if (barLyric2) barLyric2.textContent = '';

    try {
      const result = await invoke('get_lyrics', { audioPath });
      console.log('[Lyrics] type:', result.lyrics_type, 'content length:', result.content.length);

      if (result.lyrics_type === 'none') {
        linesEl.innerHTML = '<div class="lyrics-line" style="text-align:center; color:var(--text-secondary);">暂无歌词</div>';
        if (barLyric1) barLyric1.textContent = '暂无歌词';
        if (barLyric2) barLyric2.textContent = '';
        return;
      }

      if (result.lyrics_type === 'lrc') {
        this.lines = parseLRC(result.content);
      } else if (result.lyrics_type === 'ttml') {
        this.lines = parseTTML(result.content);
      } else if (result.lyrics_type === 'json') {
        this.lines = parseJSONLyrics(result.content);
      }

      if (this.lines.length === 0) {
        linesEl.innerHTML = '<div class="lyrics-line" style="text-align:center; color:var(--text-secondary);">暂无歌词</div>';
        if (barLyric1) barLyric1.textContent = '暂无歌词';
        if (barLyric2) barLyric2.textContent = '';
        return;
      }

      // --- Insert Interlude Lines for long gaps ---
      if (this.lines.length > 0) {
        const newLines = [];
        for (let i = 0; i < this.lines.length; i++) {
           const line = this.lines[i];
           if (i === 0) {
               if (line.time > 8.0) {
                   newLines.push({
                       time: 0,
                       end: line.time - 0.3,
                       isInterlude: true,
                       text: '...'
                   });
               }
           } else {
               const prevLine = this.lines[i-1];
               const prevEnd = prevLine.end || (prevLine.words && prevLine.words.length > 0 ? prevLine.words[prevLine.words.length - 1].time + 1.0 : prevLine.time + 2.0);
               if (line.time - prevEnd > 8.0) {
                   newLines.push({
                       time: prevEnd + 1.0,
                       end: line.time - 0.3,
                       isInterlude: true,
                       text: '...'
                   });
               }
           }
           newLines.push(line);
        }
        this.lines = newLines;
      }

      // console.log('[Lyrics] parsed lines:', this.lines.length);
      // this.lines.forEach((l, i) => console.log(`  [${i}] "${l.text}" | trans: "${l.translation || '-'}" | words: ${l.words ? l.words.length : 0} | interlude: ${!!l.isInterlude}`));

      this.render();
      // Force update of player bar lyrics immediately after loading completes,
      // ensuring the cloned nodes/spans are rendered instantly instead of falling back.
      const currentActive = this.activeIndex >= 0 ? this.activeIndex : 0;
      this.updateBarLyrics(currentActive);
      this.startSync();
    } catch (e) {
      console.error('Lyrics load error:', e);
      linesEl.innerHTML = '<div class="lyrics-line" style="text-align:center; color:var(--text-secondary);">暂无歌词</div>';
      if (barLyric1) barLyric1.textContent = '暂无歌词';
      if (barLyric2) barLyric2.textContent = '';
    }
  }

  render() {
    const container = document.getElementById('lyrics-lines');
    container.innerHTML = '';
    // Clear layout caches before rendering and rebuild them afterward.
    this._cachedAllLines = null;
    this._lastInterludeVisualKey = '';
    
    // Remove global interlude overlay if it exists
    const oldGlobal = document.getElementById('global-interlude');
    if (oldGlobal) oldGlobal.remove();

    this.lines.forEach((line, idx) => {
      const div = document.createElement('div');
      div.className = 'lyrics-line';
      div.dataset.index = idx;
      
      // 猸?瀵瑰敱瑙掕壊涓庤儗鏅瓕璇嶆牱寮忔敞鍏モ瓙
      if (line.isBackground) {
        div.classList.add('is-background-line');
      }
      if (line.role) {
        const cleanRole = line.role.trim().toLowerCase().replace(/\s+/g, '-');
        div.classList.add(`role-${cleanRole}`);
        if (cleanRole.includes('l1') || cleanRole.includes('v1')) div.classList.add('role-l1');
        if (cleanRole.includes('l2') || cleanRole.includes('v2')) div.classList.add('role-l2');
        if (cleanRole.includes('both') || cleanRole.includes('v3') || (cleanRole.includes('l1') && cleanRole.includes('l2')) || (cleanRole.includes('v1') && cleanRole.includes('v2'))) {
          div.classList.add('role-both');
        }
      }
      
      if (line.isInterlude) {
        div.classList.add('is-interlude-line');
      }

      // Main text (with word spans if available)
      const mainDiv = document.createElement('div');

      if (line.isInterlude) {
        mainDiv.className = 'lyrics-interlude';
        for(let j=0; j<3; j++) {
            const dot = document.createElement('span');
            dot.className = 'interlude-dot';
            mainDiv.appendChild(dot);
        }
      } else {
        mainDiv.className = 'lyrics-main';
        // Per-character karaoke fallback: synthesize per-char timing from line-level timestamps
        if (!line.words || line.words.length === 0) {
          line.words = this._synthesizePerCharWords(line, idx);
        }
        if (line.words && line.words.length >= 1) {
          line.charWords = renderTimedLyricWords({
            mainDiv,
            line,
            nextLine: this.lines[idx + 1],
            staggerMode: this.lyricsStaggerMode,
          });
        } else {
          mainDiv.textContent = line.text;
        }
      }
      div.appendChild(mainDiv);

      // Translation line
      if (line.translation) {
        const transDiv = document.createElement('div');
        transDiv.className = 'lyrics-translation';
        transDiv.textContent = line.translation;
        div.appendChild(transDiv);
        div.classList.add('has-translation');
      }

      div.addEventListener('click', () => {
        this.player.audio.currentTime = line.time;
      });
      
      // Bind the context-menu shortcut for single-line AI calibration.
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showCalibrationContextMenu(idx, e.clientX, e.clientY);
      });
      
      container.appendChild(div);
    });

    // All character-word nodes are ready after rendering completes.
    // Recalculate accurate line end times after all word nodes are rendered.
    updateLyricLineEndTimes(this.lines);
    this.updateSpacerHeights();
  }

  showCalibrationContextMenu(idx, clientX, clientY) {
    showLyricContextMenu({
      line: this.lines[idx],
      lineIndex: idx,
      clientX,
      clientY,
      onCalibrate: lineIndex => this.startSingleLineCalibration(lineIndex),
      onSeek: line => { this.player.audio.currentTime = line.time; },
      onViewFullLyrics: () => this.viewFullLyrics(),
    });
  }

  viewFullLyrics() {
    showFullLyricsModal({
      lines: this.lines,
      onToast: message => this.showToast(message),
    });
  }

  async startSingleLineCalibration(idx) {
    const line = this.lines[idx];
    if (!line || !this.audioPath) return;
    this.showCalibrationModal(line, idx);
  }

  showCalibrationModal(line, idx) {
    showCalibrationModal({
      line,
      lineIndex: idx,
      onRun: (targetLine, lineIndex, modal) => this.runSingleLineAlignment(targetLine, lineIndex, modal),
    });
  }

  async runSingleLineAlignment(line, idx, modalEl) {
    await runSingleLineAlignment({
      line,
      lineIndex: idx,
      modal: modalEl,
      lines: this.lines,
      audioPath: this.audioPath,
      invoke: window.__TAURI__.core.invoke,
      onApply: (aiSyllables, modal) => {
        if (aiSyllables.length > 0) {
          line.time = aiSyllables[0].time;
        }
        line.words = aiSyllables;
        line.isWordTimed = true;

        this.render();
        this.saveLyricsCache();

        modal.remove();
        this.showToast('AI ???????????');
      },
    });
  }

  saveLyricsCache() {
    saveLyricsCacheForAudio({
      audioPath: this.audioPath,
      lines: this.lines,
      invoke: window.__TAURI__.core.invoke,
    });
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'kimo-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  updateVisualizer() {
    const state = updateLyricsVisualizer({
      player: this.player,
      audioContext: this.audioContext,
      audioSource: this.audioSource,
      analyser: this.analyser,
      dataArray: this.dataArray,
      visualizerHeights: this.visualizerHeights,
    });

    this.audioContext = state.audioContext;
    this.audioSource = state.audioSource;
    this.analyser = state.analyser;
    this.dataArray = state.dataArray;
    this.visualizerHeights = state.visualizerHeights;
  }

  startSync() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    
    let extrapolatedTime = this.player.audio.currentTime;
    let lastSysTime = performance.now();
    let lastAudioTime = extrapolatedTime;
    let lastVisTime = 0;

    const tick = (now) => {
      // Pause the animation loop while the page is hidden.
      if (document.hidden) {
        this.animFrameId = requestAnimationFrame(tick);
        return;
      }

      const audioTime = this.player.audio.currentTime;
      const isPaused = this.player.audio.paused;
      const dt = (now - lastSysTime) / 1000;
      lastSysTime = now;

      if (!isPaused && !this.player.audio.seeking) {
        // Move time forward smoothly
        extrapolatedTime += dt;

        // When the browser's audio time updates, gently correct our extrapolated time
        if (audioTime !== lastAudioTime) {
          const diff = audioTime - extrapolatedTime;
          if (Math.abs(diff) > 0.15) {
            extrapolatedTime = audioTime;
          } else {
            // Apply a rapid correction towards the true audio time for high-speed tracking
            extrapolatedTime += diff * 0.45;
          }
          lastAudioTime = audioTime;
        }
      } else {
        extrapolatedTime = audioTime;
        lastAudioTime = audioTime;
      }

      this.syncToTime(extrapolatedTime);
      
      // Throttle spectrum DOM updates to roughly 30 FPS.
      if (this.isVisible && !isPaused) {
        if (now - lastVisTime >= 30) {
          this.updateVisualizer();
          lastVisTime = now;
        }
      }

      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  stopSync() {
    if (this.animFrameId) { cancelAnimationFrame(this.animFrameId); this.animFrameId = null; }
  }

  syncToTime(rawCurrentTime) {
    if (!this.lines.length) return;
    
    const timeOffset = parseFloat(localStorage.getItem('kimo-lyrics-time-offset')) || 0.0;
    const currentTime = rawCurrentTime + timeOffset;
    const liftAmp = parseFloat(localStorage.getItem('kimo-lyrics-lift-amplitude')) ?? 4.0;

    const dt = this._prevPhysicsTime !== undefined ? Math.max(0.001, Math.min(0.08, currentTime - this._prevPhysicsTime)) : 0.016;
    this._prevPhysicsTime = currentTime;

    // 1. Calculate activeIndices & activeIndex (Support multiple overlapping active lines)
    const activeIndices = [];
    let activeIndex = -1; // Latest active line on the primary vocal lane.
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const endBoundary = line.isInterlude
        ? Math.max(line.endTime + 0.4, (this.lines[i + 1]?.time ?? 0) + 0.5)
        : line.endTime + 0.4;
      if (currentTime >= line.time - 0.5 && currentTime <= endBoundary) {
        activeIndices.push(i);
      }
    }

    const laneEndTimes = [];
    for (const idx of activeIndices) {
      const line = this.lines[idx];
      let assignedLane = -1;
      for (let l = 0; l < laneEndTimes.length; l++) {
        if (line.time >= laneEndTimes[l] - 0.05) {
          assignedLane = l;
          break;
        }
      }
      if (assignedLane === -1) {
        assignedLane = laneEndTimes.length;
        laneEndTimes.push(line.endTime);
      } else {
        laneEndTimes[assignedLane] = line.endTime;
      }
      line.laneIndex = assignedLane;
    }

    // Prefer the primary vocal lane when choosing the current lyric line.
    let primaryIdx = -1;
    let primaryTime = -Infinity;
    for (const idx of activeIndices) {
      const line = this.lines[idx];
      if (currentTime >= line.time - 0.1 && line.laneIndex === 0 && line.time > primaryTime) {
        primaryTime = line.time;
        primaryIdx = idx;
      }
    }
    if (primaryIdx === -1 && activeIndices.length > 0) {
      primaryIdx = activeIndices[0];
    }
    activeIndex = primaryIdx;

    if (activeIndices.length === 0 && activeIndex >= 0) {
      activeIndices.push(activeIndex);
    }

    // Mini lyrics should follow the newest line that has actually started.
    // Unlike the main view, it must not wait for the previous line's tail/overlap window.
    let miniBarIndex = -1;
    for (let i = this.lines.length - 1; i >= 0; i -= 1) {
      if (currentTime >= this.lines[i].time) {
        miniBarIndex = i;
        break;
      }
    }

    if (miniBarIndex >= 0) {
      const miniLine = this.lines[miniBarIndex];
      this.desktopLyricsController?.sync({
        text: this._getLineText(miniLine),
        translation: miniLine?.translation || '',
        words: miniLine?.words || null,
        currentTime,
        lineStart: miniLine?.time || 0,
        lineEnd: miniLine?.end || 0,
      });
    }

    // Calculate a monotonic, slightly anticipatory lyric scroll index.
    let scrollIndex = activeIndex;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      if (currentTime >= this.lines[i].time - 0.5) {
        if (i > scrollIndex) {
          scrollIndex = i;
        }
        break;
      }
    }
    if (scrollIndex < 0 && this.lines.length > 0) {
      scrollIndex = 0;
    }

    if (!this.isVisible) {
      if (miniBarIndex !== this.miniBarIndex) {
        this.updateBarLyrics(miniBarIndex);
        this.miniBarIndex = miniBarIndex;
      }
      if (miniBarIndex >= 0 && this.lines[miniBarIndex] && this.lines[miniBarIndex].charWords && this.lines[miniBarIndex].charWords.length > 0) {
        const lineData = this.lines[miniBarIndex];
        const totalChars = lineData.charWords.length;
        const charC = calculateSimpleCharProgress(lineData.charWords, currentTime);
        this.syncBarSpans(null, charC, totalChars);

        // 同步桌面歌词进度，直接克隆已经构建好的底栏迷你歌词 spans HTML
        if (this.desktopLyricsController) {
          const barLyricEl = document.getElementById('bar-lyric-text-1');
          const barHtml = barLyricEl?.innerHTML || '';
          this.desktopLyricsController.syncKaraokeProgress({
            html: barHtml,
            charC,
            totalChars,
            text: this._getLineText(lineData),
            translation: lineData.translation || '',
          });
        }
      }
      return;
    }

    if (!this._cachedAllLines) {
      this._cachedAllLines = Array.from(document.querySelectorAll('#lyrics-lines .lyrics-line'));
    }
    const allLines = this._cachedAllLines;
    const container = document.getElementById('lyrics-scroll');

    const viewActiveIndices = calculateViewActiveIndices(this.lines, currentTime);
    const viewActiveKey = JSON.stringify(viewActiveIndices);

    // Update scrolling position (scrollIndex triggers early for anticipatory positioning)
    // Runs when the primary scrollIndex changes OR when the set of overlapping active lines changes.
    if (scrollIndex !== this.currentScrollIndex || viewActiveKey !== this._lastViewActiveKey) {
      this.currentScrollIndex = scrollIndex;
      this._lastViewActiveKey = viewActiveKey;
      
      if (scrollIndex >= 0 && allLines[scrollIndex]) {
        this.isAutoScrolling = true;
        const lineEl = allLines[scrollIndex];
        
        // 1. 更新边界
        this.updateSpacerHeights();
        
        // Align strictly to the current primary scroll line's offset to keep active lyrics in place
        const baseOffsetTop = lineEl.offsetTop;
        
        const containerHeight = container.clientHeight || container.getBoundingClientRect().height || 500;
        const alignOffset = parseFloat(localStorage.getItem('kimo-lyrics-scroll-align')) || 0.5;
        const topSpacerHeight = containerHeight * alignOffset;
        const targetOffset = baseOffsetTop - topSpacerHeight;
        
        const finalTargetOffset = clampScrollTop(container, targetOffset);
        
        // Use a synchronized offset and a single reflow for smooth scrolling.
        // Capture the old position before applying the synchronized transform.
        const startScrollTop = container.scrollTop;
        const delta = finalTargetOffset - startScrollTop;

        if (Math.abs(delta) < 1) {
          container.scrollTop = finalTargetOffset;
        } else {
          container.scrollTop = finalTargetOffset;

          const targetIdx = scrollIndex;

          // Step A: freeze transitions and offset all lyric rows together.
          const rowFollowEnabled = localStorage.getItem('kimo-lyrics-row-follow-enabled') !== 'false';
          allLines.forEach((el, idx) => {
            if (el.classList.contains('is-interlude-line')) return;
            if (el.classList.contains('has-translation') && idx === targetIdx) {
              const translationEl = el.querySelector('.lyrics-translation');
              if (translationEl) {
                const currentTranslationStyle = window.getComputedStyle(translationEl);
                translationEl.style.setProperty('--translation-brighten-from-color', currentTranslationStyle.color);
                translationEl.style.setProperty('--translation-brighten-from-opacity', currentTranslationStyle.opacity);
              }
              el.classList.add('translation-brightening-start');
              el.classList.remove('translation-brightening', 'translation-fading', 'translation-faded');
            }
            el.style.transition = 'none';
            el.style.transform = `translateY(${delta}px)`;
          });

          // Step B: trigger one container-wide reflow.
          void container.offsetHeight;

          // Step C: animate all rows back to their zero transform.
          allLines.forEach((el, idx) => {
            if (el.classList.contains('is-interlude-line')) {
              // Interlude entry/exit is fully phased by CSS; do not override it
              // with the regular lyric-row FLIP transition.
              el.style.transition = '';
              el.style.transitionDelay = '';
            } else {
              let delay = 0;
              if (rowFollowEnabled && idx !== targetIdx) {
                const dist = Math.abs(idx - targetIdx);
                if (idx > targetIdx) {
                  delay = Math.min(0.42, dist * 0.055);
                } else {
                  delay = Math.min(0.18, dist * 0.025);
                }
              }
              // Row motion and fading progress together; depth blur still reacts quickly.
              el.style.transition = `transform 1.15s cubic-bezier(0.2, 0, 0.2, 1) ${delay}s, opacity 1.05s cubic-bezier(0.2, 0, 0.2, 1) 0s, filter 0.32s ease 0s`;
              el.style.transform = 'translateY(0)';

              if (el.classList.contains('has-translation')) {
                if (idx === targetIdx - 1) {
                  el.classList.add('translation-fading');
                  el.classList.remove('translation-brightening-start', 'translation-brightening', 'translation-faded');
                } else if (idx === targetIdx) {
                  el.classList.add('translation-brightening');
                  el.classList.remove('translation-brightening-start', 'translation-fading', 'translation-faded');
                } else if (idx < targetIdx - 1) {
                  el.classList.add('translation-faded');
                  el.classList.remove('translation-brightening-start', 'translation-brightening', 'translation-fading');
                } else {
                  el.classList.remove('translation-brightening-start', 'translation-brightening', 'translation-fading', 'translation-faded');
                }
              }

              if (idx < targetIdx) {
                el.classList.add('past');
                el.classList.remove('active');
              } else if (idx === targetIdx) {
                el.classList.add('active');
                el.classList.remove('past');
              } else {
                el.classList.remove('active', 'past');
              }
            }
          });

          // Clear the previous cleanup timer before scheduling a new animation cleanup.
          clearTimeout(this._scrollCleanup);
          this._scrollCleanup = setTimeout(() => {
            allLines.forEach(el => {
              el.style.transition = '';
              el.style.transitionDelay = '';
              const translationEl = el.querySelector('.lyrics-translation');
              if (translationEl) {
                translationEl.style.removeProperty('--translation-brighten-from-color');
                translationEl.style.removeProperty('--translation-brighten-from-opacity');
              }
            });
            this.isAutoScrolling = false;
          }, 1700);
        }
      }
    }

    const linesToProcess = calculateLinesToProcess(this.lines, currentTime, scrollIndex, activeIndices);

    // Update active/past visual classes, blur and clean up states based on dual axis sync (activeIndices + scrollIndex)
    const activeIndicesKey = JSON.stringify(activeIndices);
    const interludeVisualKey = this.lines.map((line, idx) => {
      if (!line.isInterlude) return '';
      const targetTime = line.end || line.endTime || (this.lines[idx + 1] ? this.lines[idx + 1].time - 0.3 : line.time + 5.0);
      if (currentTime < line.time) return 'future';
      if (currentTime < targetTime - 0.6) return 'active';
      if (currentTime < targetTime) return 'exiting';
      return 'past';
    }).join('|');
    if (activeIndicesKey !== this._lastActiveIndicesKey
      || scrollIndex !== this._lastVisualScrollIndex
      || interludeVisualKey !== this._lastInterludeVisualKey) {
      // Simple bottom bar lyric text update
      if (activeIndex !== this.activeIndex) {
        this.updateBarLyrics(activeIndex);
      }

      this.activeIndex = activeIndex;
      this._lastActiveIndicesKey = activeIndicesKey;
      this._lastVisualScrollIndex = scrollIndex;
      this._lastInterludeVisualKey = interludeVisualKey;
      
      const minActiveIdx = activeIndices.length > 0 ? Math.min(...activeIndices) : activeIndex;
      
      allLines.forEach((el, idx) => {
        el.classList.remove('active', 'past', 'past-old');

        if (el.classList.contains('is-interlude-line')) {
          el.classList.remove('active', 'past', 'is-exiting');
          const lineData = this.lines[idx];
          const targetTime = lineData.end || lineData.endTime || (this.lines[idx + 1] ? this.lines[idx + 1].time - 0.3 : lineData.time + 5.0);
          const EXIT_DUR = 0.6;

          if (currentTime < lineData.time) {
            el._wasPast = false;
          } else if (currentTime >= lineData.time && currentTime < targetTime) {
            if (currentTime >= targetTime - EXIT_DUR) {
              el.classList.add('active', 'is-exiting');
            } else {
              el.classList.add('active');
            }
          } else {
            const justEnteredPast = !el._wasPast;
            el.classList.add('past');
            el._wasPast = true;

            if (justEnteredPast) {
              const collapseStartTime = performance.now();
              const trackerFn = (now) => {
                if (now - collapseStartTime < 650) {
                  const currentActive = document.querySelector('.lyrics-line.active');
                  if (currentActive && !this.isUserScrolling) {
                    const scrollIndex = this.currentScrollIndex;
                    const container = document.getElementById('lyrics-scroll');
                    if (container && scrollIndex >= 0) {
                      const allLines = Array.from(document.querySelectorAll('#lyrics-lines .lyrics-line'));
                      const lineEl = allLines[scrollIndex];
                      if (lineEl) {
                        container.scrollTop = getAlignedScrollTop(container, lineEl);
                      }
                    }
                  }
                  this._interludeCollapseTracker = requestAnimationFrame(trackerFn);
                } else {
                  cancelAnimationFrame(this._interludeCollapseTracker);
                }
              };
              cancelAnimationFrame(this._interludeCollapseTracker);
            }
          }
          return;
        }

        const effectiveActive = Math.max(activeIndex, scrollIndex);

        if (activeIndices.includes(idx)) {
          el.classList.add('active');
        } else if (idx < minActiveIdx && idx < effectiveActive) {
          el.classList.add('past');
        }

        updateInactiveLineFixedState({
          lineEl: el,
          lineIndex: idx,
          activeIndices,
          viewActiveIndices,
          linesToProcess,
          currentTime,
          minActiveIndex: minActiveIdx,
          scrollIndex,
          liftAmplitude: liftAmp,
          lines: this.lines,
        });
      });

      if (!this.isUserScrolling) {
        this.applyBlur(activeIndices, scrollIndex, allLines);
      }
    }

    // Word-level (or character-level) smooth physics for both active and upcoming lines
    this._frameCount = (this._frameCount || 0) + 1;
    
    linesToProcess.forEach(idx => {
      if (idx >= 0 && this.lines[idx].charWords && this.lines[idx].charWords.length > 0) {
        const lineData = this.lines[idx];
        const domLine = document.querySelector(`#lyrics-lines .lyrics-line[data-index="${idx}"]`);
        if (domLine) {
          if (!domLine._wordSpans) {
            domLine._wordSpans = domLine.querySelectorAll('.lyrics-word');
          }
          const wordSpans = domLine._wordSpans;
          
          if (!domLine._wordsList) {
            domLine._wordsList = Array.from(domLine.querySelector('.lyrics-main')?.querySelectorAll('.lyrics-word') || []);
          }
          const words = domLine._wordsList;
          
          alignLyricRows(domLine, words, { force: this._layoutDirty });
          
          const {
            charC,
            inGap,
            gapPrevIdx,
            currentGapT,
            totalChars,
          } = calculateKaraokePlayheadState(lineData.charWords, currentTime);

          if (idx === this.activeIndex) {
            this.syncBarSpans(wordSpans, charC, totalChars);
            if (this.desktopLyricsController) {
              const mainHtml = domLine.querySelector('.lyrics-main')?.innerHTML || '';
              this.desktopLyricsController.syncKaraokeProgress({
                html: mainHtml,
                charC,
                totalChars,
                text: this._getLineText(lineData),
                translation: lineData.translation || '',
              });
            }
          }

          if (!this.isVisible) {
            return;
          }

          const longIndices = collectLongGlowIndices(wordSpans);

          if (domLine.rowsData && domLine.rowsData.length > 0) {
            renderRowKaraokeProgress({
              rowsData: domLine.rowsData,
              wordSpans,
              charC,
              totalChars,
              inGap,
              gapPrevIdx,
              currentGapT,
            });
          } else {
            renderClassicCharProgress({
              wordSpans,
              charWords: lineData.charWords,
              currentTime,
              charC,
              totalChars,
            });
          }
          
          renderWordMotionEffects({
            wordSpans,
            charWords: lineData.charWords,
            charC,
            liftAmplitude: liftAmp,
            isBackground: lineData.isBackground,
            deltaTime: dt,
            longIndices,
          });

          if (idx === this.activeIndex) {
            this.syncBarSpans(wordSpans, charC, totalChars);
          }
        }
      }
    });
  }

  // Staggered scroll: break total scroll into steps with delays between each
  staggeredScrollTo(lineEl) {
    staggeredScrollToLine({
      lineEl,
      scrollTimers: this._scrollTimers,
      scrollAnimation: this._scrollAnim,
      setAutoScrolling: value => { this.isAutoScrolling = value; },
      setScrollTimers: value => { this._scrollTimers = value; },
      setScrollAnimation: value => { this._scrollAnim = value; },
    });
  }



  // Keep smoothScrollTo as fallback
  smoothScrollTo(lineEl) {
    smoothScrollToLine({
      lineEl,
      scrollAnimation: this._scrollAnim,
      setAutoScrolling: value => { this.isAutoScrolling = value; },
      setScrollAnimation: value => { this._scrollAnim = value; },
    });
  }

  show() {
    const panel = document.getElementById('lyrics-panel');
    if (panel) {
      // 清除内联 transform，让 CSS .active 类的 transform: translateY(0) 生效
      panel.style.transform = '';
      panel.classList.add('active');
    }
    this.isVisible = true;

    // Lazily load the heavy large cover art only when the panel is shown
    if (this.player.currentIndex >= 0) {
      const song = this.player.playlist[this.player.currentIndex];
      if (song) {
        const cover = getCoverSrc(song.cover_image);
        const largeCoverEl = document.getElementById('lyrics-large-cover');
        if (largeCoverEl && largeCoverEl.src !== cover) {
          transitionContent(largeCoverEl, cover, true);
        }
      }
    }
    
    this.realign();
    setTimeout(() => {
      this.realign();
    }, 100);
    setTimeout(() => {
      this.realign();
    }, 650);
  }

  hide() {
    const panel = document.getElementById('lyrics-panel');
    if (panel) {
      panel.classList.remove('active');
      // 恢复内联 transform 确保面板隐藏（防止 CSS 缓存残留）
      panel.style.transform = 'translateY(100%)';
    }
    this.isVisible = false;
  }

  toggle() {
    if (this.isVisible) this.hide(); else this.show();
  }
}

// ══ Audio Player ══
const player = new PlaybackController({
  createLyricsController: (audioPlayer) => new LyricsController(audioPlayer),
});
configureThemePlayer(() => player);

// ══ Init ══
document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('error', (event) => {
    alert(`JS 运行异常: ${event.message}\n文件: ${event.filename}\n行号: ${event.lineno}`);
  });

  const urlParams = new URLSearchParams(window.location.search);
  const isStandaloneEditor = urlParams.get('window') === 'metadata-editor';

  if (isStandaloneEditor) {
    document.body.classList.add('standalone-editor');
  }

  // Show the main window after the DOM and styles are ready.
  if (!isStandaloneEditor) {
    try {
      const appWin = getCurrentWindow();
      if (appWin && typeof appWin.show === 'function') {
        appWin.show().catch((err) => {
          console.warn('[Window] show() is not allowed by Tauri permissions config:', err);
        });
      }
    } catch (e) {}
  }

  // Remove the splash after the first render.
  setTimeout(() => {
    const splash = document.getElementById('app-splash-screen');
    if (splash) {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 500);
    }
  }, 600);

  // Restore default lyric lift amplitude to 4.0 on version 1.2.2 launch (word lift animation)
  if (localStorage.getItem('kimo-lyrics-lift-amplitude-migrated-122') !== 'true') {
    localStorage.setItem('kimo-lyrics-lift-amplitude', '4.0');
    localStorage.setItem('kimo-lyrics-lift-amplitude-migrated-122', 'true');
  }

  // Restore the saved theme, using light mode on first launch.
  let savedTheme = localStorage.getItem('kimo-theme');
  if (!savedTheme) {
    savedTheme = 'light';
  }
  const isCustom = localStorage.getItem('kimo-overlay-opacity-custom') === 'true';
  let savedOp = isCustom ? localStorage.getItem('kimo-overlay-opacity') : null;
    applyTheme(savedTheme, savedOp);
  initLyricsTheme();
  // 加载已保存的 UI 风格
  const savedUiStyle = localStorage.getItem('kimo-ui-style') || 'solid';
  applyUiStyle(savedUiStyle);
  // 加载已保存的背景样式
  const savedBgStyle = localStorage.getItem('kimo-bg-style') || 'static';
  applyBackgroundStyle(savedBgStyle);
  applyStoredInterfaceFont();

  if (localStorage.getItem('kimo-performance-mode') === 'true') {
    document.body.classList.add('perf-mode');
  }

  let savedScale = parseFloat(localStorage.getItem('kimo-ui-scale')) || 1.0;
  if (savedScale > 1.2) {
    savedScale = 1.2;
    localStorage.setItem('kimo-ui-scale', '1.2');
  }
  document.documentElement.style.setProperty('--ui-scale', savedScale.toString());
  document.documentElement.style.zoom = savedScale.toString();

  // Lyrics depth-of-field blur toggle.
  const blurBtn = document.getElementById('btn-blur-toggle');
  const blurVal = document.getElementById('lyric-blur-value');
  const updateBlurUI = () => {
    const isEnabled = localStorage.getItem('kimo-lyrics-blur-enabled') !== 'false';
    const activeIcon = blurBtn?.querySelector('.blur-active-icon');
    const inactiveIcon = blurBtn?.querySelector('.blur-inactive-icon');
    if (isEnabled) {
      if (activeIcon) activeIcon.style.display = 'block';
      if (inactiveIcon) inactiveIcon.style.display = 'none';
      if (blurVal) blurVal.textContent = '景深模糊: 已开启';
    } else {
      if (activeIcon) activeIcon.style.display = 'none';
      if (inactiveIcon) inactiveIcon.style.display = 'block';
      if (blurVal) blurVal.textContent = '景深模糊: 已关闭';
    }
  };
  if (blurBtn) {
    blurBtn.addEventListener('click', () => {
      const isEnabled = localStorage.getItem('kimo-lyrics-blur-enabled') !== 'false';
      const nextState = !isEnabled;
      localStorage.setItem('kimo-lyrics-blur-enabled', nextState ? 'true' : 'false');
      updateBlurUI();
      if (typeof playerUI !== 'undefined' && playerUI && playerUI.lyrics) {
        playerUI.lyrics.setBlurEnabled(nextState);
      }
    });
    updateBlurUI();
  }
  // ══ 监听子窗口元数据/歌词修改保存事件 ══
  initializeImmersiveMode();


  // Handle window resizing to dynamically recalibrate lyric spacers with high precision
  window.addEventListener('resize', () => {
    if (player.lyrics) {
      player.lyrics.resetAlignmentCache();
    }
    if (player.lyrics.isVisible) {
      player.lyrics.realign();
      requestAnimationFrame(() => {
        if (player.lyrics.isVisible) {
          player.lyrics.realign();
        }
      });
    }
  });

  initializeContentAreaWheelFix();

  initializePlayerControls(player);

  initializeProgressScrubbing(player);
  initializeVolumeControls(player);

  // Theme
  document.getElementById('theme-toggle')?.addEventListener('click', cycleTheme);

  initializeLyricsPreferencesControls(player);

  // Render Playlist Helper
  
  // Get audio quality label from metadata
  const getAudioQualityLabel = (song) => {
    const bitrate = song.bitrate;
    const sampleRate = song.sample_rate;
    const ext = (song.file_path || '').split('.').pop().toLowerCase();
    
    // Determine format
    let format = ext.toUpperCase();
    if (['flac', 'ape', 'wav', 'aiff', 'alac'].includes(ext)) format = 'Hi-Res';
    else if (ext === 'mp3') format = 'MP3';
    else if (ext === 'aac' || ext === 'm4a') format = 'AAC';
    else if (ext === 'ogg') format = 'OGG';
    else if (ext === 'wma') format = 'WMA';
    
    // Determine quality tier
    let quality = '';
    if (bitrate) {
      if (bitrate >= 3200) quality = 'SQ'; // 320kbps+
      else if (bitrate >= 2560) quality = 'HQ'; // 256kbps
      else if (bitrate >= 1920) quality = 'HQ'; // 192kbps
      else quality = '标准';
    }
    
    // For lossless formats
    if (['flac', 'ape', 'wav', 'aiff', 'alac'].includes(ext)) {
      quality = '无损';
      if (sampleRate && sampleRate >= 96000) quality = 'Hi-Res';
    }
    
    return { format, quality, bitrate, sampleRate };
  };
  // Get audio quality HTML string
  const getAudioQualityHtml = (song) => {
    const q = getAudioQualityLabel(song);
    let html = '<span class="audio-tag format">' + q.format + '</span>';
    if (q.quality) {
      html += '<span class="audio-tag quality">' + q.quality + '</span>';
    }
    if (q.bitrate) {
      html += '<span class="audio-tag bitrate">' + Math.round(q.bitrate/10) + 'k</span>';
    }
    return html;
  };


  const renderPlaylist = (playlist) => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    playlist.forEach((song, idx) => {
      const div = document.createElement('div');
      const isCurrent = idx === player.currentIndex;
      div.className = `song-item${isCurrent ? ' playing' : ''}`;
      div.setAttribute('data-file-path', song.file_path);
      div.dataset.cover = song.cover_image || '';
      div.dataset.album = song.album || '';
      div.dataset.duration = String(song.duration || 0);
      const coverSrc = getCoverSrc(song.cover_image);
      
      const isPaused = player.audio.paused;
      div.innerHTML = `
        <img src="${coverSrc}" class="song-cover" />
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
        if ((localStorage.getItem('kimo-song-play-mode') || 'single') === 'single') player.play(idx);
      });
      div.addEventListener('dblclick', () => {
        if ((localStorage.getItem('kimo-song-play-mode') || 'single') === 'double') player.play(idx);
      });
      listEl.appendChild(div);
    });
  };

    // Background load missing covers & bitrate from metadata on startup (avoids writing MBs to localStorage)
  const backgroundLoadCovers = async (playlist) => {
    await new Promise(r => setTimeout(r, 1200));
    if (!playlist || playlist.length === 0) return;

    const CONCURRENCY_LIMIT = 2; // Limit metadata work to reduce CPU and disk pressure.
    const queue = [...playlist.entries()];

    const worker = async () => {
      let count = 0;
      while (queue.length > 0) {
        const [index, song] = queue.shift();
        count++;
        // Yield briefly after each metadata batch so the UI remains responsive.
        if (count % 2 === 0) {
          await new Promise(r => setTimeout(r, 40));
        }

        // Load if missing cover OR missing bitrate (for cached songs from old slimPlaylist)
        const needsCover = song.cover_image === undefined || song.cover_image === null;
        const needsBitrate = song.bitrate === undefined || song.bitrate === null;
        if (needsCover || needsBitrate) {
          try {
            const meta = await invoke('read_audio_metadata', { path: song.file_path });
            if (needsBitrate && meta && meta.bitrate) {
              song.bitrate = meta.bitrate;
            }
            song.cover_image = (meta && meta.cover_image) ? meta.cover_image : null;
            if (meta && meta.cover_image) {
              playlist[index] = song;

              // Dynamically update the cover image in the playlist DOM
              const songItems = document.querySelectorAll('.song-item');
              if (songItems[index]) {
                const coverImg = songItems[index].querySelector('.song-cover');
                if (coverImg) {
                  coverImg.src = getCoverSrc(song.cover_image);
                }
              }

              // Update the active player UI covers if this song happens to be the active one
              if (index === player.currentIndex) {
                player.updateUI(song);
                extractDominantColor(getCoverSrc(song.cover_image), getColorOptions()).then(color => {
                  song.dominant_color = color;
                  if (index === player.currentIndex) {
                    applyDynamicColor(color.r, color.g, color.b, getCoverSrc(song.cover_image));
                  }
                });
              }
            }
            // If bitrate was loaded but cover was already set, still update playlist ref
            if (needsBitrate && !needsCover) {
              playlist[index] = song;
              // Update DOM for bitrate display
              const songItems = document.querySelectorAll('.song-item');
              if (songItems[index]) {
                const tagEl = songItems[index].querySelector('.song-audio-tags');
                if (tagEl) {
                  tagEl.innerHTML = getAudioQualityHtml(song);
                }
              }
            }
          } catch (err) {
            console.error('Failed to background load cover for:', song.file_path, err);
            song.cover_image = null;
          }
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, playlist.length) }, worker);
    await Promise.all(workers);
  };

  // ══ Tab Management and Navigation System ══
  let currentTab = 'discover';

  // The local library is independent from the current playback queue.
  let musicLibrary = [];

  // ══ Tab Sub-States for Local Library & Helper Functions ══
  const {
    renderLocalMusicTab,
    playSongCollection,
  } = createLocalLibraryPage({
    player,
    getCoverSrc,
    getMusicLibrary: () => musicLibrary,
    getCurrentTab: () => currentTab,
    renderRecentPlaysTab: () => renderRecentPlaysTab(),
    showToast,
    switchTab: tabName => switchTab(tabName),
  });

  // Custom dialogs replace native prompt/confirm UI inside the WebView.
  // ========== 歌单模块 (1.3) ==========
  getLikedPlaylist();

  const toggleLikeSong = (songData) => {
    const filePath = songData.file_path || songData.path || '';
    const likedNow = toggleLikedSong(songData);
    updateHeartButton();
    showToast(likedNow ? '已添加到我喜欢' : '已从我喜欢移除');
  };

  const updateHeartButton = () => {
    const outline = document.getElementById('like-icon-outline');
    const filled = document.getElementById('like-icon-filled');
    if (!outline || !filled) return;
    try {
      const track = (player.currentIndex >= 0 && player.playlist) ? player.playlist[player.currentIndex] : null;
      const filePath = track?.file_path || track?.path || '';
      const liked = filePath ? isSongLiked(filePath) : false;
      outline.style.display = liked ? 'none' : '';
      filled.style.display = liked ? '' : 'none';
    } catch (_) {
      outline.style.display = '';
      filled.style.display = 'none';
    }
  };

  // Listen for metadata/lyrics saves from the standalone editor after dependencies are initialized.
  if (!isStandaloneEditor) {
    initializeMetadataSavedSync({
      player,
      renderPlaylist,
      updateHeartButton,
      showToast,
      getCoverSrc,
      extractDominantColor,
      applyDynamicColor,
      getDefaultDynamicColor,
      getColorOptions,
    });
  }

  document.getElementById('like-btn')?.addEventListener('click', () => {
    try {
      const track = (player.currentIndex >= 0 && player.playlist) ? player.playlist[player.currentIndex] : null;
      if (!track) { showToast('暂无播放歌曲'); return; }
      const songData = {
        file_path: track.file_path || track.path || '',
        title: track.title || '',
        artist: track.artist || '',
        album: track.album || '',
        duration: track.duration || 0,
        cover_image: track.cover_image || '',
      };
      toggleLikeSong(songData);
    } catch (e) { showToast('操作失败'); }
  });

    initializePlaylistPanel({ player, getCoverSrc, showToast });

  // 评论面板按钮
  document.getElementById('comments-toggle-btn')?.addEventListener('click', () => {
    const track = (player.currentIndex >= 0 && player.playlist) ? player.playlist[player.currentIndex] : null;
    toggleCommentsPanel(player, track?.album || '');
  });

  const desktopLyrics = createDesktopLyricsController({ showToast, player });
  desktopLyrics.setPlayer(player);
  configureThemeDesktopLyrics(() => desktopLyrics);
  player.lyrics?.setDesktopLyricsController(desktopLyrics);
  player.audio?.addEventListener('play', () => desktopLyrics.notifyPlaybackState(true));
  player.audio?.addEventListener('pause', () => desktopLyrics.notifyPlaybackState(false));
  if (localStorage.getItem('kimo-desktop-lyrics-enabled') === 'true') {
    desktopLyrics.setVisible(true, { silent: true });
  }

  // ══ 系统托盘状态同步 ══
  const syncTrayState = () => {
    const song = (player.currentIndex >= 0 && player.playlist[player.currentIndex]) || null;
    const songInfo = song ? `${song.title || '未知标题'} - ${song.artist || '未知歌手'}` : null;
    const lyricsEnabled = localStorage.getItem('kimo-desktop-lyrics-enabled') === 'true';
    invoke('update_tray_info', {
      isPlaying: player.isPlaying,
      desktopLyricsEnabled: lyricsEnabled,
      songInfo,
    }).catch(() => {});
  };

  // 监听托盘菜单事件 → 驱动播放控制
  listen('tray-play', () => { player.toggle(); }).catch(() => {});
  listen('tray-prev', () => { player.prev(); }).catch(() => {});
  listen('tray-next', () => { player.next(); }).catch(() => {});
  listen('tray-toggle-desktop-lyrics', () => {
    const enabled = localStorage.getItem('kimo-desktop-lyrics-enabled') !== 'true';
    desktopLyrics.setVisible(enabled);
    syncTrayState();
  }).catch(() => {});
  listen('tray-open-settings', () => { switchTab('settings'); }).catch(() => {});

  // 播放状态变化 → 同步到托盘
  player.audio?.addEventListener('play', () => syncTrayState());
  player.audio?.addEventListener('pause', () => syncTrayState());

  // 切歌 → 自动更新评论面板 + 收藏按钮状态（通过自定义事件，比 audio.play 更可靠）
  window.addEventListener('kimo-song-changed', () => {
    updateCommentsPanel(player);
    updateHeartButton();
  });

  // 桌面歌词可见性变化 → 同步到托盘
  listen('desktop-lyrics-visibility-changed', () => { syncTrayState(); }).catch(() => {});

  // 初始同步一次
  syncTrayState();

  // ========== 歌单 UI ==========
  const { renderPlaylistsTab } = createPlaylistsPage({
    player,
    getCoverSrc,
    showToast,
    customPrompt,
    customConfirm,
  });

    const renderSettingsTab = createSettingsPage({
    player,
    showToast,
    applyMiniLyricsTranslationSetting,
    applyTheme,
    applyLyricsTheme,
    applyUiStyle,
    applyBackgroundStyle,
    getCurrentTheme: () => currentTheme,
    customConfirm,
    clearLyricsDB,
    open,
    invoke,
    setMusicLibrary: library => {
      musicLibrary = library;
    },
    clearSearchCache: () => {
      searchController.clearCache();
    },
    resetDiscoverRecommendations: () => resetDiscoverRecommendations(),
    backgroundLoadCovers,
    desktopLyrics,
    switchTab: tabName => switchTab(tabName),
    reapplyCurrentColor,
  });

  const renderRecentPlaysTab = createRecentPlaysRenderer({
    player,
    getCoverSrc,
    renderPlaylist,
    isRecentTab: () => currentTab === 'recent',
  });

  const {
    renderDiscoverTab,
    resetRecommendations: resetDiscoverRecommendations,
  } = createDiscoverPage({
    player,
    getCoverSrc,
    getRecentPlays,
    renderPlaylist,
    switchTab: tabName => switchTab(tabName),
  });

              const updateSidebarIndicator = (activeNav) => {
    const indicator = document.getElementById('sidebar-indicator');
    if (!indicator || !activeNav) return;
    const container = activeNav.closest('.sidebar-nav-container');
    if (!container) return;
    // Use offsetTop for reliable positioning within the container
    let offsetTop = 0;
    let el = activeNav;
    while (el && el !== container) {
      offsetTop += el.offsetTop;
      el = el.offsetParent;
    }
    indicator.style.top = offsetTop + 'px';
    indicator.style.height = activeNav.offsetHeight + 'px';
  };

  const switchTab = (tabName) => {
    currentTab = tabName;
    document.getElementById('content-toolbar')?.replaceChildren();
    
    // Update sidebar navigation active classes
    document.querySelectorAll('.sidebar .nav-item').forEach(el => {
      el.classList.remove('active');
    });
    
    const activeNav = document.getElementById(`nav-${tabName}`);
    if (activeNav) activeNav.classList.add('active');
    if (activeNav) updateSidebarIndicator(activeNav);
    
    // Control visibility of individual floating actions
    const floatToTop = document.getElementById('float-to-top');
    const floatToPlaying = document.getElementById('float-to-playing');
    const isListTab = tabName === 'local' || tabName === 'recent' || tabName === 'playlists';
    if (floatToTop) floatToTop.style.display = isListTab ? 'flex' : 'none';
    if (floatToPlaying) floatToPlaying.style.display = isListTab ? 'flex' : 'none';
    
    // Change tab content area
    const contentTitle = document.getElementById('content-title');
    if (!contentTitle) return;
    
    if (tabName === 'discover') {
      contentTitle.innerText = '发现音乐';
      renderDiscoverTab();
    } else if (tabName === 'local') {
      contentTitle.innerText = '本地音乐';
      renderLocalMusicTab();
    } else if (tabName === 'recent') {
      contentTitle.innerText = '最近播放';
      renderRecentPlaysTab();
    } else if (tabName === 'search') {
      contentTitle.innerText = '全局搜索';
      renderSearchTab();
    } else if (tabName === 'playlists') {
      contentTitle.innerText = '我的歌单';
      renderPlaylistsTab();
    } else if (tabName === 'settings') {
      contentTitle.innerText = '系统设置';
      renderSettingsTab();
    }

                        // Trigger fluid tab transition with hardware acceleration
    const listEl = document.getElementById('music-list');
    const toolbarEl = document.getElementById('content-toolbar');

    // Animate toolbar (filter tabs, search box, etc.)
    if (toolbarEl) {
      toolbarEl.classList.remove('page-enter');
      void toolbarEl.offsetWidth;
      toolbarEl.classList.add('page-enter');
      // Stagger toolbar children
      requestAnimationFrame(() => {
        const children = toolbarEl.children;
        Array.from(children).forEach((el, i) => {
          el.style.opacity = '0';
          el.style.transform = 'translate3d(0, 24px, 0)';
          el.style.transition = 'none';
          requestAnimationFrame(() => {
            el.style.transition = `opacity 0.7s cubic-bezier(0.25, 0.1, 0.25, 1) ${0.06 + i * 0.08}s, transform 0.7s cubic-bezier(0.25, 0.1, 0.25, 1) ${0.06 + i * 0.08}s`;
            el.style.opacity = '1';
            el.style.transform = 'translate3d(0, 0, 0)';
          });
        });
      });
    }

    // Animate main content list
    if (listEl) {
      listEl.classList.remove('fade-in-up', 'page-enter');
      void listEl.offsetWidth; // Force reflow
      listEl.classList.add('page-enter');

      // Stagger float-up for list items in all tabs
      requestAnimationFrame(() => {
        const items = listEl.querySelectorAll('.song-item, .playlist-item, .search-result-item, .setting-group, .stat-card');
        items.forEach((el, i) => {
          el.style.opacity = '0';
          el.style.transform = 'translate3d(0, 24px, 0)';
          el.style.transition = 'none';
          requestAnimationFrame(() => {
            el.style.transition = `opacity 0.7s cubic-bezier(0.25, 0.1, 0.25, 1) ${0.12 + i * 0.04}s, transform 0.7s cubic-bezier(0.25, 0.1, 0.25, 1) ${0.12 + i * 0.04}s`;
            el.style.opacity = '1';
            el.style.transform = 'translate3d(0, 0, 0)';
          });
        });
      });
    }
  };

  // Bind Switch Tab functions to global so player can refresh them
  window.addToRecentPlays = (song) => {
    addRecentPlay(song);
    
    // Dynamically update view if current active tab needs refresh
    if (currentTab === 'recent') {
      renderRecentPlaysTab();
    }
  };

  // Wire up sidebar navigation buttons
  document.getElementById('nav-discover')?.addEventListener('click', () => switchTab('discover'));
  document.getElementById('nav-local')?.addEventListener('click', () => switchTab('local'));
  document.getElementById('nav-recent')?.addEventListener('click', () => switchTab('recent'));
  document.getElementById('nav-search')?.addEventListener('click', () => switchTab('search'));
  document.getElementById('nav-playlists')?.addEventListener('click', () => switchTab('playlists'));
  document.getElementById('nav-settings')?.addEventListener('click', () => switchTab('settings'));
  // Initialize sliding indicator position
  setTimeout(() => {
    const activeNav = document.querySelector('.sidebar .nav-item.active');
    if (activeNav) updateSidebarIndicator(activeNav);
  }, 100);
  window.addEventListener('resize', () => {
    const activeNav = document.querySelector('.sidebar .nav-item.active');
    if (activeNav) updateSidebarIndicator(activeNav);
  });

  // Ensure floating action bar container is always visible
  document.getElementById('floating-actions')?.classList.add('visible');

  // Wire up list floating actions
  document.getElementById('float-to-top')?.addEventListener('click', () => {
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      contentArea.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.getElementById('float-to-playing')?.addEventListener('click', () => {
    const activeSong = document.querySelector('.song-item.playing');
    if (activeSong) {
      activeSong.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // Sidebar search and background caching.
  const searchController = createSearchController({
    player,
    workerSource: SEARCH_WORKER_SOURCE,
    loadLyricsCache: loadAllLyricsFromDB,
    saveLyricsCache: saveLyricsToDB,
    invoke,
    parseLRC,
    parseTTML,
    parseJSONLyrics,
    switchTab,
    getCoverSrc,
    showToast,
  });
  const { renderSearchTab } = searchController;

  // ══ Scanned Directories Initialization & Backward Compatibility ══
  try {
    const cachedDirs = localStorage.getItem('kimo-scanned-dirs');
    if (!cachedDirs) {
      const oldSingle = localStorage.getItem('kimo-scanned-dir');
      if (oldSingle) {
        localStorage.setItem('kimo-scanned-dirs', JSON.stringify([oldSingle]));
      }
    }
  } catch (e) {
    console.error('Failed to init scanned directories:', e);
  }

  // Auto Load Cached Music Library on Startup
  const cachedLibrary = localStorage.getItem('kimo-music-library');
  if (cachedLibrary) {
    try {
      const parsed = JSON.parse(cachedLibrary);
      if (Array.isArray(parsed) && parsed.length > 0) {
        musicLibrary = parsed;
        // 如果 player.playlist 是空的，恢复为整个音乐库
        if (player.playlist.length === 0) {
          player.playlist = [...parsed];
        }
        // Spin up background concurrency task to restore missing cover images
        backgroundLoadCovers(musicLibrary);
      }
    } catch (e) {
      console.error('Failed to load cached music library on startup', e);
    }
  }

  if (musicLibrary.length === 0 && player.playlist.length > 0) {
    musicLibrary = [...player.playlist];
    localStorage.setItem('kimo-music-library', JSON.stringify(musicLibrary));
  }

  // Restore last played song only in the main player window.
  if (!isStandaloneEditor) {
  try {
    const lastPlayedPath = localStorage.getItem('kimo-last-played-path');
    if (lastPlayedPath && player.playlist.length > 0) {
      const index = player.playlist.findIndex(s => s.file_path === lastPlayedPath);
      if (index >= 0) {
        const song = player.playlist[index];
        player.currentIndex = index;
        
        // Prevent Windows toast notification on startup
        player.lastNotifiedFilePath = song.file_path;
        
        // Update UI with last song
        player.updateUI(song);
        updateHeartButton();
        
        // Load audio source
        player.audio.src = convertFileSrc(song.file_path);
        
        // Load lyrics
        player.lyrics.load(song.file_path);
        
        // Restore progress position
        const savedTime = parseFloat(localStorage.getItem('kimo-last-played-time')) || 0;
        if (savedTime > 0) {
          player.pendingSeekTime = savedTime;
        }

        // Restore dynamic color background state
        const cachedColorStr = localStorage.getItem('kimo-last-dynamic-color');
        const cachedCoverSrc = localStorage.getItem('kimo-last-cover-src');
        if (cachedColorStr) {
          const [r, g, b] = cachedColorStr.split(',').map(Number);
          applyDynamicColor(r, g, b, cachedCoverSrc);
        } else {
          extractDominantColor(getCoverSrc(song.cover_image), getColorOptions()).then(color => {
            song.dominant_color = color;
            if (player.currentIndex === index) {
              applyDynamicColor(color.r, color.g, color.b, getCoverSrc(song.cover_image));
            }
          });
        }
        
        // Auto play if enabled
        const autoPlayOnStart = localStorage.getItem('kimo-auto-play-on-start') === 'true';
        if (autoPlayOnStart) {
          player.audio.play().catch(e => console.error('Autoplay on start failed:', e));
        }
      }
    }
  } catch (e) {
    console.error('Failed to restore last played song on startup:', e);
  }

  // Switch to discover homepage on startup!
  switchTab('discover');
  }

  // Desktop audio-file drag and drop playback.
  // 1. 拦截原生拖放以屏蔽Webview 默认页面跳转行为
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  const playDroppedFile = async (filePath) => {
    try {
      console.log('[Drag Drop] Handling dropped file path:', filePath);
      // 判断是否已经在播放列表中
      const existingIdx = player.playlist.findIndex(s => s.file_path === filePath);
      if (existingIdx !== -1) {
        console.log('[Drag Drop] File already in playlist, playing directly. Index:', existingIdx);
        player.play(existingIdx);
        return;
      }

      const meta = await invoke('read_audio_metadata', { path: filePath });
      const fileName = filePath.substring(Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/')) + 1);
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;

            const newSong = {
        file_path: filePath,
        title: meta?.title || nameWithoutExt,
        artist: meta?.artist || '未知艺术家',
        album: meta?.album || '未知专辑',
        duration: meta?.duration || 0,
        bitrate: meta?.bitrate || 0,
        cover_image: meta?.cover_image || null
      };

      // 追加到播放列表并重新渲染
      player.playlist.push(newSong);
      renderPlaylist(player.playlist);
      
      // 异步更新本地缓存
      localStorage.setItem('kimo-playlist-cache', JSON.stringify(player.playlist));
      
      // 立即播放最后一首（即新拖入的这首）
      player.play(player.playlist.length - 1);
    } catch (err) {
      console.error('[Drag Drop] Failed to process dropped file:', err);
    }
  };

  // 2. 监听 Tauri 原生拖放事件
  try {
    if (window.__TAURI_INTERNALS__) {
      getCurrentWindow().listen('tauri://drag-drop', async (event) => {
        // payload 的格式类似于 { paths: ["C:\\path\\to\\music.mp3"] }
        const paths = event.payload?.paths;
        if (paths && paths.length > 0) {
          const musicExtensions = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma'];
          const audioFile = paths.find(p => musicExtensions.some(ext => p.toLowerCase().endsWith(ext)));
          if (audioFile) {
            await playDroppedFile(audioFile);
          } else {
            console.log('[Drag Drop] Dropped files do not contain supported audio formats:', paths);
          }
        }
      });
    } else {
      console.warn('[Drag Drop] Skipped listening to Tauri drag-drop events outside Tauri.');
    }
  } catch (e) {
    console.error('[Drag Drop] Failed to listen to tauri drag-drop events:', e);
  }

  // OS 文件关联：监听单实例模式下双击音频文件打开的事件
  listen('open-file', (event) => {
    const filePath = event.payload;
    if (filePath) {
      console.log('[File Assoc] Opening file via OS association:', filePath);
      playDroppedFile(filePath);
    }
  }).catch(() => {});

  // OS 文件关联：首次启动时检查是否通过双击音频文件启动
  if (window.__TAURI_INTERNALS__) {
    invoke('take_pending_file').then((pendingFile) => {
      if (pendingFile) {
        console.log('[File Assoc] Launching with pending file:', pendingFile);
        playDroppedFile(pendingFile);
      }
    }).catch((err) => {
      console.warn('[File Assoc] Failed to check pending file:', err);
    });
  }

  // Custom context menu for song list, album cards, etc.
  initializeCustomContextMenu({
    player,
    showToast,
    switchTab: tabName => switchTab(tabName),
    playSongCollection,
    openMetadataEditor: filePath => openMetadataEditor(filePath),
  });

  let bubbleEditor = document.getElementById('word-bubble-editor');
  if (!bubbleEditor) {
    bubbleEditor = document.createElement('div');
    bubbleEditor.id = 'word-bubble-editor';
    bubbleEditor.className = 'word-bubble-editor';
    bubbleEditor.innerHTML = `
      <div class="bubble-group">
        <label>开始时间</label>
        <input type="text" class="bubble-input start" placeholder="00:00.000" />
      </div>
      <div class="bubble-group">
        <label>原文 / 译文</label>
        <input type="text" class="bubble-input text" placeholder="歌词文本" />
      </div>
      <div class="bubble-group">
        <label>结束时间</label>
        <input type="text" class="bubble-input end" placeholder="00:00.000" />
      </div>
    `;
    document.body.appendChild(bubbleEditor);
    
    // 全局点击自动关闭气泡
    document.addEventListener('click', (e) => {
      if (!bubbleEditor.classList.contains('active')) return;
      if (bubbleEditor.contains(e.target) || e.target.closest('.word-unit-card')) {
        return;
      }
      bubbleEditor.classList.remove('active');
      document.querySelectorAll('.word-unit-card.active').forEach(c => c.classList.remove('active'));
    });
  }

  const parseLyricsFromRawText = (rawText) => {
    const { type, lyrics } = parseEditableLyrics(rawText);
    currentLyricsType = type;
    return lyrics;
  };

  const renderLyricsTimeline = (lyricsList) => {
    renderMetadataLyricsTimeline({
      lyricsList,
      bubbleEditor,
    });
  };

  const serializeLyricsFromWorkspace = () => serializeEditableLyrics({
    lyricsList: currentEditableLyrics,
    lyricsType: currentLyricsType,
  });

  const bindMetadataLyricsControls = () => bindLyricsEditorControls({
    openFile: options => open(options),
    readTextFile: path => invoke('read_text_file', { path }),
    parseLyrics: parseLyricsFromRawText,
    renderTimeline: renderLyricsTimeline,
    serializeWorkspace: serializeLyricsFromWorkspace,
    showToast,
    getLyrics: () => currentEditableLyrics,
    setLyrics: lyrics => { currentEditableLyrics = lyrics; },
    getLyricsType: () => currentLyricsType,
    getEditorMode: () => currentLyricsEditorMode,
    setEditorMode: mode => { currentLyricsEditorMode = mode; },
  });

  const bindMetadataCoverControls = (fallbackCoverSrc) => bindCoverControls({
    openFile: options => open(options),
    convertFileSrc,
    fallbackCoverSrc,
    showToast,
  });

  const openInlineMetadataEditor = async (filePath) => {
    const modal = document.getElementById('metadata-editor-modal');
    if (!modal) return;

    document.body.classList.add('metadata-editor-open');
    modal.style.display = 'flex';
    modal.classList.add('active');

    bindMetadataCoverControls(getCoverSrc(null));
    bindMetadataLyricsControls();

    try {
      const meta = await invoke('read_audio_metadata', { path: filePath });
      fillMetadataForm({ meta, filePath, getCoverSrc });

      const lyrRes = await invoke('get_lyrics', { audioPath: filePath });
      const lyricsContent = lyrRes?.content || '';
      currentLyricsEditorMode = 'timeline';

      const rawContainer = document.getElementById('lyrics-editor-raw-container');
      const viewport = document.getElementById('lyrics-editor-viewport');
      if (rawContainer) rawContainer.style.display = 'none';
      if (viewport) viewport.style.display = 'block';

      const rawToggleBtn = document.getElementById('btn-lyrics-raw-toggle');
      if (rawToggleBtn) rawToggleBtn.textContent = '切换纯文本编辑';

      const list = parseLyricsFromRawText(lyricsContent);
      currentEditableLyrics = list;
      renderLyricsTimeline(list);

      const addLineBtn = document.getElementById('btn-lyrics-add-line');
      if (addLineBtn) {
        addLineBtn.style.display = currentLyricsType === 'lrc' ? 'inline-block' : 'none';
      }

      const lyricsTextarea = document.getElementById('edit-metadata-lyrics');
      if (lyricsTextarea) lyricsTextarea.value = lyricsContent;
    } catch (error) {
      console.error('[MetadataEditor] Failed to load inline editor:', error);
      showToast('无法读取歌曲信息');
    }
  };

  const openMetadataEditor = async (filePath) => {
    const normalizedPath = typeof filePath === 'string' ? filePath.trim() : '';
    if (!normalizedPath) {
      showToast('无法打开编辑器：未获取到歌曲文件路径');
      return;
    }

    try {
      await invoke('open_metadata_editor_window', { path: normalizedPath });
    } catch (e) {
      console.error('[MetadataEditor] Failed to open standalone window:', e);
      showToast(`无法打开独立编辑窗口：${String(e)}`);
    }
  };

  const closeMetadataEditor = () => {
    const modal = document.getElementById('metadata-editor-modal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.style.display = 'none', 300);
    }
    document.body.classList.remove('metadata-editor-open');
    if (bubbleEditor) {
      bubbleEditor.classList.remove('active');
      document.querySelectorAll('.word-unit-card.active').forEach(c => c.classList.remove('active'));
    }
  };

  if (!isStandaloneEditor) {
    document.getElementById('metadata-editor-close')?.addEventListener('click', closeMetadataEditor);
    document.getElementById('metadata-editor-cancel')?.addEventListener('click', closeMetadataEditor);

    bindMetadataCoverControls("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='%23333'/></svg>");

    bindMetadataLyricsControls();

    document.getElementById('metadata-editor-save')?.addEventListener('click', async () => {
    const values = getMetadataFormValues({
      getLyricsValue: () => currentLyricsEditorMode === 'raw'
        ? document.getElementById('edit-metadata-lyrics').value
        : serializeLyricsFromWorkspace(),
    });
    const { filePath, title, artist, album, coverPath, removeCover } = values;

    if (!title) {
      showToast('歌曲标题不能为空');
      return;
    }

    setMetadataSaveBusy(true);

    try {
      await invoke('write_audio_metadata', toWriteMetadataPayload(values));

      const updatedMeta = await invoke('read_audio_metadata', { path: filePath });

      const songIdx = player.playlist.findIndex(s => s.file_path === filePath);
      if (songIdx !== -1) {
        const originalSong = player.playlist[songIdx];
        const updatedSong = {
          ...originalSong,
          title: updatedMeta.title || title,
          artist: updatedMeta.artist || artist || '未知歌手',
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
            extractDominantColor(getCoverSrc(updatedSong.cover_image), getColorOptions()).then(color => {
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

      showToast('元数据与歌词修改并保存成功');
      closeMetadataEditor();
    } catch (err) {
      console.error('[MetadataEditor] Failed to save metadata:', err);
      showToast(`保存失败: ${err}`);
    } finally {
      setMetadataSaveBusy(false);
    }
    });
  }

  // Expose openMetadataEditor globally
  window.openMetadataEditor = openMetadataEditor;

  // ══ Album Cover Context Menu and Image View Modal ══
  initializeAlbumCoverMenu({
    player,
    getCoverSrc,
    showToast,
    openMetadataEditor: filePath => openMetadataEditor(filePath),
  });

  initializeLyricsSettingsToolbar();
  applyMiniLyricsTranslationSetting();

  showStartupUpdateAnnouncement();

  // 启动时延迟检查更新
  startupUpdateCheck();

  const closeStandaloneWindow = async () => {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('[MetadataEditor] Failed to close standalone window:', error);
    }
  };

  let standaloneEditorControlsBound = false;

  // Initialize the standalone metadata and lyrics editor after the main DOM bindings.
  const initStandaloneMetadataEditor = async (filePath) => {
    if (!filePath) {
      showToast('未提供歌曲路径');
      return;
    }

    const fileName = filePath.substring(Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/')) + 1);
    const filenameTip = document.getElementById('edit-metadata-filename-tip');
    if (filenameTip) filenameTip.textContent = `编辑歌曲: ${fileName}`;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const setSrc = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.src = val;
    };

    setVal('edit-metadata-path', filePath);
    setSrc('edit-metadata-cover-preview', getCoverSrc(null));
    setVal('edit-metadata-cover-path', '');
    setVal('edit-metadata-remove-cover', 'false');

    setVal('edit-metadata-title', '');
    setVal('edit-metadata-artist', '');
    setVal('edit-metadata-album', '');
    setVal('edit-metadata-lyrics', '正在读取元数据与歌词...');

    if (!standaloneEditorControlsBound) {
      bindMetadataCoverControls(getCoverSrc(null));
      bindMetadataLyricsControls();

      const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
      };

      document.getElementById('metadata-editor-save')?.addEventListener('click', async () => {
      const values = getMetadataFormValues({
        getLyricsValue: () => currentLyricsEditorMode === 'raw'
          ? getVal('edit-metadata-lyrics')
          : serializeLyricsFromWorkspace(),
      });
      const { filePath: currentFilePath, title, artist, album, coverPath, removeCover } = values;

      if (!title) {
        showToast('歌曲标题不能为空');
        return;
      }

      setMetadataSaveBusy(true);

      try {
        await invoke('write_audio_metadata', toWriteMetadataPayload(values));

        // 发送事件同步主窗口
        await emit('metadata-saved', {
          filePath: currentFilePath,
          title,
          artist: artist || '未知歌手',
          album: album || '未知专辑',
          coverPath,
          removeCover
        });

        showToast('修改保存成功');
        setTimeout(() => {
          closeStandaloneWindow();
        }, 300);
      } catch (err) {
        console.error('[MetadataEditor] Failed to save metadata:', err);
        showToast(`保存失败：${err}`);
      } finally {
        setMetadataSaveBusy(false);
      }
      });

      standaloneEditorControlsBound = true;
    }

    try {
      const meta = await invoke('read_audio_metadata', { path: filePath });
      fillMetadataForm({ meta, filePath, getCoverSrc });

      const lyrRes = await invoke('get_lyrics', { audioPath: filePath });
      let lyricsContent = '';
      if (lyrRes && lyrRes.content) {
        lyricsContent = lyrRes.content;
      }

            currentLyricsEditorMode = 'timeline';
      const rawContainer = document.getElementById('lyrics-editor-raw-container');
      const viewport = document.getElementById('lyrics-editor-viewport');
      if (rawContainer) rawContainer.style.display = 'none';
      if (viewport) viewport.style.display = 'block';
      const rawToggleBtn = document.getElementById('btn-lyrics-raw-toggle');
      if (rawToggleBtn) rawToggleBtn.textContent = '切换纯文本编辑';

      const list = parseLyricsFromRawText(lyricsContent);
      currentEditableLyrics = list;
      renderLyricsTimeline(list);

      const addLineBtn = document.getElementById('btn-lyrics-add-line');
      if (addLineBtn) {
        addLineBtn.style.display = currentLyricsType === 'lrc' ? 'inline-block' : 'none';
      }

            const lyricsTextarea = document.getElementById('edit-metadata-lyrics');
      if (lyricsTextarea) lyricsTextarea.value = lyricsContent;
    } catch (e) {
      console.error('[MetadataEditor] Failed to fetch full metadata/lyrics on load:', e);
      const lyricsTextarea = document.getElementById('edit-metadata-lyrics');
      if (lyricsTextarea) lyricsTextarea.value = '';
    }
  };

  if (isStandaloneEditor) {
    const editorModal = document.getElementById('metadata-editor-modal');
    if (editorModal) {
      editorModal.style.display = 'flex';
      editorModal.classList.add('active', 'standalone-mode');
    }
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.style.display = 'none';

    const dragRegion = document.querySelector('.metadata-window-drag-region');
    dragRegion?.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      getCurrentWindow().startDragging().catch((error) => {
        console.error('[MetadataEditor] Failed to start window drag:', error);
      });
    });

    const handleStandaloneClose = (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeStandaloneWindow();
    };
    document.getElementById('metadata-editor-close')?.addEventListener('click', handleStandaloneClose);
    document.getElementById('metadata-editor-cancel')?.addEventListener('click', handleStandaloneClose);

    initStandaloneMetadataEditor(urlParams.get('path'));

    getCurrentWindow().listen('load-metadata', (event) => {
      if (event.payload) initStandaloneMetadataEditor(event.payload);
    }).catch((error) => {
      console.error('[MetadataEditor] Failed to listen for metadata changes:', error);
    });

    // Standalone editor initialization ends here.
  }

});
// HMR refresh trigger

