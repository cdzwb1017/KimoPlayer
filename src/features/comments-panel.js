// ═══════════════════════════════════════════════════════════════
// Comments Panel — 多平台歌曲评论面板
// ═══════════════════════════════════════════════════════════════

import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { listen } from '@tauri-apps/api/event';
import { getCoverSrc } from '../utils/cover.js';
import { showToast } from '../ui/toast.js';
import { renderAudioQualityBadgesHtml, renderArtistWithBadgesHtml } from '../utils/audio-quality.js';
import { updateMarqueeState } from '../ui/transitions.js';

// ── 平台信息 ──
function getPlatformInfo(platform) {
  const map = {
    wy: { name: '网易云', cls: 'platform-wy' },
    kw: { name: '酷我', cls: 'platform-kw' },
    qq: { name: 'QQ音乐', cls: 'platform-qq' },
    kg: { name: '酷狗', cls: 'platform-kg' },
  };
  return map[platform] || { name: platform || '未知', cls: '' };
}

// ── 时间格式化 ──
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(typeof timestamp === 'number' && timestamp < 1e12 ? timestamp * 1000 : timestamp);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

// ── 模块级状态 ──
let panelEl = null;
let isVisible = false;
let currentSongId = null;
let currentTitle = '';
let currentArtist = '';
let currentAlbum = '';
let currentPlatforms = ['wy', 'kw', 'qq', 'kg'];
let currentSort = 'hot'; // 'hot' | 'time'
let allComments = [];
let platformData = {}; // { wy: { comments, total, has_more }, ... }
let isLoading = false;
let isLoadingMore = false;
let isResetMode = false; // 标记本次加载是否为重置模式
let cursors = {}; // { wy: '0', kw: '0', ... }
let playerRef = null;
const songIdCache = new Map(); // key: "title|artist" → songId
let lastRefreshTime = 0; // 上次刷新时间戳，30秒冷却

// ── DOM 引用 ──
let listEl = null;
let loadMoreEl = null;
let countEl = null;
let songTitleEl = null;
let songArtistEl = null;
let songCoverEl = null;
let filterBtns = {};

// ═══════════════════════════════════════════════════════════════
// 面板 DOM 构建
// ═══════════════════════════════════════════════════════════════

