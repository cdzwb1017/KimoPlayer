/**
 * LunaBeat 局域网曲库页面
 * 浏览并播放来自 LunaBeat 手机 App 的音乐
 */
import { renderArtistWithBadgesHtml } from '../../utils/audio-quality.js';
import { COVER_SIZE_SMALL } from './luna-beat-adapter.js';
import { renderLoadingPlaceholder } from '../../ui/loading-state.js';

export const createLunaBeatPage = ({
  player,
  getCoverSrc,
  showToast,
  switchTab,
  getCurrentTab,
}) => {
  let currentView = 'songs';
  let songsCache = [];
  let albumsCache = [];
  let artistsCache = [];
  let foldersCache = [];
  let currentSubFilter = null;
  let searchQuery = '';
  let searchTimer = null;
  let searchInFlight = null; // 全量拉取 in-flight 复用，避免连续输入并发请求
  let searchBoxFocused = false; // 搜索框聚焦状态：列表刷新重建工具栏后恢复焦点
  let isLoading = false;
  // 滚动分页加载：歌曲列表不再一次性拉全量，初始 50 首，滚动触底再抓下一页 50 首
  const PAGE_SIZE = 50;
  let currentPage = 0;       // 已加载到第几页（0 = 未加载）
  let totalSongs = 0;        // 服务端报告的曲库总数
  let isLoadingPage = false; // 正在抓取下一页中，防止哨兵重复触发
  // 连接状态：'unknown' | 'connecting' | 'online' | 'offline'
  let connectionStatus = 'unknown';

  async function _getAdapter() {
    const { getLunaBeatAdapter } = await import('./luna-beat-adapter-utils.js');
    return getLunaBeatAdapter();
  }

  async function ensureConnected() {
    try {
      const adapter = await _getAdapter();
      if (!adapter) {
        connectionStatus = 'offline';
        return null;
      }
      connectionStatus = 'connecting';
      await adapter.ensureAuth();
      connectionStatus = 'online';
      return adapter;
    } catch (e) {
      connectionStatus = 'offline';
      showToast(`LunaBeat 连接失败: ${e.message}`, 'error');
      return null;
    }
  }

  /**
   * 加载下一页歌曲（被哨兵触底调用）：
   * - 调用 adapter.getSongsPage 抓下一页
   * - 按 _lunaId 去重后并入 songsCache
   * - 更新 totalSongs / currentPage
   * - 返回这一页是否有新增歌曲
   */
  async function loadNextSongsPage() {
    if (isLoadingPage) return false;
    // 已全部加载完
    if (totalSongs > 0 && songsCache.length >= totalSongs) return false;

    isLoadingPage = true;
    try {
      const adapter = await ensureConnected();
      if (!adapter) return false;
      const nextPage = currentPage + 1;
      const res = await adapter.getSongsPage(nextPage, PAGE_SIZE);
      totalSongs = res.total || 0;

      if (res.songs && res.songs.length > 0) {
        const seen = new Set(songsCache.map(s => String(s?._lunaId ?? '')));
        const newOnes = res.songs.filter(s => {
          const id = String(s?._lunaId ?? '');
          if (!id) return true;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        songsCache = songsCache.concat(newOnes);
        currentPage = nextPage;
        return newOnes.length > 0;
      }
      // 最后一页没数据：标记已到底
      if (totalSongs === 0) totalSongs = songsCache.length;
      return false;
    } catch (e) {
      showToast(`加载下一页失败: ${e.message}`, 'error');
      return false;
    } finally {
      isLoadingPage = false;
    }
  }

  async function loadAllData(force = false) {
    if (isLoading) return;
    isLoading = true;
    isLoadingPage = false;
    currentPage = 0;
    totalSongs = 0;
    songsCache = [];
    renderToolbar(); // 立即反映 connecting 状态
    const adapter = await ensureConnected();
    if (!adapter) { isLoading = false; renderToolbar(); return; }

    try {
      // ⭐ 歌曲列表改为「滚动分页加载」：初始只抓第一页 50 首，滚到底再抓下一页
      // 专辑/艺人/文件夹仍一次性全量拉（数据量小，且要和 songsCache 关联时兜底拉全量）
      const [firstPage, albums, artists, folders] = await Promise.all([
        adapter.getSongsPage(1, PAGE_SIZE),
        adapter.getAlbums(),
        adapter.getArtists(),
        adapter.getFolders(),
      ]);

      albumsCache = albums;
      artistsCache = artists;
      foldersCache = folders;

      songsCache = Array.isArray(firstPage.songs) ? firstPage.songs : [];
      totalSongs = firstPage.total || songsCache.length;
      currentPage = songsCache.length > 0 ? 1 : 0;

      if (force) {
        const loaded = songsCache.length;
        const total = totalSongs || loaded;
        const tip = loaded < total
          ? `已刷新（已加载 ${loaded}/${total} 首，继续滚动加载更多）`
          : `已刷新曲库（${loaded} 首）`;
        showToast(tip, 'success');
      }
    } catch (e) {
      showToast(`加载失败: ${e.message}`, 'error');
    } finally {
      isLoading = false;
      renderToolbar();
    }
  }

  // 只更新播放状态（不重建 DOM，避免滚动跳动和封面闪烁）
  const updatePlayingState = () => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    const currentPlaying = player.playlist[player.currentIndex];
    const currentLunaId = currentPlaying?._lunaId != null ? String(currentPlaying._lunaId) : null;
    const isPaused = !player.audio || player.audio.paused;

    listEl.querySelectorAll('.song-item').forEach(row => {
      const isCurrent = currentLunaId != null && row.dataset.filePath === currentLunaId;
      row.classList.toggle('playing', isCurrent);
      const eq = row.querySelector('.eq-animation');
      if (eq) eq.classList.toggle('paused', isPaused);
    });
  };

  function playCollection(songs) {
    if (!songs || songs.length === 0) return;
    player.playlist = songs.map(s => ({
      ...s,
      duration: s.durationMs ? s.durationMs / 1000 : (s.duration || 0),
    }));
    player.currentIndex = 0;
    player.playFromLunaBeat(0);
    if (getCurrentTab() === 'luna') {
      updatePlayingState();
    }
  }

  const playSong = (song, collection, index) => {
    player.playlist = collection.map(s => ({
      ...s,
      duration: s.durationMs ? s.durationMs / 1000 : (s.duration || 0),
    }));
    player.currentIndex = index;
    player.playFromLunaBeat(index);
    if (getCurrentTab() === 'luna') {
      updatePlayingState();
    }
  };

  function formatMs(val) {
    if (!val || isNaN(val) || val <= 0) return '0:00';
    // 统一按毫秒处理：durationMs 字段直接用；秒级 duration（罕见）需 > 1000 才转换单位
    // 阈值取 1000：正常歌曲 3-5 分钟 = 180000-300000ms，秒级也会 > 1000
    // 边界：10 秒歌 durationMs=10000 不会被误判为秒（原阈值 10000 会误判为 10000 秒）
    let totalSec;
    if (val > 1000) {
      totalSec = Math.round(val / 1000);
    } else {
      totalSec = Math.round(val);
    }
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
  }

  const bindSongRow = (row, song, collection, index) => {
    row.addEventListener('click', () => playSong(song, collection, index));
    row.addEventListener('dblclick', (e) => {
      e.preventDefault();
      playSong(song, collection, index);
    });
  };

  const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // ====== 虚拟滚动：哨兵触底分批渲染 + 滚动 API 分页加载 ======
  // 大曲库（如 5000+ 首）一次性 forEach 渲染会卡顿且占用大量内存。
  // 采用首批 BATCH_SIZE 行 + IntersectionObserver 哨兵触底追加，避免固定行高假设。
  const BATCH_SIZE = 60;
  const nextStartHolder = new WeakMap(); // container -> 下一批 DOM 渲染的起始索引

  /**
   * 分批渲染歌曲行到 container（纯 DOM 行为，不涉及 API 分页加载）
   * @param {HTMLElement} container
   * @param {Array} songs        已在内存中的歌曲数组（songsCache 或其子集）
   * @param {number} startIndex  songs 中从第几个开始渲染 DOM
   */
  function appendSongBatch(container, songs, startIndex) {
    const endIndex = Math.min(startIndex + BATCH_SIZE, songs.length);
    for (let i = startIndex; i < endIndex; i++) {
      const song = songs[i];
      const row = document.createElement('div');
      const currentPlaying = player.playlist[player.currentIndex];
      const isPlaying = !!(currentPlaying && currentPlaying._lunaId != null && String(currentPlaying._lunaId) === String(song._lunaId));
      row.className = `song-item${isPlaying ? ' playing' : ''}`;
      row.dataset.filePath = song._lunaId;
      row.innerHTML = renderSongRowHtml(song, isPlaying);
      observeCover(row.querySelector('.song-cover'), song._lunaId);
      container.appendChild(row);
      bindSongRow(row, song, songs, i);
    }
    nextStartHolder.set(container, endIndex);
  }

  /**
   * 哨兵尾部占位（不显示任何提示，静默加载；保留函数仅用于兼容旧调用点）
   */
  function ensurePageFooter() {
    return null;
  }

  // 静默加载：不显示任何「继续滚动」「加载中」「已全部」文字提示
  function setPageFooter(_container, _text, _opts = {}) {
    // no-op: 用户明确不需要底部提示
  }

  function removePageFooterAndSentinel(container, observer) {
    if (observer) observer.disconnect();
    const sentinel = container.querySelector('.luna-batch-sentinel');
    if (sentinel && sentinel.parentNode) sentinel.parentNode.removeChild(sentinel);
  }

  /**
   * 启动哨兵观察：详情页筛选歌曲列表用（album/artist/folder 筛选 → songsCache 子集，
   * 纯 DOM 分批渲染，不再触发 API 分页加载）
   * @param {HTMLElement} container 列表容器（首批已由调用方渲染）
   * @param {Array} songs 全量歌曲（内存中的子数组，不再翻页）
   */
  function setupBatchScroll(container, songs) {
    if (songs.length <= BATCH_SIZE) return; // 无需分批
    nextStartHolder.set(container, BATCH_SIZE);

    const sentinel = document.createElement('div');
    sentinel.className = 'luna-batch-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    container.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        let nextStart = nextStartHolder.get(container) || songs.length;
        if (nextStart >= songs.length) {
          removePageFooterAndSentinel(container, observer);
          return;
        }
        appendSongBatch(container, songs, nextStart);
        // ⭐ 关键：每追加一批 DOM 后把 sentinel 重新挪到 container 最后，
        // 否则 sentinel 会停留在「第一波末尾」，新追加的 rows 永远不触发。
        if (sentinel.parentNode === container) {
          container.appendChild(sentinel);
        }
      }
    }, { root: null, rootMargin: '300px 0px' });

    observer.observe(sentinel);
  }

  /**
   * 启动「歌曲视图」哨兵：DOM 分批渲染 + API 分页加载 合二为一
   * 触发顺序：
   *   1. songsCache 内还有未渲染的 DOM → 先 appendSongBatch 渲染 DOM
   *   2. songsCache 已全部渲染完，但 songsCache < totalSongs → 调 loadNextSongsPage() 抓新一页，
   *      然后自动把新一页里首个未渲染部分继续 appendSongBatch
   *   3. songsCache >= totalSongs → 拆掉哨兵
   */
  function setupSongsViewScroll(container) {
    nextStartHolder.set(container, Math.min(BATCH_SIZE, songsCache.length));

    const sentinel = document.createElement('div');
    sentinel.className = 'luna-batch-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    container.appendChild(sentinel);

    const observer = new IntersectionObserver(async (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        // (A) 先处理 DOM 分批：songsCache 里还有没渲染的
        let nextStart = nextStartHolder.get(container) || 0;
        if (nextStart < songsCache.length) {
          appendSongBatch(container, songsCache, nextStart);
          // ⭐ 追加完一批后把 sentinel 挪到最后，避免停留在第一波末尾
          if (sentinel.parentNode === container) container.appendChild(sentinel);
          const updatedNext = nextStartHolder.get(container) || songsCache.length;
          if (updatedNext < songsCache.length) return;
        }

        // (B) DOM 已覆盖整个 songsCache，检查是否还有下一页 API 数据
        const total = totalSongs || songsCache.length;
        if (songsCache.length >= total) {
          removePageFooterAndSentinel(container, observer);
          return;
        }

        // (C) 调 API 抓下一页 50 首
        if (isLoadingPage) return;
        const hadNew = await loadNextSongsPage();
        if (!hadNew) {
          removePageFooterAndSentinel(container, observer);
          return;
        }
        // 有新数据 → 只追加渲染「新增那部分」的首批（最多 BATCH_SIZE）
        const newNext = nextStartHolder.get(container) || 0;
        if (newNext < songsCache.length) {
          appendSongBatch(container, songsCache, newNext);
          // ⭐ 又追加了 DOM → sentinel 再次挪到最后
          if (sentinel.parentNode === container) container.appendChild(sentinel);
        }
        const stillLess = songsCache.length < (totalSongs || total);
        if (!stillLess) removePageFooterAndSentinel(container, observer);
      }
    }, { root: null, rootMargin: '400px 0px' });

    observer.observe(sentinel);
  }

  // 封面懒加载 Observer（利用 IntersectionObserver 避免瞬间发起数百个 IPC 请求导致 WebView2 崩溃）
  // 注：缓存统一由 LunaBeatAdapter._coverUrlCache 管理，此处不再维护独立 Map，避免双份缓存导致内存翻倍
  let coverObserver = null;

  const FALLBACK_COVER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='%23333'/></svg>";

  const initCoverObserver = () => {
    if (coverObserver) {
      coverObserver.disconnect();
    }
    coverObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const imgEl = entry.target;
          const lunaId = imgEl.dataset.lunaId;
          if (imgEl && coverObserver) {
            coverObserver.unobserve(imgEl);
          }
          if (lunaId) {
            loadCoverLazy(imgEl, lunaId);
          }
        }
      });
    }, { rootMargin: '150px 0px' });
  };

  const loadCoverLazy = async (imgEl, lunaId) => {
    if (!imgEl || !lunaId) return;
    // 避免虚拟滚动下重复触发时，旧请求覆盖新 DOM（幂等 + 归属校验）
    if (imgEl.dataset.loaded === '1' && imgEl.classList.contains('is-loaded')) return;

    const markLoaded = () => {
      if (!imgEl) return;
      // 下一帧再加 class，确保 transition 能触发（避免浏览器合并同帧样式）
      requestAnimationFrame(() => {
        if (imgEl) imgEl.classList.add('is-loaded');
      });
      try { imgEl.dataset.loaded = '1'; } catch (_) {}
    };

    try {
      const adapter = await _getAdapter();
      if (!adapter) { imgEl.src = FALLBACK_COVER; markLoaded(); return; }
      // 列表缩略图固定使用 480，节省带宽 & 减轻下载压力；大封面由播放流程单独拉 1440
      const url = await adapter.getCoverBlobUrl({ _lunaId: lunaId }, COVER_SIZE_SMALL);
      const finalUrl = url || FALLBACK_COVER;
      if (!imgEl) return;

      // 用 decode() 等解码完成再淡入，避免大图半解码突兀显示
      imgEl.onerror = () => {
        imgEl.onerror = null;
        imgEl.onload = null;
        if (imgEl.src !== FALLBACK_COVER) {
          imgEl.src = FALLBACK_COVER;
          // fallback 图极小可直接淡入
          markLoaded();
        } else {
          markLoaded();
        }
      };
      imgEl.onload = async () => {
        imgEl.onload = null;
        imgEl.onerror = null;
        try {
          if (typeof imgEl.decode === 'function') {
            await imgEl.decode();
          }
        } catch (_) { /* decode 失败不影响显示 */ }
        markLoaded();
      };
      imgEl.src = finalUrl;
      // data URI/FALLBACK 缓存命中时可能不触发 load 事件，兜底 1 帧后直接标记
      if (finalUrl === FALLBACK_COVER || finalUrl.startsWith('data:')) {
        requestAnimationFrame(() => {
          if (imgEl && !imgEl.classList.contains('is-loaded')) markLoaded();
        });
      }
    } catch (e) {
      if (imgEl) {
        imgEl.onerror = null;
        imgEl.onload = null;
        imgEl.src = FALLBACK_COVER;
        markLoaded();
      }
    }
  };

  const observeCover = (imgEl, lunaId) => {
    if (!imgEl || !lunaId) return;
    imgEl.dataset.lunaId = lunaId;
    if (!coverObserver) {
      initCoverObserver();
    }
    coverObserver.observe(imgEl);
  };

  const renderToolbar = () => {
    const toolbar = document.getElementById('content-toolbar');
    if (!toolbar) return;
    toolbar.innerHTML = '';
    toolbar.className = 'content-toolbar luna-toolbar';

    // 左侧：子标签（复用本地 .local-tabs .local-tab-btn 样式，保持视觉统一）
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'local-tabs luna-local-tabs';

    const views = [
      { key: 'songs', label: '歌曲', icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>` },
      { key: 'albums', label: '专辑', icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>` },
      { key: 'artists', label: '艺人', icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` },
      { key: 'folders', label: '文件夹', icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>` },
    ];

    views.forEach(v => {
      const btn = document.createElement('button');
      btn.className = `local-tab-btn ${currentView === v.key ? 'active' : ''}`;
      btn.innerHTML = `${v.icon}<span>${v.label}</span>`;
      btn.addEventListener('click', () => {
        currentView = v.key;
        currentSubFilter = null;
        clearTimeout(searchTimer); // 防止迟到的防抖搜索复活搜索模式
        searchQuery = ''; // 切换分类时退出搜索模式
        renderCurrentView();
      });
      tabsContainer.appendChild(btn);
    });
    toolbar.appendChild(tabsContainer);

    // 中间：局域网歌曲搜索框（防抖过滤 songsCache，必要时先全量拉取）
    const searchWrap = document.createElement('div');
    searchWrap.className = 'luna-search-box';
    searchWrap.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="luna-search-input" placeholder="搜索局域网歌曲..." autocomplete="off" />
      <button id="luna-search-clear" class="luna-search-clear" title="清除搜索" style="display: none;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    toolbar.appendChild(searchWrap);

    const searchInput = searchWrap.querySelector('#luna-search-input');
    const searchClearBtn = searchWrap.querySelector('#luna-search-clear');
    if (searchQuery) {
      searchInput.value = searchQuery;
      searchClearBtn.style.display = '';
    }
    searchInput.addEventListener('focus', () => { searchBoxFocused = true; });
    searchInput.addEventListener('blur', () => { searchBoxFocused = false; });
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim();
      searchClearBtn.style.display = q ? '' : 'none';
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => performSearch(q), 300);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimer);
        performSearch(searchInput.value.trim());
      }
    });
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchClearBtn.style.display = 'none';
      // 清空后把焦点还给搜索框，方便继续输入新词（点击 × 时 input 已 blur，需显式恢复）
      searchBoxFocused = true;
      clearSearch();
    });

    // 列表刷新（renderCurrentView 重建工具栏）后恢复搜索框焦点与光标位置，
    // 避免输入过程中防抖搜索触发重渲染导致焦点丢失。
    // 用 rAF 延迟到下一帧：同一帧内重建 DOM 后立即 focus() 在 WebView2 上偶发不生效
    if (searchBoxFocused) {
      requestAnimationFrame(() => {
        // 用户可能已在帧间隙主动离开（blur 置 false），复查后再恢复
        if (!searchBoxFocused) return;
        const input = document.getElementById('luna-search-input');
        if (input) {
          input.focus();
          const len = input.value.length;
          input.setSelectionRange(len, len);
        }
      });
    }

    // 右侧：播放全部 + 连接状态徽标 + 手动刷新按钮
    const rightWrap = document.createElement('div');
    rightWrap.className = 'luna-toolbar-right';

    // 计算当前视图的可播放歌曲集合和标签
    let playAllData = null; // { label, count, onClick }
    if (connectionStatus === 'online') {
      if (currentSubFilter) {
        const typeKey = currentSubFilter.type;
        let filtered = [];
        let label = '播放全部';
        if (typeKey === 'album') {
          filtered = songsCache.filter(s => s.album === currentSubFilter.name);
          label = '播放专辑';
        } else if (typeKey === 'artist') {
          filtered = songsCache.filter(s => s.artist === currentSubFilter.name);
          label = '播放全部';
        } else if (typeKey === 'folder') {
          filtered = songsCache.filter(s => s.folder === currentSubFilter.name || (s.path && s.path.includes(currentSubFilter.name)));
          label = '播放文件夹';
        }
        if (filtered.length > 0) {
          playAllData = { label, count: filtered.length, songs: filtered };
        }
      } else if (searchQuery) {
        // 搜索模式：播放全部作用于搜索结果而非整个曲库
        const results = filterSongs(searchQuery);
        if (results.length > 0) {
          playAllData = { label: '播放全部', count: results.length, songs: results };
        }
      } else if (currentView === 'songs' && songsCache.length > 0) {
        playAllData = { label: '播放全部', count: songsCache.length, songs: songsCache };
      }
    }
    if (playAllData) {
      const playAllBtn = document.createElement('button');
      playAllBtn.className = 'luna-play-all luna-play-all-toolbar';
      playAllBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>${playAllData.label}</span>`;
      playAllBtn.addEventListener('click', () => playCollection(playAllData.songs));
      rightWrap.appendChild(playAllBtn);
    }

    const statusDot = document.createElement('span');
    const statusMap = {
      online: { cls: 'luna-status online', text: '已连接' },
      connecting: { cls: 'luna-status connecting', text: '连接中…' },
      offline: { cls: 'luna-status offline', text: '未连接' },
      unknown: { cls: 'luna-status unknown', text: '未连接' },
    };
    const s = statusMap[connectionStatus] || statusMap.unknown;
    statusDot.className = s.cls;
    statusDot.innerHTML = `<span class="luna-status-dot"></span><span>${s.text}</span>`;
    rightWrap.appendChild(statusDot);

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'luna-refresh-btn';
    refreshBtn.title = '刷新曲库';
    refreshBtn.disabled = isLoading;
    refreshBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${isLoading ? 'is-spinning' : ''}"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    refreshBtn.addEventListener('click', () => {
      if (isLoading) return;
      loadAllData(true).then(() => {
        currentSubFilter = null;
        renderCurrentView();
      });
    });
    rightWrap.appendChild(refreshBtn);

    toolbar.appendChild(rightWrap);
  };

  // 列表填充后的交错入场动画（与本地列表风格一致）
  const animateListEnter = (listEl) => {
    const contentEl = listEl.querySelector('.list-songs-container, .albums-grid, .artists-grid, .genres-grid');
    if (!contentEl) return;
    contentEl.classList.remove('page-enter');
    void contentEl.offsetWidth;
    contentEl.classList.add('page-enter');
  };

  /**
   * 创建单张专辑卡片（供分批渲染复用）
   */
  const createAlbumCard = (album) => {
    const card = document.createElement('div');
    card.className = 'album-card';
    const albumName = album.title || album.album || '未知专辑';
    // 筛选键容错：服务端专辑对象可能只有 title 没有 album 字段
    const albumKey = album.album || album.title;
    card.innerHTML = `
      <div class="album-cover-wrapper">
        <img class="album-card-cover luna-cover-fade" src="" alt="" loading="lazy" decoding="async" />
        <div class="album-card-play">
          <div class="album-card-play-btn" title="播放专辑">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      </div>
      <div class="album-card-info">
        <div class="album-card-title">${escapeHtml(albumName)}</div>
        <div class="album-card-count">${Number(album.songCount) || 0} 首歌曲</div>
      </div>
    `;
    // 封面兜底：audioId 缺失（含空字符串）时从该专辑任一首歌取 _lunaId，避免封面永久空白
    let coverLunaId = album.audioId;
    if (!coverLunaId) {
      const sample = songsCache.find(s => s.album === albumKey);
      if (sample) coverLunaId = sample._lunaId;
    }
    observeCover(card.querySelector('img'), coverLunaId);
    card.addEventListener('click', (e) => {
      const playBtn = card.querySelector('.album-card-play-btn');
      if (playBtn && (playBtn.contains(e.target) || e.target === playBtn)) {
        e.stopPropagation();
        const albumSongs = songsCache.filter(s => s.album === albumKey);
        playCollection(albumSongs);
        return;
      }
      currentSubFilter = { type: 'album', name: albumKey, audioId: album.audioId };
      renderCurrentView();
    });
    return card;
  };

  /**
   * 分批渲染专辑卡片（首批 + 滚动追加共用，DocumentFragment 批量插入）
   */
  function appendAlbumBatch(container, albums, startIndex) {
    const endIndex = Math.min(startIndex + BATCH_SIZE, albums.length);
    const frag = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      frag.appendChild(createAlbumCard(albums[i]));
    }
    container.appendChild(frag);
    nextStartHolder.set(container, endIndex);
  }

  /**
   * 启动专辑网格哨兵：滚到底部附近追加下一批卡片，避免一次性渲染全部专辑导致首屏慢、滚动卡顿
   */
  function setupAlbumsGridScroll(container, albums) {
    if (albums.length <= BATCH_SIZE) return; // 数量少无需分批
    nextStartHolder.set(container, BATCH_SIZE);

    const sentinel = document.createElement('div');
    sentinel.className = 'luna-batch-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    container.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        let nextStart = nextStartHolder.get(container) || albums.length;
        if (nextStart >= albums.length) {
          removePageFooterAndSentinel(container, observer);
          return;
        }
        appendAlbumBatch(container, albums, nextStart);
        // ⭐ 追加完一批后把 sentinel 挪到最后，避免停留在「第一波末尾」不再触发
        if (sentinel.parentNode === container) {
          container.appendChild(sentinel);
        }
      }
    }, { root: null, rootMargin: '300px 0px' });

    observer.observe(sentinel);
  }

  /** 按查询过滤歌曲（标题/歌手/专辑，大小写不敏感）——搜索视图与播放全部共用 */
  function filterSongs(query) {
    const q = query.toLowerCase();
    return songsCache.filter(s => {
      const title = String(s.title || '').toLowerCase();
      const artist = String(s.artist || '').toLowerCase();
      const album = String(s.album || '').toLowerCase();
      return title.includes(q) || artist.includes(q) || album.includes(q);
    });
  }

  /**
   * 局域网歌曲搜索：防抖后过滤 songsCache（标题/歌手/专辑模糊匹配）。
   * 数据不足时先全量拉取，保证搜索结果覆盖整个曲库。
   */
  async function performSearch(query) {
    if (!query) {
      // 清空：优先只更新列表（filterSongs('') 返回全部歌曲），不重建工具栏、保持焦点；
      // 但 songsCache 未全量时需回到带滚动分页的完整视图，否则列表无法继续加载
      searchQuery = '';
      if (totalSongs > 0 && songsCache.length < totalSongs) {
        renderCurrentView();
      } else {
        renderSearchView();
      }
      return;
    }
    searchQuery = query;
    // 分页加载模式下 songsCache 可能不完整：搜索前确保全量（带加载反馈）
    if (totalSongs > 0 && songsCache.length < totalSongs) {
      const listEl = document.getElementById('music-list');
      if (listEl) {
        renderLoadingPlaceholder(listEl, {
          title: '正在加载全部歌曲以支持搜索…',
          sub: '正在获取局域网完整曲库，请稍候',
        });
      }
      try {
        const adapter = await ensureConnected();
        if (!adapter) {
          // 未连接：降级渲染（搜索结果基于已加载的部分缓存），避免卡在加载占位
          renderSearchView();
          return;
        }
        if (!searchInFlight) {
          searchInFlight = (async () => {
            const all = await adapter.getSongs();
            songsCache = all;
            totalSongs = all.length;
          })();
        }
        await searchInFlight;
      } catch (e) {
        console.warn('[LunaBeat] Failed to load full songs for search:', e);
      } finally {
        searchInFlight = null;
      }
    }
    // 等待全量拉取期间用户可能已清空/切 tab：仅当搜索模式仍激活时才渲染搜索视图
    if (searchQuery) {
      renderSearchView();
    } else {
      renderCurrentView();
    }
  }

  /** 渲染搜索结果：只更新列表、不重建工具栏（保持搜索框焦点与输入状态） */
  function renderSearchView() {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    renderSearchResults(listEl, filterSongs(searchQuery));
    animateListEnter(listEl);
  }

  function clearSearch() {
    clearTimeout(searchTimer);
    searchQuery = '';
    renderCurrentView();
  }

  /** 渲染搜索结果列表（复用分批渲染，纯 DOM 分批不翻页） */
  function renderSearchResults(listEl, results) {
    if (results.length === 0) {
      listEl.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-secondary);">未找到匹配「${escapeHtml(searchQuery)}」的歌曲</div>`;
      return;
    }
    const container = document.createElement('div');
    container.className = 'list-songs-container';
    appendSongBatch(container, results, 0);
    listEl.appendChild(container);
    setupBatchScroll(container, results);
  }

  const renderCurrentView = () => {
    initCoverObserver();
    renderToolbar();
    const listEl = document.getElementById('music-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (isLoading) {
      // 连接中 vs 数据加载：展示不同文案，提升等待体验
      if (connectionStatus === 'connecting') {
        renderLoadingPlaceholder(listEl, {
          title: '正在连接 LunaBeat 服务…',
          sub: '请确认手机端 LunaBeat App 已开启「局域网 Web 音乐服务」，且与电脑处于同一网络',
        });
      } else {
        renderLoadingPlaceholder(listEl, {
          title: '正在加载局域网曲库…',
          sub: '正在获取歌曲、专辑与艺人信息，请稍候',
        });
      }
      return;
    }

    // 搜索模式：过滤 songsCache 并渲染结果（不进入分类视图）
    if (searchQuery) {
      renderSearchResults(listEl, filterSongs(searchQuery));
      animateListEnter(listEl);
      return;
    }

    switch (currentView) {
      case 'songs': renderSongsView(listEl); break;
      case 'albums': renderAlbumsView(listEl); break;
      case 'artists': renderArtistsView(listEl); break;
      case 'folders': renderFoldersView(listEl); break;
    }

    animateListEnter(listEl);
  };

  const renderSongRowHtml = (song, isPlaying) => {
    // audio-quality 工具从 file_path 扩展名判断音质，LunaBeat 的 file_path 是 luna://id 无扩展名
    // 这里构造虚拟路径让其按 format 字段正确识别无损/Hi-Res
    const songForBadge = { ...song, file_path: `luna.${song.format || 'mp3'}` };
    const isPaused = !player.audio || player.audio.paused;

    return `
      <img src="" class="song-cover luna-cover-fade" alt="" loading="lazy" decoding="async" />
      <div class="song-info">
        <div class="song-title">${escapeHtml(song.title)}</div>
        <div class="song-artist">${renderArtistWithBadgesHtml(song.artist, songForBadge)}</div>
      </div>
      <div class="eq-animation ${isPaused ? 'paused' : ''}">
        <div class="eq-bar"></div>
        <div class="eq-bar"></div>
        <div class="eq-bar"></div>
        <div class="eq-bar"></div>
      </div>
      <div class="song-duration">${formatMs(song.durationMs || song.duration)}</div>
    `;
  };

  // 详情页 Hero 头部：渐变背景 + 大封面 + 类型徽标 + 统计 + 操作按钮
  const buildDetailHero = (filter, filteredSongs, onBack) => {
    const typeLabel = filter.type === 'album' ? '专辑' : filter.type === 'artist' ? '艺人' : '文件夹';
    const totalSeconds = filteredSongs.reduce((sum, s) => sum + ((s.durationMs || 0) / 1000 || s.duration || 0), 0);
    const fmtDuration = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      return h > 0
        ? `${h}小时${String(m).padStart(2, '0')}分`
        : m > 0 ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`;
    };
    const isFolder = filter.type === 'folder';

    const hero = document.createElement('div');
    hero.className = 'detail-hero';
    hero.innerHTML = `
      <div class="detail-hero-bg"></div>
      <div class="detail-hero-inner">
        <button class="detail-back-btn" title="返回" aria-label="返回">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="detail-hero-content">
          <div class="detail-hero-cover${isFolder ? ' detail-hero-cover--gradient' : ''}">
            ${isFolder
              ? '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
              : '<img class="detail-hero-img luna-cover-fade" src="" alt="" loading="lazy" decoding="async" />'}
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
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
                随机播放
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    hero.querySelector('.detail-back-btn').addEventListener('click', onBack);
    // 封面懒加载（专辑/艺人带 audioId；缺失时从集合首曲兜底；文件夹用渐变图标）
    const coverImg = hero.querySelector('.detail-hero-img');
    let coverLunaId = filter.audioId;
    if (coverImg && !coverLunaId) {
      const sample = filteredSongs[0];
      if (sample && sample._lunaId != null) coverLunaId = sample._lunaId;
    }
    if (coverImg && coverLunaId) observeCover(coverImg, coverLunaId);
    // 封面点击与播放全部按钮共用
    const playAll = () => playCollection(filteredSongs);
    hero.querySelector('.detail-hero-cover-play').addEventListener('click', playAll);
    hero.querySelector('[data-action="play"]').addEventListener('click', playAll);
    hero.querySelector('[data-action="shuffle"]').addEventListener('click', () => {
      playCollection([...filteredSongs].sort(() => Math.random() - 0.5));
    });
    return hero;
  };

  // 详情页歌曲列表：Hero 头部 + 分批歌曲列表（播放按钮已移至 Hero）
  const renderDetailSongList = (listEl, filter, filteredSongs, playAllLabel) => {
    listEl.appendChild(buildDetailHero(
      filter,
      filteredSongs,
      () => { currentSubFilter = null; renderCurrentView(); }
    ));

    if (filteredSongs.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 40px; text-align: center; color: var(--text-secondary);';
      empty.textContent = '暂无歌曲';
      listEl.appendChild(empty);
      return;
    }

    const container = document.createElement('div');
    container.className = 'list-songs-container detail-list-enter';
    appendSongBatch(container, filteredSongs, 0);
    listEl.appendChild(container);
    setupBatchScroll(container, filteredSongs);
  };

  const renderSongsView = (listEl) => {
    const songs = songsCache;
    if (songs.length === 0) {
      listEl.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary);">暂无歌曲</div>';
      return;
    }

    const container = document.createElement('div');
    container.className = 'list-songs-container';

    // 首批渲染 + 歌曲视图哨兵（同时处理 DOM 分批 & 滚动时 API 分页加载下一页 50 首）
    appendSongBatch(container, songs, 0);
    listEl.appendChild(container);
    setupSongsViewScroll(container);
  };

  const renderAlbumsView = (listEl) => {
    const albums = albumsCache;
    if (albums.length === 0) {
      listEl.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary);">暂无专辑</div>';
      return;
    }

    if (currentSubFilter && currentSubFilter.type === 'album') {
      const filteredSongs = songsCache.filter(s => s.album === currentSubFilter.name);
      renderDetailSongList(listEl, currentSubFilter, filteredSongs, '播放专辑');
      return;
    }

    const container = document.createElement('div');
    container.className = 'albums-grid';
    // 分批渲染：首批 BATCH_SIZE 张，滚动触底追加，避免全量渲染导致加载慢/滚动卡顿
    appendAlbumBatch(container, albums, 0);
    listEl.appendChild(container);
    setupAlbumsGridScroll(container, albums);
  };

  // ══ 艺人/文件夹网格分批渲染（与专辑网格同款机制）══
  const createArtistCard = (artist) => {
    const card = document.createElement('div');
    card.className = 'artist-card';
    const artistName = artist.name || artist.title || '未知艺人';
    card.innerHTML = `
      <div class="artist-avatar-wrapper">
        <img class="artist-card-avatar luna-cover-fade" src="" alt="" loading="lazy" decoding="async" />
      </div>
      <div class="artist-card-title">${escapeHtml(artistName)}</div>
      <div class="artist-card-count">${Number(artist.songCount) || 0} 首歌曲</div>
    `;
    observeCover(card.querySelector('img'), artist.audioId);
    card.addEventListener('click', () => {
      currentSubFilter = { type: 'artist', name: artist.name || artist.title, audioId: artist.audioId };
      renderCurrentView();
    });
    return card;
  };

  const appendArtistBatch = (container, artists, startIndex) => {
    const endIndex = Math.min(startIndex + BATCH_SIZE, artists.length);
    const frag = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      frag.appendChild(createArtistCard(artists[i]));
    }
    container.appendChild(frag);
  };

  const setupArtistsGridScroll = (container, artists) => {
    if (artists.length <= BATCH_SIZE) return;
    let nextStart = BATCH_SIZE;
    const sentinel = document.createElement('div');
    sentinel.className = 'luna-batch-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    container.appendChild(sentinel);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (nextStart >= artists.length) {
          observer.disconnect();
          sentinel.remove();
          return;
        }
        appendArtistBatch(container, artists, nextStart);
        nextStart += BATCH_SIZE;
        if (sentinel.parentNode === container) container.appendChild(sentinel);
      }
    }, { root: null, rootMargin: '300px 0px' });
    observer.observe(sentinel);
  };

  const renderArtistsView = (listEl) => {
    const artists = artistsCache;
    if (artists.length === 0) {
      listEl.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary);">暂无艺人</div>';
      return;
    }

    if (currentSubFilter && currentSubFilter.type === 'artist') {
      const filteredSongs = songsCache.filter(s => s.artist === currentSubFilter.name);
      renderDetailSongList(listEl, currentSubFilter, filteredSongs, '播放全部');
      return;
    }

    const container = document.createElement('div');
    container.className = 'artists-grid';
    // 分批渲染：首批 BATCH_SIZE 张，滚动触底追加，避免全量渲染导致卡顿
    appendArtistBatch(container, artists, 0);
    listEl.appendChild(container);
    setupArtistsGridScroll(container, artists);
  };

  // ══ 文件夹网格分批渲染（渐变卡片）══
  const folderGradients = [
    'linear-gradient(135deg, #f53b57 0%, #3c40c6 100%)',
    'linear-gradient(135deg, #05c46b 0%, #0fbcf9 100%)',
    'linear-gradient(135deg, #ffc048 0%, #ff5e57 100%)',
    'linear-gradient(135deg, #575fcf 0%, #f53b57 100%)',
    'linear-gradient(135deg, #0be881 0%, #05c46b 100%)',
    'linear-gradient(135deg, #4bcffa 0%, #3c40c6 100%)',
  ];
  const getFolderGradient = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return folderGradients[Math.abs(hash) % folderGradients.length];
  };
  const createFolderCard = (folder) => {
    const card = document.createElement('div');
    card.className = 'genre-card';
    const folderName = folder.name || folder.title || '未知文件夹';
    card.style.background = getFolderGradient(folderName);
    card.innerHTML = `
      <div class="genre-card-title">${escapeHtml(folderName)}</div>
      <div class="genre-card-count">${Number(folder.songCount) || 0} 首歌曲</div>
    `;
    card.addEventListener('click', () => {
      currentSubFilter = { type: 'folder', name: folder.name || folder.title, audioId: folder.audioId };
      renderCurrentView();
    });
    return card;
  };
  const appendFolderBatch = (container, folders, startIndex) => {
    const endIndex = Math.min(startIndex + BATCH_SIZE, folders.length);
    const frag = document.createDocumentFragment();
    for (let i = startIndex; i < endIndex; i++) {
      frag.appendChild(createFolderCard(folders[i]));
    }
    container.appendChild(frag);
  };
  const setupFoldersGridScroll = (container, folders) => {
    if (folders.length <= BATCH_SIZE) return;
    let nextStart = BATCH_SIZE;
    const sentinel = document.createElement('div');
    sentinel.className = 'luna-batch-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    container.appendChild(sentinel);
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (nextStart >= folders.length) {
          observer.disconnect();
          sentinel.remove();
          return;
        }
        appendFolderBatch(container, folders, nextStart);
        nextStart += BATCH_SIZE;
        if (sentinel.parentNode === container) container.appendChild(sentinel);
      }
    }, { root: null, rootMargin: '300px 0px' });
    observer.observe(sentinel);
  };

  const renderFoldersView = (listEl) => {
    const folders = foldersCache;
    if (folders.length === 0) {
      listEl.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary);">暂无文件夹</div>';
      return;
    }

    if (currentSubFilter && currentSubFilter.type === 'folder') {
      const filteredSongs = songsCache.filter(s => s.folder === currentSubFilter.name || (s.path && s.path.includes(currentSubFilter.name)));
      renderDetailSongList(listEl, currentSubFilter, filteredSongs, '播放文件夹');
      return;
    }

    const container = document.createElement('div');
    container.className = 'genres-grid';
    // 分批渲染：首批 BATCH_SIZE 张，滚动触底追加，避免全量渲染导致卡顿
    appendFolderBatch(container, folders, 0);
    listEl.appendChild(container);
    setupFoldersGridScroll(container, folders);
  };

  // 右键菜单导航：切换到指定视图 + 打开子筛选
  const navigateTo = (view, subFilter = null) => {
    if (view && typeof view === 'string') currentView = view;
    currentSubFilter = subFilter;
    if (getCurrentTab() !== 'luna') switchTab('luna');
    // 确保在 LunaBeat Tab 中再渲染
    setTimeout(() => renderCurrentView(), 0);
  };

  const enter = async () => {
    if (songsCache.length === 0) {
      await loadAllData();
    }
    renderCurrentView();
  };

  // ══ 全局桥：供 context-menu.js 识别 LunaBeat 来源与回读数据 ══
  // 使用 WeakRef 思路：只暴露只读 getter，避免跨模块闭包引用引起内存泄漏
  window.kimoLunaContext = {
    getSongsCache: () => songsCache,
    getAlbumsCache: () => albumsCache,
    getArtistsCache: () => artistsCache,
    getFoldersCache: () => foldersCache,
    getSongById: (id) => songsCache.find(s => s._lunaId === id),
    navigateTo,
  };

  // 自动切歌（如播放完下一首）时也更新播放状态，不重建 DOM
  window.addEventListener('kimo-song-changed', () => {
    if (getCurrentTab() === 'luna') updatePlayingState();
  });

  return {
    enter,
    renderCurrentView,
  };
};
