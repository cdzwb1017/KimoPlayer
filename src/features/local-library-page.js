import { renderAudioQualityBadgesHtml, renderArtistWithBadgesHtml } from '../utils/audio-quality.js';

// 转义文案，防止本地文件元数据（专辑/艺术家/流派名）注入 HTML
const escapeHtml = (text) => String(text ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const createLocalLibraryPage = ({
  player,
  getCoverSrc,
  getMusicLibrary,
  getCurrentTab,
  renderRecentPlaysTab,
  showToast,
  switchTab,
}) => {
  let currentSubTab = 'all'; // 'all', 'album', 'artist', 'genre'
  let currentDetailFilter = null; // null or { type: 'album'|'artist'|'genre', name: 'xxx' }
  const selectedSongPaths = new Set();
  let isMultiSelectMode = false;

  window.showToast = showToast;

  const playSongCollection = (songs) => {
    if (!songs || songs.length === 0) return;
    player.playlist = [...songs];
    player.currentIndex = 0;
    player.play(0);
    if (getCurrentTab() === 'local') {
      renderLocalMusicTab();
    } else if (getCurrentTab() === 'recent') {
      renderRecentPlaysTab();
    }
  };

  const updateSelectionBar = () => {
    const bar = document.getElementById('local-selection-bar');
    const count = document.getElementById('local-selection-count');
    if (!bar || !count) return;
    count.textContent = `已选择 ${selectedSongPaths.size} 首`;
    bar.classList.toggle('is-visible', selectedSongPaths.size > 0);
  };

  const bindSongRowInteraction = (row, song, songs, index) => {
    let longPressTimer = null;
    let longPressTriggered = false;

    const playSong = () => {
      player.playlist = [...songs];
      player.play(index);
    };

    const toggleSelection = () => {
      selectedSongPaths.has(song.file_path)
        ? selectedSongPaths.delete(song.file_path)
        : selectedSongPaths.add(song.file_path);
      row.classList.toggle('is-selected', selectedSongPaths.has(song.file_path));
      updateSelectionBar();
    };

    row.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      longPressTriggered = false;
      longPressTimer = window.setTimeout(() => {
        const enteringMultiSelect = !isMultiSelectMode;
        isMultiSelectMode = true;
        longPressTriggered = true;
        if (!selectedSongPaths.has(song.file_path)) toggleSelection();
        if (enteringMultiSelect) showToast('已进入多选模式');
      }, 460);
    });

    const cancelLongPress = () => {
      if (longPressTimer !== null) window.clearTimeout(longPressTimer);
      longPressTimer = null;
    };
    row.addEventListener('pointerup', cancelLongPress);
    row.addEventListener('pointerleave', cancelLongPress);
    row.addEventListener('pointercancel', cancelLongPress);

    row.addEventListener('click', event => {
      if (longPressTriggered) {
        event.preventDefault();
        longPressTriggered = false;
        return;
      }
      if (isMultiSelectMode || event.ctrlKey || event.metaKey || event.shiftKey) {
        toggleSelection();
        return;
      }
      if ((localStorage.getItem('kimo-song-play-mode') || 'single') === 'single') playSong();
    });

    row.addEventListener('dblclick', event => {
      if (isMultiSelectMode) {
        event.preventDefault();
        return;
      }
      if ((localStorage.getItem('kimo-song-play-mode') || 'single') !== 'double') return;
      event.preventDefault();
      playSong();
    });
  };

  const renderCategoryDetail = (listEl, filter) => {
    let filteredSongs = [];
    let typeLabel = '';
    let iconSvg = '';

    if (filter.type === 'album') {
      filteredSongs = getMusicLibrary().filter(s => (s.album || '未知专辑') === filter.name);
      typeLabel = '专辑';
      iconSvg = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>';
    } else if (filter.type === 'artist') {
      filteredSongs = getMusicLibrary().filter(s => (s.artist || '未知艺术家') === filter.name);
      typeLabel = '艺术家';
      iconSvg = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
    } else if (filter.type === 'genre') {
      filteredSongs = getMusicLibrary().filter(s => (s.genre || '未知流派') === filter.name);
      typeLabel = '流派';
      iconSvg = '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>';
    }

    const totalSeconds = filteredSongs.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
    const fmtDuration = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      return h > 0
        ? `${h}小时${String(m).padStart(2, '0')}分`
        : m > 0 ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`;
    };
    const coverSong = filteredSongs[0];

    // 详情页 Hero 头部：渐变背景 + 封面 + 类型徽标 + 统计 + 操作按钮
    const hero = document.createElement('div');
    hero.className = 'detail-hero';
    hero.innerHTML = `
      <div class="detail-hero-bg"></div>
      <div class="detail-hero-inner">
        <button class="detail-back-btn" title="返回" aria-label="返回">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="detail-hero-content">
          <div class="detail-hero-cover${coverSong && coverSong.cover_image ? '' : ' detail-hero-cover--gradient'}">
            ${coverSong && coverSong.cover_image
              ? `<img class="detail-hero-img" src="${escapeHtml(getCoverSrc(coverSong))}" alt="" loading="lazy" decoding="async" />`
              : `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${iconSvg}</svg>`}
            <div class="detail-hero-cover-play" title="播放全部">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
          <div class="detail-hero-info">
            <div class="detail-hero-type">${typeLabel}</div>
            <div class="detail-hero-title">${escapeHtml(filter.name)}</div>
            <div class="detail-hero-stats">${filteredSongs.length} 首歌曲 · 总时长 ${fmtDuration(totalSeconds)}</div>
            <div class="detail-hero-actions">
              <button class="detail-hero-btn primary" data-action="play">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                播放全部
              </button>
              <button class="detail-hero-btn" data-action="shuffle">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
                随机播放
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    hero.querySelector('.detail-back-btn').addEventListener('click', () => {
      currentDetailFilter = null;
      renderLocalMusicTab();
      listEl.classList.remove('page-enter');
      void listEl.offsetWidth;
      listEl.classList.add('page-enter');
    });
    const playAll = () => playSongCollection(filteredSongs);
    hero.querySelector('.detail-hero-cover-play').addEventListener('click', playAll);
    hero.querySelector('[data-action="play"]').addEventListener('click', playAll);
    hero.querySelector('[data-action="shuffle"]').addEventListener('click', () => {
      playSongCollection([...filteredSongs].sort(() => Math.random() - 0.5));
    });
    listEl.appendChild(hero);

    renderSongs(filteredSongs);
  };

  const renderSongs = (filteredSongs) => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;

    const songsListContainer = document.createElement('div');
    songsListContainer.className = 'list-songs-container detail-list-enter';
    listEl.appendChild(songsListContainer);

    filteredSongs.forEach(song => {
      const div = document.createElement('div');
      const mainIdx = player.playlist.findIndex(s => s.file_path === song.file_path);
      const isCurrent = mainIdx >= 0 && mainIdx === player.currentIndex;
      
      div.className = `song-item${isCurrent ? ' playing' : ''}`;
      div.setAttribute('data-file-path', song.file_path);
      div.dataset.cover = song.cover_image || '';
      div.dataset.album = song.album || '';
      div.dataset.duration = String(song.duration || 0);
      const coverSrc = getCoverSrc(song);
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
        <div class="song-duration">${song.duration ? Math.floor(Math.round(song.duration) / 60) + ':' + (Math.round(song.duration) % 60).toString().padStart(2, '0') : ''}</div>
      `;

      bindSongRowInteraction(div, song, filteredSongs, filteredSongs.indexOf(song));
      songsListContainer.appendChild(div);
    });
  };

  // ══ 专辑网格分批渲染（仿局域网 LunaBeat 同款机制）══
  const LOCAL_ALBUM_BATCH = 60;

  /** 创建单张专辑卡片（含点击进入详情 / 播放专辑） */
  const createLocalAlbumCard = (album) => {
    const card = document.createElement('div');
    card.className = 'album-card';
    const coverSrc = escapeHtml(getCoverSrc(album.cover));
    card.innerHTML = `
      <div class="album-cover-wrapper">
        <img class="album-card-cover" src="${coverSrc}" loading="lazy" decoding="async" />
        <div class="album-card-play">
          <div class="album-card-play-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      </div>
      <div class="album-card-info">
        <div class="album-card-title">${escapeHtml(album.name)}</div>
        <div class="album-card-count">${album.songs.length} 首歌曲</div>
      </div>
    `;
    card.addEventListener('click', (e) => {
      const playBtn = card.querySelector('.album-card-play-btn');
      if (playBtn && (playBtn.contains(e.target) || e.target === playBtn)) {
        e.stopPropagation();
        playSongCollection(album.songs);
        return;
      }
      currentDetailFilter = { type: 'album', name: album.name };
      renderLocalMusicTab();
      const listEl = document.getElementById('music-list');
      if (listEl) {
        listEl.classList.remove('page-enter');
        void listEl.offsetWidth;
        listEl.classList.add('page-enter');
      }
    });
    return card;
  };

  /** 批量渲染专辑卡片（DocumentFragment 插入） */
  const appendLocalAlbumBatch = (grid, albumsList, startIndex) => {
    const endIndex = Math.min(startIndex + LOCAL_ALBUM_BATCH, albumsList.length);
    const frag = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      frag.appendChild(createLocalAlbumCard(albumsList[i]));
    }
    grid.appendChild(frag);
  };

  /** 专辑网格滚动哨兵：触底追加下一批卡片 */
  const setupLocalAlbumsScroll = (grid, albumsList) => {
    if (albumsList.length <= LOCAL_ALBUM_BATCH) return;
    let nextStart = LOCAL_ALBUM_BATCH;
    const sentinel = document.createElement('div');
    sentinel.className = 'luna-batch-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    grid.appendChild(sentinel);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (nextStart >= albumsList.length) {
          observer.disconnect();
          sentinel.remove();
          return;
        }
        appendLocalAlbumBatch(grid, albumsList, nextStart);
        nextStart += LOCAL_ALBUM_BATCH;
        if (sentinel.parentNode === grid) grid.appendChild(sentinel);
      }
    }, { root: null, rootMargin: '300px 0px' });
    observer.observe(sentinel);
  };

  // ══ 歌曲行分批渲染（全部歌曲视图，仿专辑网格机制）══
  const LOCAL_SONG_BATCH = 100;

  /** 创建单首歌曲行（含多选/播放绑定，index 用预建 Map 避免 O(n²)） */
  const createLocalSongRow = (song, index, indexMap) => {
    const div = document.createElement('div');
    const currentSongPath = player.playlist[player.currentIndex]?.file_path;
    const isCurrent = currentSongPath === song.file_path;

    div.className = `song-item${isCurrent ? ' playing' : ''}`;
    div.setAttribute('data-file-path', song.file_path);
    div.dataset.cover = song.cover_image || '';
    div.dataset.album = song.album || '';
    div.dataset.duration = String(song.duration || 0);
    div.classList.toggle('is-selected', selectedSongPaths.has(song.file_path));
    const coverSrc = escapeHtml(getCoverSrc(song));
    const isPaused = player.audio.paused;

    div.innerHTML = `
      <img src="${coverSrc}" class="song-cover" loading="lazy" decoding="async" />
      <div class="song-info">
        <div class="song-title">${escapeHtml(song.title || 'Unknown')}</div>
        <div class="song-artist">${renderArtistWithBadgesHtml(song.artist, song)}</div>
      </div>
      <div class="eq-animation ${isPaused ? 'paused' : ''}">
        <div class="eq-bar"></div>
        <div class="eq-bar"></div>
        <div class="eq-bar"></div>
        <div class="eq-bar"></div>
      </div>
      <div class="song-duration">${song.duration ? Math.floor(Math.round(song.duration) / 60) + ':' + (Math.round(song.duration) % 60).toString().padStart(2, '0') : ''}</div>
    `;

    bindSongRowInteraction(div, song, getMusicLibrary(), indexMap.get(song.file_path) ?? index);
    return div;
  };

  /** 批量渲染歌曲行（DocumentFragment 插入） */
  const appendLocalSongBatch = (container, songs, startIndex, indexMap) => {
    const endIndex = Math.min(startIndex + LOCAL_SONG_BATCH, songs.length);
    const frag = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      frag.appendChild(createLocalSongRow(songs[i], i, indexMap));
    }
    container.appendChild(frag);
  };

  /** 歌曲列表滚动哨兵：触底追加下一批（避免全量渲染数千行） */
  const setupLocalSongsScroll = (container, songs, indexMap) => {
    if (songs.length <= LOCAL_SONG_BATCH) return;
    let nextStart = LOCAL_SONG_BATCH;
    const sentinel = document.createElement('div');
    sentinel.className = 'luna-batch-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    container.appendChild(sentinel);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (nextStart >= songs.length) {
          observer.disconnect();
          sentinel.remove();
          return;
        }
        appendLocalSongBatch(container, songs, nextStart, indexMap);
        nextStart += LOCAL_SONG_BATCH;
        if (sentinel.parentNode === container) container.appendChild(sentinel);
      }
    }, { root: null, rootMargin: '300px 0px' });
    observer.observe(sentinel);
  };

  const renderLocalMusicTab = () => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    const toolbarEl = document.getElementById('content-toolbar');
    if (toolbarEl) toolbarEl.innerHTML = '';
    listEl.innerHTML = '';

    if (getMusicLibrary().length === 0) {
      listEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; color: var(--text-secondary); gap: 16px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <div style="font-size: 14px; font-weight: 500;">您的本地音乐库为空，请在设置中"添加扫描文件夹"后点击扫描</div>
          <button id="empty-goto-settings-btn" style="padding:9px 24px;font-size:13px;font-weight:600;border:none;border-radius:10px;background:rgb(var(--dynamic-color,16,185,129));color:#fff;cursor:pointer;transition:opacity 0.2s;">去添加</button>
        </div>
      `;
      listEl.querySelector('#empty-goto-settings-btn')?.addEventListener('click', () => {
        if (switchTab) switchTab('settings');
        // 延迟等待设置页渲染完成后滚动定位到扫描文件夹卡片
        setTimeout(() => {
          const scanCard = document.getElementById('settings-scan-card');
          if (scanCard) {
            scanCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 短暂高亮提示
            scanCard.style.transition = 'box-shadow 0.3s ease';
            scanCard.style.boxShadow = '0 0 0 2px rgb(var(--dynamic-color,16,185,129))';
            setTimeout(() => { scanCard.style.boxShadow = ''; }, 2000);
          }
        }, 100);
      });
      return;
    }

    if (currentDetailFilter) {
      renderCategoryDetail(listEl, currentDetailFilter);
      return;
    }

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'local-tabs';
    tabsContainer.innerHTML = `
      <button class="local-tab-btn ${currentSubTab === 'all' ? 'active' : ''}" data-subtab="all">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        全部歌曲
      </button>
      <button class="local-tab-btn ${currentSubTab === 'album' ? 'active' : ''}" data-subtab="album">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        专辑
      </button>
      <button class="local-tab-btn ${currentSubTab === 'artist' ? 'active' : ''}" data-subtab="artist">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        艺术家
      </button>
      <button class="local-tab-btn ${currentSubTab === 'genre' ? 'active' : ''}" data-subtab="genre">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        流派
      </button>
    `;
    (toolbarEl || listEl).appendChild(tabsContainer);

    // Set initial scrolled state if container is already scrolled
    const initialContentArea = document.querySelector('.content-area');
    if (initialContentArea && initialContentArea.scrollTop > 5) {
      tabsContainer.classList.add('scrolled');
    }

        tabsContainer.querySelectorAll('.local-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sub = btn.getAttribute('data-subtab');
        currentSubTab = sub;
        currentDetailFilter = null;
        renderLocalMusicTab();

        const contentEl = listEl.querySelector('.list-songs-container, .albums-grid, .artists-grid, .genres-grid');
        if (contentEl) {
          contentEl.classList.remove('page-enter');
          void contentEl.offsetWidth;
          contentEl.classList.add('page-enter');
        }
      });
    });

    if (currentSubTab === 'all') {
      const selectionBar = document.createElement('div');
      selectionBar.id = 'local-selection-bar';
      selectionBar.className = 'local-selection-bar';
      selectionBar.innerHTML = `<span id="local-selection-count">已选择 0 首</span><button id="local-selection-add">添加到歌单</button><button id="local-selection-clear">取消</button>`;
      listEl.appendChild(selectionBar);

      const songsListContainer = document.createElement('div');
      songsListContainer.id = 'local-songs-list';
      songsListContainer.className = 'list-songs-container';
      listEl.appendChild(songsListContainer);

      selectionBar.querySelector('#local-selection-add').addEventListener('click', () => {
        const selectedSongs = getMusicLibrary().filter(song => selectedSongPaths.has(song.file_path));
        if (selectedSongs.length && typeof window.addToPlaylistMenu === 'function') window.addToPlaylistMenu(selectedSongs);
      });
      selectionBar.querySelector('#local-selection-clear').addEventListener('click', () => {
        selectedSongPaths.clear();
        isMultiSelectMode = false;
        renderLocalMusicTab();
      });

      const renderAllSongs = () => {
        songsListContainer.innerHTML = '';
        const library = getMusicLibrary();
        if (library.length === 0) {
          songsListContainer.innerHTML = `
            <div class="search-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <div style="font-size: 14px; font-weight: 500;">本地音乐列表为空</div>
            </div>
          `;
          return;
        }

        // 预建 file_path → index 映射，避免每行 findIndex 造成 O(n²)
        const indexMap = new Map(library.map((s, i) => [s.file_path, i]));
        // 分批渲染 + 滚动追加 + 封面懒加载：避免全量渲染数千行导致卡顿
        appendLocalSongBatch(songsListContainer, library, 0, indexMap);
        setupLocalSongsScroll(songsListContainer, library, indexMap);
      };

      renderAllSongs();
      updateSelectionBar();

    } else if (currentSubTab === 'album') {
      const albums = {};
      getMusicLibrary().forEach(song => {
        const albumName = song.album || '未知专辑';
        if (!albums[albumName]) {
          albums[albumName] = {
            name: albumName,
            cover: song.cover_image,
            songs: []
          };
        }
        albums[albumName].songs.push(song);
      });

      const albumsList = Object.keys(albums).map(name => albums[name]);
      const albumsGrid = document.createElement('div');
      albumsGrid.className = 'albums-grid';
      // 分批渲染 + 滚动追加 + 封面懒加载：避免全量渲染几百张卡片导致滚动卡顿
      appendLocalAlbumBatch(albumsGrid, albumsList, 0);
      listEl.appendChild(albumsGrid);
      setupLocalAlbumsScroll(albumsGrid, albumsList);
      albumsGrid.classList.remove('page-enter');
      void albumsGrid.offsetWidth;
      albumsGrid.classList.add('page-enter');
    } else if (currentSubTab === 'artist') {
      const artists = {};
      getMusicLibrary().forEach(song => {
        const artistName = song.artist || '未知艺术家';
        if (!artists[artistName]) {
          artists[artistName] = {
            name: artistName,
            cover: song.cover_image,
            songs: []
          };
        }
        artists[artistName].songs.push(song);
      });

      const artistsGrid = document.createElement('div');
      artistsGrid.className = 'artists-grid';
      
      Object.keys(artists).forEach(artistName => {
        const artist = artists[artistName];
        const card = document.createElement('div');
        card.className = 'artist-card';
        const coverSrc = getCoverSrc(artist.cover);
        
        card.innerHTML = `
          <div class="artist-avatar-wrapper">
            <img class="artist-card-avatar" src="${coverSrc}" />
          </div>
          <div class="artist-card-title">${artistName}</div>
          <div class="artist-card-count">${artist.songs.length} 首歌曲</div>
        `;
        
                card.addEventListener('click', () => {
          currentDetailFilter = { type: 'artist', name: artistName };
          renderLocalMusicTab();
          listEl.classList.remove('page-enter');
          void listEl.offsetWidth;
          listEl.classList.add('page-enter');
        });
        
        artistsGrid.appendChild(card);
      });
      listEl.appendChild(artistsGrid);

    } else if (currentSubTab === 'genre') {
      const genres = {};
      getMusicLibrary().forEach(song => {
        const genreName = song.genre || '未知流派';
        if (!genres[genreName]) {
          genres[genreName] = {
            name: genreName,
            songs: []
          };
        }
        genres[genreName].songs.push(song);
      });

      const genresGrid = document.createElement('div');
      genresGrid.className = 'genres-grid';

      const gradients = [
        'linear-gradient(135deg, #f53b57 0%, #3c40c6 100%)',
        'linear-gradient(135deg, #05c46b 0%, #0fbcf9 100%)',
        'linear-gradient(135deg, #ffc048 0%, #ff5e57 100%)',
        'linear-gradient(135deg, #575fcf 0%, #f53b57 100%)',
        'linear-gradient(135deg, #0be881 0%, #05c46b 100%)',
        'linear-gradient(135deg, #4bcffa 0%, #3c40c6 100%)',
      ];
      const getGenreGradient = (name) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return gradients[Math.abs(hash) % gradients.length];
      };

      Object.keys(genres).forEach(genreName => {
        const genre = genres[genreName];
        const card = document.createElement('div');
        card.className = 'genre-card';
        card.style.background = getGenreGradient(genreName);
        
        card.innerHTML = `
          <div class="genre-card-title">${genreName}</div>
          <div class="genre-card-count">${genre.songs.length} 首歌曲</div>
        `;
        
                card.addEventListener('click', () => {
          currentDetailFilter = { type: 'genre', name: genreName };
          renderLocalMusicTab();
          listEl.classList.remove('page-enter');
          void listEl.offsetWidth;
          listEl.classList.add('page-enter');
        });
        
        genresGrid.appendChild(card);
      });
      listEl.appendChild(genresGrid);
    }
  };

  return {
    renderLocalMusicTab,
    playSongCollection,
  };
};