function ensurePanel() {
  if (panelEl) return panelEl;

  panelEl = document.createElement('div');
  panelEl.className = 'comments-panel';
  panelEl.innerHTML = `
    <div class="comments-header">
      <div class="comments-header-left">
        <span class="comments-title">歌曲评论</span>
        <span class="comments-count"></span>
      </div>
      <button class="comments-close-btn" title="关闭评论面板">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="comments-song-info">
      <div class="comments-song-cover-wrap">
        <img class="comments-song-cover" src="" alt="" />
        <button class="comments-play-btn" title="播放">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
      <div class="comments-song-text">
        <div class="comments-song-title"></div>
        <div class="comments-song-artist"></div>
      </div>
      <div class="comments-song-actions">
        <button class="comments-action-btn" title="刷新评论">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="comments-toolbar">
      <div class="comments-filter-group">
                <button class="comments-filter-btn active" data-platform="all">全部</button>
        <button class="comments-filter-btn" data-platform="wy">网易云</button>
        <button class="comments-filter-btn" data-platform="kw">酷我</button>
        <button class="comments-filter-btn" data-platform="qq">QQ</button>
        <button class="comments-filter-btn" data-platform="kg">酷狗</button>
      </div>
            <div class="comments-sort-group">
                <button class="comments-sort-btn" id="sort-toggle-btn">热门</button>
      </div>
    </div>

    <div class="comments-list">
      <div class="comments-loading">
        <div class="comments-spinner"></div>
        <span>正在搜索歌曲并加载评论...</span>
      </div>
    </div>
  `;

  document.body.appendChild(panelEl);

  // 缓存 DOM 引用
  countEl = panelEl.querySelector('.comments-count');
  songTitleEl = panelEl.querySelector('.comments-song-title');
  songArtistEl = panelEl.querySelector('.comments-song-artist');
  songCoverEl = panelEl.querySelector('.comments-song-cover');
    listEl = panelEl.querySelector('.comments-list');

  // 加载更多按钮动态创建在列表内部（跟随滚动）
  loadMoreEl = document.createElement('div');
  loadMoreEl.className = 'comments-load-more';
  loadMoreEl.style.display = 'none';
  loadMoreEl.innerHTML = '<button class="comments-load-more-btn">加载更多</button>';
  listEl.appendChild(loadMoreEl);

  // 监听后端逐平台推送的评论数据
  listen('comment-platform-loaded', (event) => {
    const plat = event.payload;
    const p = plat.platform;
    if (plat.error) {
      console.warn(`[Comments] ${p} error:`, plat.error);
    }

    // 更新 platformData
    if (isResetMode) {
      // 重置模式：直接覆盖
      platformData[p] = {
        comments: plat.comments || [],
        total: plat.total || 0,
        hasMore: plat.hasMore || false,
      };
      isResetMode = false; // 第一个平台到达后切换为追加模式
    } else {
      // 追加模式
      const existing = platformData[p] || { comments: [], total: 0, hasMore: false };
      existing.comments = [...existing.comments, ...(plat.comments || [])];
      existing.total = plat.total || existing.total;
      existing.hasMore = plat.hasMore || false;
      platformData[p] = existing;
    }

    // 更新 cursor
    if (plat.hasMore) {
      const currentOffset = parseInt(cursors[p] || '0', 10);
      cursors[p] = String(currentOffset + (plat.comments?.length || 20));
    } else {
      cursors[p] = null;
    }

    // 立即渲染
    renderComments();
  });

  // 关闭按钮
  panelEl.querySelector('.comments-close-btn').addEventListener('click', () => {
    hideCommentsPanel();
  });

  // 播放按钮
  panelEl.querySelector('.comments-play-btn').addEventListener('click', () => {
    if (playerRef && typeof playerRef.play === 'function' && playerRef.currentIndex >= 0) {
      playerRef.play(playerRef.currentIndex);
    }
  });

    // 刷新按钮（30秒冷却）
  panelEl.querySelector('.comments-action-btn').addEventListener('click', () => {
    if (!currentSongId) return;
    const now = Date.now();
    const remaining = Math.ceil((30000 - (now - lastRefreshTime)) / 1000);
    if (remaining > 0) {
            showToast(`不要点这么快啦！${remaining}秒后再点啦！`);
      return;
    }
    lastRefreshTime = now;
    loadComments(true);
  });

    // 平台筛选按钮
  panelEl.querySelectorAll('.comments-filter-btn').forEach(btn => {
    filterBtns[btn.dataset.platform] = btn;
    btn.addEventListener('click', () => {
      const platform = btn.dataset.platform;
      panelEl.querySelectorAll('.comments-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (platform === 'all') {
        currentPlatforms = ['wy', 'kw', 'qq', 'kg'];
      } else {
        currentPlatforms = [platform];
      }
      // 添加切换动画并滚回顶部
      listEl.scrollTop = 0;
      animateCommentSwitch();
    });
  });

      // 排序按钮 - 点按切换
  const sortToggleBtn = panelEl.querySelector('#sort-toggle-btn');
  sortToggleBtn.addEventListener('click', () => {
    currentSort = currentSort === 'hot' ? 'time' : 'hot';
    sortToggleBtn.textContent = currentSort === 'hot' ? '热门' : '最新';
    // 添加切换动画并滚回顶部
    listEl.scrollTop = 0;
    animateCommentSwitch();
  });

  // 加载更多
  loadMoreEl.querySelector('.comments-load-more-btn').addEventListener('click', () => {
    loadMoreComments();
  });

  // 滚动到底部自动加载（仅最新模式）
  listEl.addEventListener('scroll', () => {
    if (isLoadingMore || isLoading) return;
    if (currentSort !== 'time') return;
    if (loadMoreEl.style.display === 'none') return;
    // 检查是否还有更多评论可加载
    const hasAnyMore = Object.values(platformData).some(d => d?.hasMore);
    if (!hasAnyMore) return;
    const threshold = 80;
    if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - threshold) {
      loadMoreComments();
    }
  });

  // 点击面板外部关闭右键菜单
  document.addEventListener('mousedown', (e) => {
    if (contextMenuEl && !contextMenuEl.contains(e.target)) {
      hideContextMenu();
    }
  });

  return panelEl;
}

// ═══════════════════════════════════════════════════════════════
// 面板显示 / 隐藏
// ═══════════════════════════════════════════════════════════════

export function isCommentsPanelVisible() {
  return isVisible;
}

let clickOutsideHandler = null;

function setupClickOutsideListener() {
  removeClickOutsideListener();

  clickOutsideHandler = (e) => {
    if (!isVisible || !panelEl) return;

    // 检查点击目标是否在评论面板内或评论唤起按钮上
    const isInsidePanel = panelEl.contains(e.target);
    const isTriggerBtn = e.target.closest('#comments-toggle-btn, #btn-comments, .btn-comments, [data-action="comments"]');

    if (!isInsidePanel && !isTriggerBtn) {
      hideCommentsPanel();
    }
  };

  setTimeout(() => {
    document.addEventListener('pointerdown', clickOutsideHandler, true);
  }, 50);
}

function removeClickOutsideListener() {
  if (clickOutsideHandler) {
    document.removeEventListener('pointerdown', clickOutsideHandler, true);
    clickOutsideHandler = null;
  }
}

