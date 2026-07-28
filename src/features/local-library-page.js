import { renderAudioQualityBadgesHtml, renderArtistWithBadgesHtml } from '../utils/audio-quality.js';

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
    let titleLabel = '';
    let subtitleLabel = '';

    if (filter.type === 'album') {
      filteredSongs = getMusicLibrary().filter(s => (s.album || '未知专辑') === filter.name);
      titleLabel = filter.name;
      subtitleLabel = `专辑 · ${filteredSongs.length} 首歌曲`;
    } else if (filter.type === 'artist') {
      filteredSongs = getMusicLibrary().filter(s => (s.artist || '未知艺术家') === filter.name);
      titleLabel = filter.name;
      subtitleLabel = `艺术家 · ${filteredSongs.length} 首歌曲`;
    } else if (filter.type === 'genre') {
      filteredSongs = getMusicLibrary().filter(s => (s.genre || '未知流派') === filter.name);
      titleLabel = filter.name;
      subtitleLabel = `流派 · ${filteredSongs.length} 首歌曲`;
    }

    const header = document.createElement('div');
    header.className = 'detail-header';
    header.innerHTML = `
      <button class="detail-back-btn" title="返回">
      </button>
      <div class="detail-title-info">
        <div class="detail-title">${titleLabel}</div>
        <div class="detail-subtitle">${subtitleLabel}</div>
      </div>
    `;

        header.querySelector('.detail-back-btn').addEventListener('click', () => {
      currentDetailFilter = null;
      renderLocalMusicTab();
      listEl.classList.remove('page-enter');
      void listEl.offsetWidth;
      listEl.classList.add('page-enter');
    });
    listEl.appendChild(header);

    const songsListContainer = document.createElement('div');
    songsListContainer.className = 'list-songs-container';
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

      bindSongRowInteraction(div, song, filteredSongs, filteredSongs.indexOf(song));

      songsListContainer.appendChild(div);
    });
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
          // Stagger children
          requestAnimationFrame(() => {
            const items = contentEl.querySelectorAll('.song-item, .album-card, .artist-card, .genre-card');
            items.forEach((el, i) => {
              el.style.opacity = '0';
              el.style.transform = 'translate3d(0, 24px, 0)';
              el.style.transition = 'none';
              requestAnimationFrame(() => {
                el.style.transition = `opacity 0.7s cubic-bezier(0.25, 0.1, 0.25, 1) ${0.06 + i * 0.04}s, transform 0.7s cubic-bezier(0.25, 0.1, 0.25, 1) ${0.06 + i * 0.04}s`;
                el.style.opacity = '1';
                el.style.transform = 'translate3d(0, 0, 0)';
              });
            });
          });
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
        if (getMusicLibrary().length === 0) {
          songsListContainer.innerHTML = `
            <div class="search-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <div style="font-size: 14px; font-weight: 500;">本地音乐列表为空</div>
            </div>
          `;
          return;
        }

        getMusicLibrary().forEach((song) => {
          const div = document.createElement('div');
          const currentSongPath = player.playlist[player.currentIndex]?.file_path;
          const isCurrent = currentSongPath === song.file_path;

          div.className = `song-item${isCurrent ? ' playing' : ''}`;
          div.setAttribute('data-file-path', song.file_path);
          div.dataset.cover = song.cover_image || '';
          div.dataset.album = song.album || '';
          div.dataset.duration = String(song.duration || 0);
          div.classList.toggle('is-selected', selectedSongPaths.has(song.file_path));
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

          bindSongRowInteraction(div, song, getMusicLibrary(), getMusicLibrary().findIndex(item => item.file_path === song.file_path));

          songsListContainer.appendChild(div);
        });
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

      const albumsGrid = document.createElement('div');
      albumsGrid.className = 'albums-grid';
      
      Object.keys(albums).forEach(albumName => {
        const album = albums[albumName];
        const card = document.createElement('div');
        card.className = 'album-card';
        const coverSrc = getCoverSrc(album.cover);
        
        card.innerHTML = `
          <div class="album-cover-wrapper">
            <img class="album-card-cover" src="${coverSrc}" />
            <div class="album-card-play">
              <div class="album-card-play-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            </div>
          </div>
          <div class="album-card-info">
            <div class="album-card-title">${albumName}</div>
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
          currentDetailFilter = { type: 'album', name: albumName };
          renderLocalMusicTab();
          listEl.classList.remove('page-enter');
          void listEl.offsetWidth;
          listEl.classList.add('page-enter');
        });
        
        albumsGrid.appendChild(card);
      });
      listEl.appendChild(albumsGrid);

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