export function hideCommentsPanel() {
  if (panelEl) {
    panelEl.classList.remove('active');
  }
  isVisible = false;
  removeClickOutsideListener();
}

export function toggleCommentsPanel(player, albumName) {
  ensurePanel();
  playerRef = player;

  if (isVisible) {
    hideCommentsPanel();
    return;
  }

  // 获取当前歌曲信息
  const song = player.playlist?.[player.currentIndex];
  if (!song) {
    showToast('暂无播放歌曲');
    return;
  }

  const title = song.title || '';
  const artist = song.artist || '';
  const album = song.album || albumName || '';

  // 更新歌曲信息 UI
  songTitleEl.textContent = title || '未知歌曲';
  updateMarqueeState(songTitleEl);
  songArtistEl.innerHTML = renderArtistWithBadgesHtml(artist, song);
  songCoverEl.src = getCoverSrc(song);

  // 重置平台选择为全部
  currentPlatforms = ['wy', 'kw', 'qq', 'kg'];
  panelEl.querySelectorAll('.comments-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.platform === 'all');
  });

  // 显示面板
  panelEl.classList.add('active');
  isVisible = true;

  // 绑定点击外部区域自动收起监听器
  setupClickOutsideListener();

  // 搜索歌曲并加载评论
  searchAndLoadComments(title, artist, album);
}

// ═══════════════════════════════════════════════════════════════
// 切歌时自动更新评论面板
// ═══════════════════════════════════════════════════════════════

export function updateCommentsPanel(player) {
  if (!player) return;

  const song = player.playlist?.[player.currentIndex];
  if (!song) return;

  const title = song.title || '';
  const artist = song.artist || '';
  const album = song.album || '';

  // 如果歌名和歌手都没变，跳过
  if (title === currentTitle && artist === currentArtist) {
    console.log(`[评论面板] 歌曲未变化，跳过: ${title}`);
    return;
  }

  console.log(`[评论面板] 切歌更新: "${title}" (原: "${currentTitle}"), isVisible=${isVisible}`);

  // 更新歌曲信息 UI
  if (songTitleEl) {
    songTitleEl.removeAttribute('data-original-text');
    songTitleEl.textContent = title || '未知歌曲';
    updateMarqueeState(songTitleEl);
  }
  if (songArtistEl) songArtistEl.innerHTML = renderArtistWithBadgesHtml(artist, song);
  if (songCoverEl) songCoverEl.src = getCoverSrc(song);

  // 面板可见时重新加载评论
  if (isVisible) {
    searchAndLoadComments(title, artist, album);
  }
}

// ═══════════════════════════════════════════════════════════════
// 搜索歌曲并加载评论
// ═══════════════════════════════════════════════════════════════

async function searchAndLoadComments(title, artist, album) {
  if (!title) {
    showEmpty('请先播放一首歌曲');
    return;
  }

  currentTitle = title;
  currentArtist = artist;
  currentAlbum = album;
  allComments = [];
  platformData = {};
  cursors = {};

    showLoading();

  try {
    // 先查缓存
    const cacheKey = `${title}|${artist || ''}`;
    if (songIdCache.has(cacheKey)) {
      currentSongId = songIdCache.get(cacheKey);
      await loadComments(false);
      return;
    }

    // 搜索网易云歌曲获取 songId
    const keyword = artist ? `${title} ${artist}` : title;
    const searchResult = await invoke('search_song_for_comments', { keyword, title, artist: artist || null });

    if (!searchResult?.songs || searchResult.songs.length === 0) {
      showEmpty('未找到匹配的歌曲');
      return;
    }

    // 取第一首匹配的歌曲
    const matchedSong = searchResult.songs[0];
    currentSongId = matchedSong.id;
    songIdCache.set(cacheKey, currentSongId);

    // 加载多平台评论
    await loadComments(false);
  } catch (err) {
    console.error('[Comments] Search failed:', err);
    showEmpty('搜索歌曲失败: ' + (err?.toString() || '未知错误'));
  }
}

// ═══════════════════════════════════════════════════════════════
// 加载评论
// ═══════════════════════════════════════════════════════════════

async function loadComments(reset) {
  if (isLoading) return;
  if (!currentSongId) return;

  isLoading = true;

  if (reset) {
    allComments = [];
    platformData = {};
    cursors = {};
    isResetMode = true;
    showLoading();
  }

  try {
    // 构建 cursor 字符串（各平台偏移量用冒号分隔）
    const cursorParts = currentPlatforms.map(p => cursors[p] || '0');
    const cursor = cursorParts.join(':');

    // 触发后端加载，后端会通过 comment-platform-loaded 事件逐平台推送结果
    // 这里不 await 返回值，让前端通过事件监听实时渲染
    invoke('fetch_multi_platform_comments', {
      songId: currentSongId,
      title: currentTitle,
      artist: currentArtist || null,
      album: currentAlbum || null,
      platforms: currentPlatforms,
      cursor: cursor || null,
      limit: 20,
    }).catch(err => {
      console.error('[Comments] Load failed:', err);
      if (allComments.length === 0) {
        showEmpty('加载评论失败: ' + (err?.toString() || '未知错误'));
      }
    }).finally(() => {
      isLoading = false;
    });
  } catch (err) {
    console.error('[Comments] Load failed:', err);
    if (allComments.length === 0) {
      showEmpty('加载评论失败: ' + (err?.toString() || '未知错误'));
    }
    isLoading = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 加载更多评论
// ═══════════════════════════════════════════════════════════════

async function loadMoreComments() {
  if (isLoadingMore || isLoading) return;
  isLoadingMore = true;

  const btn = loadMoreEl.querySelector('.comments-load-more-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="comments-spinner" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px;"></span>加载中...';
  }

  await loadComments(false);

  const waitDone = () => new Promise(resolve => {
    const check = () => {
      if (!isLoading) return resolve();
      setTimeout(check, 100);
    };
    check();
  });
  await waitDone();

  isLoadingMore = false;
  if (btn) {
    btn.disabled = false;
    btn.textContent = '加载更多';
  }
}

// ═══════════════════════════════════════════════════════════════
// 标签切换动画
// ═══════════════════════════════════════════════════════════════

function animateCommentSwitch() {
  if (!listEl) return;

  // 添加淡出动画
  listEl.classList.add('comments-list-switching');

  // 动画结束后更新内容并淡入
  setTimeout(() => {
    renderComments();
    // 移除淡出类，触发淡入
    listEl.classList.remove('comments-list-switching');
    listEl.classList.add('comments-list-entering');

    // 淡入动画结束后移除类
    setTimeout(() => {
      listEl.classList.remove('comments-list-entering');
    }, 500);
  }, 200);
}

// ═══════════════════════════════════════════════════════════════
// 渲染评论列表
// ═══════════════════════════════════════════════════════════════

function renderComments() {
  if (!listEl) return;

  // 收集当前筛选平台的所有评论
  const filteredComments = [];
  for (const p of currentPlatforms) {
    const data = platformData[p];
    if (data?.comments) {
      filteredComments.push(...data.comments);
    }
  }

  // 按模式过滤：热门只保留热评，最新排除热评
  if (currentSort === 'hot') {
    const hotComments = filteredComments.filter(c => c.isHot);
    hotComments.sort((a, b) => (b.likedCount || 0) - (a.likedCount || 0));
    allComments = hotComments;
  } else {
    const latestComments = filteredComments.filter(c => !c.isHot);
    latestComments.sort((a, b) => (b.time || 0) - (a.time || 0));
    allComments = latestComments;
  }

  // 更新评论总数
  let totalAll = 0;
  for (const p of currentPlatforms) {
    totalAll += platformData[p]?.total || 0;
  }
  if (countEl) {
    countEl.textContent = totalAll > 0 ? `(${totalAll})` : '';
  }

  // 检查是否还有更多（仅最新模式下才需要加载更多）
  let hasAnyMore = false;
  if (currentSort === 'time') {
    for (const p of currentPlatforms) {
      if (platformData[p]?.hasMore) {
        hasAnyMore = true;
        break;
      }
    }
  }

  if (allComments.length === 0) {
    showEmpty(currentSort === 'hot' ? '暂无热评' : '暂无评论');
    loadMoreEl.style.display = 'none';
    return;
  }

  // 渲染评论列表（新加载的评论带缓慢上浮动画）
  const prevCount = listEl.querySelectorAll('.comment-item').length;
  listEl.innerHTML = '';
  for (let i = 0; i < allComments.length; i++) {
    const el = createCommentElement(allComments[i]);
    if (i >= prevCount && prevCount > 0) {
      el.classList.add('comment-item-entering');
      el.style.animationDelay = `${(i - prevCount) * 60}ms`;
    }
    listEl.appendChild(el);
  }

  // 底部提示：已到底 or 加载更多
  const totalLoaded = allComments.length;
  const noMoreFromAny = !hasAnyMore;

  if (noMoreFromAny || (totalAll > 0 && totalLoaded >= totalAll)) {
    // 已加载全部评论，显示到底提示
    loadMoreEl.style.display = 'none';
    const endEl = document.createElement('div');
    endEl.className = 'comments-end-hint';
    endEl.textContent = '— 你已经到底啦~ —';
    listEl.appendChild(endEl);
  } else {
    // 还有更多，显示加载更多按钮（带淡入动画）
    loadMoreEl.style.opacity = '0';
    loadMoreEl.style.display = 'block';
    loadMoreEl.style.transition = 'none';
    listEl.appendChild(loadMoreEl);
    requestAnimationFrame(() => {
      loadMoreEl.style.transition = 'opacity 0.3s ease';
      loadMoreEl.style.opacity = '1';
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 创建单条评论 DOM
// ═══════════════════════════════════════════════════════════════

function createCommentElement(comment) {
  const item = document.createElement('div');
  item.className = 'comment-item';

  const user = comment.user || {};
  const nickname = user.nickname || '匿名用户';
  const avatarUrl = user.avatarUrl;
  const content = comment.content || '';
  const platform = comment.platform;
  const platformInfo = getPlatformInfo(platform);
  const likedCount = comment.likedCount || 0;
  const replyCount = comment.replyCount || 0;
  const isHot = comment.isHot;
  const ipLocation = comment.ipLocation;
  const images = comment.images || [];
  const timeStr = formatTime(comment.time);

  // 头像
  const left = document.createElement('div');
  left.className = 'comment-left';
  if (avatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'comment-avatar';
    avatar.src = avatarUrl;
    avatar.alt = nickname;
    avatar.loading = 'lazy';
    avatar.onerror = () => {
      avatar.remove();
      const placeholder = createAvatarPlaceholder(nickname);
      left.appendChild(placeholder);
    };
    left.appendChild(avatar);
  } else {
    left.appendChild(createAvatarPlaceholder(nickname));
  }

  // 主体
  const body = document.createElement('div');
  body.className = 'comment-body';

  // 元信息行
  const meta = document.createElement('div');
  meta.className = 'comment-meta';

  if (isHot) {
    const hotTag = document.createElement('span');
    hotTag.className = 'comment-hot-tag';
    hotTag.textContent = '热评';
    meta.appendChild(hotTag);
  }

  if (platformInfo.cls) {
    const platTag = document.createElement('span');
    platTag.className = `comment-platform-tag ${platformInfo.cls}`;
        platTag.textContent = platformInfo.name;
    meta.appendChild(platTag);
  }

        const nicknameEl = document.createElement('span');
  nicknameEl.className = 'comment-nickname';
    nicknameEl.textContent = nickname;
  meta.appendChild(nicknameEl);

  if (ipLocation) {
    const ipTag = document.createElement('span');
    ipTag.className = 'comment-ip-tag';
    ipTag.textContent = ipLocation;
    meta.appendChild(ipTag);
  }

  body.appendChild(meta);

  // 评论内容
  const contentEl = document.createElement('div');
  contentEl.className = 'comment-content';
  contentEl.textContent = content;
  body.appendChild(contentEl);

  // 长评论展开/收起
  if (content.length > 100) {
    contentEl.classList.add('collapsed');
    const expandBtn = document.createElement('button');
    expandBtn.className = 'comment-expand-btn';
    expandBtn.textContent = '展开';
    expandBtn.addEventListener('click', () => {
      if (contentEl.classList.contains('collapsed')) {
        contentEl.classList.remove('collapsed');
        expandBtn.textContent = '收起';
      } else {
        contentEl.classList.add('collapsed');
        expandBtn.textContent = '展开';
      }
    });
    body.appendChild(expandBtn);
  }

  // 图片
  if (images.length > 0) {
    const imagesContainer = document.createElement('div');
    imagesContainer.className = 'comment-images';
    for (const imgUrl of images) {
      const img = document.createElement('img');
      img.className = 'comment-image';
      img.src = imgUrl;
      img.loading = 'lazy';
      img.addEventListener('click', () => {
        openUrl(imgUrl).catch(() => { window.open(imgUrl, '_blank'); });
      });
      imagesContainer.appendChild(img);
    }
    body.appendChild(imagesContainer);
  }

        // 底部操作
  const footer = document.createElement('div');
  footer.className = 'comment-footer';

  // 点赞按钮
  const likeBtn = document.createElement('button');
  likeBtn.className = 'comment-action-btn';
  likeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM4 22H2V11h2"/></svg> ${likedCount || ''}`;
  footer.appendChild(likeBtn);

    // 回复按钮（始终显示）
  const replyBtn = document.createElement('button');
  replyBtn.className = 'comment-action-btn';
  replyBtn.textContent = replyCount > 0 ? `查看回复 ${replyCount}` : '查看回复';
  replyBtn.addEventListener('click', () => {
    // 仅网易云支持查看回复，其他平台暂不支持
    if (comment.platform && comment.platform !== 'wy') {
      showToast('暂无法查看回复哦');
      return;
    }
    toggleReplies(item, comment);
  });
  footer.appendChild(replyBtn);

    body.appendChild(footer);

  item.appendChild(left);
  item.appendChild(body);

  // 时间固定在右侧
  if (timeStr) {
    const timeEl = document.createElement('span');
    timeEl.className = 'comment-time-fixed';
    timeEl.textContent = timeStr;
    item.appendChild(timeEl);
  }

  // 右键菜单
  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, comment);
  });

  return item;
}

function createAvatarPlaceholder(nickname) {
  const placeholder = document.createElement('div');
  placeholder.className = 'comment-avatar-placeholder comment-avatar';
  placeholder.textContent = (nickname || '匿')[0];
  return placeholder;
}

// ═══════════════════════════════════════════════════════════════
// 回复列表
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 回复列表（支持分页加载 + 收起）
// ═══════════════════════════════════════════════════════════════

const replyPageState = new Map(); // commentId -> { page, hasMore, replies }

async function toggleReplies(itemEl, comment) {
  const existingReplies = itemEl.querySelector('.comment-replies');
  if (existingReplies) {
    // 收起动画
    existingReplies.classList.add('closing');
    const el = existingReplies;
    setTimeout(() => {
      el.remove();
      replyPageState.delete(comment.commentId);
    }, 200);
    return;
  }

  const repliesContainer = document.createElement('div');
  repliesContainer.className = 'comment-replies';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'comment-replies-loading';
  loadingEl.innerHTML = '<div class="comments-spinner" style="width:14px;height:14px;"></div> <span style="font-size:12px;color:var(--text-secondary);margin-left:6px;">加载回复中...</span>';
  repliesContainer.appendChild(loadingEl);

  const body = itemEl.querySelector('.comment-body');
  body.appendChild(repliesContainer);

  // 初始化分页状态
  replyPageState.set(comment.commentId, { page: 1, hasMore: true, replies: [], cursor: null });

  await loadReplies(comment, repliesContainer);
}

async function loadReplies(comment, repliesContainer) {
  const state = replyPageState.get(comment.commentId);
  if (!state || !state.hasMore) return;

  try {
    const result = await invoke('fetch_comment_replies', {
      songId: currentSongId,
      commentId: comment.commentId,
      page: state.page,
      limit: 20,
      platform: comment.platform || null,
      targetId: comment.targetId || null,
      cursor: state.cursor,
    });

    if (state.page === 1) repliesContainer.innerHTML = '';

    if (!result?.replies || result.replies.length === 0) {
      if (state.page === 1) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'comment-replies-empty';
        emptyEl.textContent = '暂无回复';
        repliesContainer.appendChild(emptyEl);
      }
      state.hasMore = false;
      return;
    }

    // 按点赞数降序排序
    result.replies.sort((a, b) => (b.likedCount || 0) - (a.likedCount || 0));
    state.replies.push(...result.replies);

    // 渲染回复列表
    if (state.page === 1) {
      // 首次加载，无需特殊处理，收起按钮在底部统一添加
    }

    // 移除旧的加载更多和收起按钮
    const oldFooter = repliesContainer.querySelector('.comment-replies-footer');
    if (oldFooter) oldFooter.remove();

    // 渲染新回复
    for (const reply of result.replies) {
      const replyEl = createReplyElement(reply);
      repliesContainer.appendChild(replyEl);
    }

    // 判断是否还有更多
    state.hasMore = result.hasMore !== false && result.replies.length >= 20;
    state.cursor = result.cursor || null;
    state.page++;

    // 底部区域：加载更多 + 收起回复
    const footerEl = document.createElement('div');
    footerEl.className = 'comment-replies-footer';

    if (state.hasMore) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.textContent = '加载更多回复';
      loadMoreBtn.addEventListener('click', async () => {
        loadMoreBtn.textContent = '加载中...';
        loadMoreBtn.disabled = true;
        await loadReplies(comment, repliesContainer);
      });
      footerEl.appendChild(loadMoreBtn);
    }

    const collapseBtn = document.createElement('span');
    collapseBtn.className = 'comment-replies-collapse';
    collapseBtn.textContent = '收起回复';
    collapseBtn.addEventListener('click', () => {
      repliesContainer.classList.add('closing');
      setTimeout(() => {
        repliesContainer.remove();
        replyPageState.delete(comment.commentId);
      }, 200);
    });
    footerEl.appendChild(collapseBtn);

    repliesContainer.appendChild(footerEl);
  } catch (err) {
    console.error('[Comments] Load replies failed:', err);
    if (state.page === 1) {
      repliesContainer.innerHTML = '<div class="comment-replies-empty">加载回复失败</div>';
    }
  }
}

function createReplyElement(reply) {
  const item = document.createElement('div');
  item.className = 'comment-reply-item';

  const user = reply.user || {};
  const nickname = user.nickname || '匿名用户';
  const avatarUrl = user.avatarUrl;
  const content = reply.content || '';
  const beRepliedUser = reply.beRepliedUser;
  const timeStr = formatTime(reply.time);

  // 头像
  const left = document.createElement('div');
  left.className = 'comment-left';
  left.style.flexShrink = '0';
  if (avatarUrl) {
    const avatar = document.createElement('img');
    avatar.className = 'comment-avatar';
    avatar.src = avatarUrl;
    avatar.alt = nickname;
    avatar.loading = 'lazy';
    avatar.onerror = () => {
      avatar.remove();
      left.appendChild(createAvatarPlaceholder(nickname));
    };
    left.appendChild(avatar);
  } else {
    left.appendChild(createAvatarPlaceholder(nickname));
  }

  // 主体
  const body = document.createElement('div');
  body.className = 'comment-body';

  // 元信息
  const meta = document.createElement('div');
  meta.className = 'comment-meta';

  const nicknameEl = document.createElement('span');
  nicknameEl.className = 'comment-nickname';
  nicknameEl.textContent = nickname;
  meta.appendChild(nicknameEl);

  if (beRepliedUser?.nickname) {
    const replyTo = document.createElement('span');
    replyTo.className = 'comment-time';
    replyTo.textContent = `回复 ${beRepliedUser.nickname}`;
    meta.appendChild(replyTo);
  }

  if (reply.ipLocation) {
    const ipTag = document.createElement('span');
    ipTag.className = 'comment-ip-tag';
    ipTag.textContent = reply.ipLocation;
    meta.appendChild(ipTag);
  }

  if (timeStr) {
    const timeEl = document.createElement('span');
    timeEl.className = 'comment-time';
    timeEl.textContent = timeStr;
    meta.appendChild(timeEl);
  }

  body.appendChild(meta);

  // 内容
  const contentEl = document.createElement('div');
  contentEl.className = 'comment-content';
  contentEl.textContent = content;
  body.appendChild(contentEl);

  // 点赞数
  const likedCount = reply.likedCount || 0;
  if (likedCount > 0) {
    const likeEl = document.createElement('span');
    likeEl.className = 'comment-reply-like';
    likeEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM4 22H2V11h2"/></svg> ${likedCount}`;
    body.appendChild(likeEl);
  }

  item.appendChild(left);
  item.appendChild(body);

  return item;
}

// ═══════════════════════════════════════════════════════════════
// 加载状态
// ═══════════════════════════════════════════════════════════════

function showLoading() {
  if (!listEl) return;
  listEl.innerHTML = `
    <div class="comments-loading">
      <div class="comments-spinner"></div>
      <span>正在搜索歌曲并加载评论...</span>
    </div>
  `;
  loadMoreEl.style.display = 'none';
  listEl.appendChild(loadMoreEl);
}

function showEmpty(message) {
  if (!listEl) return;
  listEl.innerHTML = `
    <div class="comments-empty">
      <span>${message}</span>
    </div>
  `;
  loadMoreEl.style.display = 'none';
  listEl.appendChild(loadMoreEl);
}

// ═══════════════════════════════════════════════════════════════
// 评论右键菜单
// ═══════════════════════════════════════════════════════════════

let contextMenuEl = null;
let contextMenuComment = null;

function ensureContextMenu() {
  if (contextMenuEl) return contextMenuEl;
  contextMenuEl = document.createElement('div');
  contextMenuEl.className = 'comment-context-menu';
  contextMenuEl.innerHTML = `
    <div class="comment-context-menu-item" data-action="poster">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      生成评论海报
    </div>
    <div class="comment-context-menu-divider"></div>
    <div class="comment-context-menu-item" data-action="copy">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      复制评论内容
    </div>
  `;
  document.body.appendChild(contextMenuEl);

  contextMenuEl.addEventListener('click', (e) => {
    const item = e.target.closest('.comment-context-menu-item');
    if (!item) return;
    const action = item.dataset.action;
    hideContextMenu();
    if (action === 'poster' && contextMenuComment) {
      generateCommentPoster(contextMenuComment);
    } else if (action === 'copy' && contextMenuComment) {
      const text = contextMenuComment.content || '';
      navigator.clipboard.writeText(text).then(() => showToast('评论内容已复制'));
    }
  });

  return contextMenuEl;
}

function showContextMenu(x, y, commentData) {
  if (window.closeAllContextMenus) window.closeAllContextMenus();
  const menu = ensureContextMenu();
  contextMenuComment = commentData;
  menu.style.left = '0';
  menu.style.top = '0';
  menu.style.display = 'block';
  const rect = menu.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 8;
  const maxY = window.innerHeight - rect.height - 8;
  menu.style.left = Math.min(x, maxX) + 'px';
  menu.style.top = Math.min(y, maxY) + 'px';
}

function hideContextMenu() {
  if (contextMenuEl) {
    contextMenuEl.style.display = 'none';
    contextMenuComment = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 评论海报生成
// ═══════════════════════════════════════════════════════════════

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let currentLine = '';
  for (const char of text) {
    if (char === '\n') {
      lines.push(currentLine);
      currentLine = '';
      continue;
    }
    const testLine = currentLine + char;
    if (ctx.measureText(testLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function generateCommentPoster(comment) {
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  const ctx = canvas.getContext('2d');

  try {
    await document.fonts.load('bold 28px "Microsoft YaHei"');
    await document.fonts.load('20px "Microsoft YaHei"');
    await document.fonts.load('16px "Microsoft YaHei"');
    await document.fonts.load('14px "Microsoft YaHei"');
  } catch (e) {}

  const user = comment.user || {};
  const nickname = user.nickname || '匿名用户';
  const avatarUrl = user.avatarUrl;
  const content = comment.content || '';
  const platform = comment.platform;
  const platformInfo = getPlatformInfo(platform);
  const likedCount = comment.likedCount || 0;
  const time = formatTime(comment.time);

  // 绘制背景
  const gradient = ctx.createLinearGradient(0, 0, 540, 540);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.5, '#16213e');
  gradient.addColorStop(1, '#0f3460');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 540, 540);

  // 装饰圆
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(480, 60, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(60, 480, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  let y = 40;

  // 歌曲信息
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '14px "Microsoft YaHei"';
  ctx.fillText('\uD83C\uDFB5 ' + currentTitle + ' - ' + currentArtist, 40, y);
  y += 36;

  // 分隔线
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, y);
  ctx.lineTo(500, y);
  ctx.stroke();
  y += 24;

  // 评论内容
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '20px "Microsoft YaHei"';
  const contentLines = wrapText(ctx, content, 440);
  for (const line of contentLines) {
    ctx.fillText(line, 40, y);
    y += 30;
  }
  y += 20;

  // 分隔线
  ctx.beginPath();
  ctx.moveTo(40, y);
  ctx.lineTo(500, y);
  ctx.stroke();
  y += 28;

  // 用户头像
  if (avatarUrl) {
    try {
      const avatarImg = new Image();
      avatarImg.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        avatarImg.onload = resolve;
        avatarImg.onerror = reject;
        avatarImg.src = avatarUrl;
      });
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, y + 18, 18, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, 42, y, 36, 36);
      ctx.restore();
    } catch (e) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(60, y + 18, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 16px "Microsoft YaHei"';
  ctx.fillText(nickname, 88, y + 16);

  if (platformInfo) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '13px "Microsoft YaHei"';
        ctx.fillText(platformInfo.name, 88, y + 36);
  }

  // 点赞数
  if (likedCount > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px "Microsoft YaHei"';
    ctx.textAlign = 'right';
    ctx.fillText('\u2764\uFE0F ' + likedCount, 500, y + 16);
    ctx.textAlign = 'left';
  }

  // 时间
  if (time) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px "Microsoft YaHei"';
    ctx.textAlign = 'right';
    ctx.fillText(time, 500, y + 36);
    ctx.textAlign = 'left';
  }

  y += 60;

  // 底部品牌
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '12px "Microsoft YaHei"';
  ctx.textAlign = 'center';
  ctx.fillText('KimoPlayer \u00B7 \u8BC4\u8BBA\u5206\u4EAB', 270, 520);
  ctx.textAlign = 'left';

  showPosterPreview(canvas);
}

function showPosterPreview(canvas) {
  const dataUrl = canvas.toDataURL('image/png');

  const overlay = document.createElement('div');
  overlay.className = 'poster-preview-overlay';
  overlay.innerHTML = `
    <div class="poster-preview-modal">
      <div class="poster-preview-title">评论海报预览</div>
      <div class="poster-preview-image-wrap">
        <img src="${dataUrl}" alt="评论海报" />
      </div>
      <div class="poster-preview-actions">
        <button class="poster-btn-copy">\uD83D\uDCCB 复制图片</button>
        <button class="poster-btn-save">\uD83D\uDCBE 保存到本地</button>
        <button class="poster-btn-close">\u2715 关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('.poster-btn-copy').addEventListener('click', async () => {
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast('海报已复制到剪贴板');
      overlay.remove();
    } catch (e) {
      showToast('复制失败: ' + e.message);
    }
  });

  overlay.querySelector('.poster-btn-save').addEventListener('click', async () => {
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const filePath = await invoke('save_file_dialog', {
        defaultPath: '评论海报_' + currentTitle + '_' + Date.now() + '.png',
        filters: [{ name: 'PNG', extensions: ['png'] }]
      });
      if (filePath) {
        await invoke('write_binary_file', { path: filePath, data: Array.from(uint8Array) });
        showToast('海报已保存');
        overlay.remove();
      }
    } catch (e) {
      showToast('保存失败: ' + e.message);
    }
  });

  overlay.querySelector('.poster-btn-close').addEventListener('click', () => overlay.remove());
}
