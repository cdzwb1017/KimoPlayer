import { renderAudioQualityBadgesHtml, renderArtistWithBadgesHtml } from '../utils/audio-quality.js';
import { getMonthlyRanking, getMonthlySummary, getAvailableMonths, getMonthlyCalendarData } from '../storage/play-stats.js';

const formatDuration = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}分钟`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}小时${remainMins}分钟` : `${hrs}小时`;
};

export const createDiscoverPage = ({
  player,
  getCoverSrc,
  getRecentPlays,
  renderPlaylist,
  switchTab,
}) => {
  let sessionRecommendations = null;
  let currentStatsMonth = null; // null = 当月

  const chooseRecommendations = (playlist) => {
    if (!playlist?.length) return [];
    if (sessionRecommendations?.length) return sessionRecommendations;

    const recentHistory = getRecentPlays();
    if (recentHistory.length === 0) {
      sessionRecommendations = [...playlist]
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(3, playlist.length));
      return sessionRecommendations;
    }

    const recentArtists = new Set(recentHistory.map(song => song.artist).filter(Boolean));
    const recentPaths = new Set(recentHistory.slice(0, 4).map(song => song.file_path));
    let matches = playlist.filter(song => (
      recentArtists.has(song.artist) && !recentPaths.has(song.file_path)
    ));

    if (matches.length < 3) {
      const matchedPaths = new Set(matches.map(song => song.file_path));
      const remaining = playlist
        .filter(song => !matchedPaths.has(song.file_path) && !recentPaths.has(song.file_path))
        .sort(() => 0.5 - Math.random());
      matches = [...matches, ...remaining].slice(0, 3);
    } else {
      matches = matches.sort(() => 0.5 - Math.random()).slice(0, 3);
    }

    sessionRecommendations = matches;
    return sessionRecommendations;
  };

  const renderDiscoverTab = () => {
    const listEl = document.getElementById('music-list');
    if (!listEl) return;

    const playlist = player.playlist;
    const recommended = chooseRecommendations(playlist);
    const recentPreview = getRecentPlays().slice(0, 4);

    // ── 月度统计 ──
    const availableMonths = getAvailableMonths();
    const activeMonth = currentStatsMonth || availableMonths[0] || null;
    const summary = activeMonth ? getMonthlySummary(activeMonth) : { totalPlays: 0, totalDuration: 0, uniqueSongs: 0 };
    const ranking = activeMonth ? getMonthlyRanking(activeMonth).slice(0, 10) : [];

    // 月份显示文本
    const formatMonth = (m) => {
      if (!m) return '';
      const [y, mo] = m.split('-');
      return `${y}年${Number(mo)}月`;
    };

    let html = '';

    // ── 月度听歌报告 ──
    html += `
      <div class="discover-section monthly-stats-section">
        <div class="stats-header">
          <h2 class="section-title">月度听歌报告</h2>
          <div class="stats-month-nav">
    `;
    if (availableMonths.length > 1) {
      const prevMonth = availableMonths.indexOf(activeMonth);
      if (prevMonth < availableMonths.length - 1) {
        html += `<button class="stats-month-btn" data-month="${availableMonths[prevMonth + 1]}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>`;
      } else {
        html += `<button class="stats-month-btn disabled">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>`;
      }
    }
    html += `<span class="stats-month-label">${activeMonth ? formatMonth(activeMonth) : '暂无数据'}</span>`;
    if (availableMonths.length > 1) {
      const nextMonth = availableMonths.indexOf(activeMonth);
      if (nextMonth > 0) {
        html += `<button class="stats-month-btn" data-month="${availableMonths[nextMonth - 1]}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>`;
      } else {
        html += `<button class="stats-month-btn disabled">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>`;
      }
    }
    html += `
          </div>
        </div>
    `;

    if (summary.totalPlays > 0) {
      html += `
        <div class="stats-summary-cards">
          <div class="stats-card">
            <div class="stats-card-value">${summary.totalPlays}</div>
            <div class="stats-card-label">播放次数</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-value">${formatDuration(summary.totalDuration)}</div>
            <div class="stats-card-label">听歌时长</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-value">${summary.uniqueSongs}</div>
            <div class="stats-card-label">听过歌曲</div>
          </div>
        </div>
      `;

            // 排行榜 + 日历并排
      html += `<div class="stats-body">`;

      // Top 10 排行榜
      if (ranking.length > 0) {
        html += `<div class="stats-ranking">`;
        ranking.forEach((item, idx) => {
          const rankClass = idx < 3 ? `rank-${idx + 1}` : '';
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `<span class="rank-num">${idx + 1}</span>`;
          html += `
            <div class="stats-rank-item" data-file-path="${item.filePath}">
              <div class="stats-rank-pos">${medal}</div>
              <img src="${getCoverSrc(item.cover_image)}" class="stats-rank-cover" />
              <div class="stats-rank-info">
                <div class="stats-rank-title">${item.title || '未知'}</div>
                <div class="stats-rank-artist">${item.artist || '未知'}</div>
              </div>
              <div class="stats-rank-meta">
                <span class="stats-rank-count">${item.count}次</span>
                <span class="stats-rank-duration">${formatDuration(item.totalDuration)}</span>
              </div>
            </div>
          `;
        });
        html += `</div>`;
      }

            // ── 日历热力图 ──
      if (activeMonth) {
        const calData = getMonthlyCalendarData(activeMonth);
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        const maxCount = Math.max(1, ...Object.values(calData.dailyData).map(d => d.count));

                html += `
          <div class="stats-calendar">
            <div class="calendar-weekdays">
              ${weekDays.map(d => `<span class="calendar-weekday">${d}</span>`).join('')}
            </div>
            <div class="calendar-grid">
        `;

        // 填充月初空白
        for (let i = 0; i < calData.firstDayOfWeek; i++) {
          html += `<div class="calendar-day empty"></div>`;
        }

        // 渲染每天
        const today = new Date();
        const isCurrentMonth = activeMonth === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        for (let day = 1; day <= calData.daysInMonth; day++) {
          const dayData = calData.dailyData[day] || { count: 0, duration: 0 };
          const intensity = dayData.count > 0 ? Math.min(1, dayData.count / maxCount) : 0;
          const isToday = isCurrentMonth && day === today.getDate();
          const level = intensity === 0 ? 0 : intensity < 0.25 ? 1 : intensity < 0.5 ? 2 : intensity < 0.75 ? 3 : 4;

          html += `
            <div class="calendar-day level-${level} ${isToday ? 'is-today' : ''}"
                 data-day="${day}"
                 data-count="${dayData.count}"
                 data-duration="${dayData.duration}"
                 title="${day}日: ${dayData.count}次播放">
              <span class="day-num">${day}</span>
              ${dayData.count > 0 ? `<span class="day-count">${dayData.count}</span>` : ''}
            </div>
          `;
        }

                html += `
            </div>
            <div class="calendar-legend">
              <span class="legend-label">少</span>
              <div class="legend-scale">
                <div class="legend-box level-0"></div>
                <div class="legend-box level-1"></div>
                <div class="legend-box level-2"></div>
                <div class="legend-box level-3"></div>
                <div class="legend-box level-4"></div>
              </div>
              <span class="legend-label">多</span>
            </div>
          </div>
        `;
      }

            html += `</div>`; // 关闭 stats-body

            // 阻止排行榜/日历滚动冒泡到主容器
      setTimeout(() => {
        const scrollable = listEl.querySelectorAll('.stats-ranking, .stats-calendar');
        scrollable.forEach(el => {
          el.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
        });
      }, 0);
    } else {
      html += `
        <div class="stats-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          <span>还没有播放记录，去听听歌吧~</span>
        </div>
      `;
    }

    html += `</div>`;

    // ── 今日推荐 ──
    html += `
      <div class="discover-section">
        <h2 class="section-title">今日推荐</h2>
        <div class="recommendations-grid">
    `;

    if (recommended.length > 0) {
      recommended.forEach(song => {
        const index = playlist.findIndex(item => item.file_path === song.file_path);
        html += `
          <div class="recommend-card" data-index="${index}">
            <img src="${getCoverSrc(song.cover_image)}" class="recommend-cover" />
            <div class="recommend-info">
              <div class="recommend-title">${song.title || 'Unknown Title'}</div>
              <div class="recommend-artist">${renderArtistWithBadgesHtml(song.artist, song)}</div>
            </div>
            <button class="recommend-play-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          </div>
        `;
      });
    } else {
      html += `
        <div class="empty-recommend">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>本地音乐为空，扫描本地音乐后将为您生成今日个性化推荐</span>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    // ── 最近播放 + 精选场景 ──
    html += `
      <div class="discover-row">
        <div class="discover-col col-recents">
          <h2 class="section-title">最近播放<span class="view-all-btn" id="view-all-recents">查看全部</span></h2>
          <div class="recents-list">
    `;

    if (recentPreview.length > 0) {
      recentPreview.forEach(song => {
        const index = playlist.findIndex(item => item.file_path === song.file_path);
        html += `
          <div class="recent-item" data-index="${index}" data-file-path="${song.file_path}">
            <img src="${getCoverSrc(song.cover_image)}" class="recent-cover" />
            <div class="recent-info">
              <div class="recent-title">${song.title || 'Unknown Title'}</div>
              <div class="recent-artist">${renderArtistWithBadgesHtml(song.artist, song)}</div>
            </div>
            <svg class="recent-play-icon" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        `;
      });
    } else {
      html += '<div class="empty-recents"><span>暂无播放记录，快去听听歌吧！</span></div>';
    }

    html += `
          </div>
        </div>
        <div class="discover-col col-playlists">
          <h2 class="section-title">精选场景</h2>
          <div class="scene-grid">
            <div class="scene-card scene-1" id="scene-heart">
              <div class="scene-overlay-bg"></div>
              <span class="scene-tag">心动推荐</span>
              <span class="scene-name">心动旋律</span>
            </div>
            <div class="scene-card scene-2" id="scene-afternoon">
              <div class="scene-overlay-bg"></div>
              <span class="scene-tag">午后闲暇</span>
              <span class="scene-name">午后纯音</span>
            </div>
            <div class="scene-card scene-3" id="scene-night">
              <div class="scene-overlay-bg"></div>
              <span class="scene-tag">深夜入眠</span>
              <span class="scene-name">疗愈雨声</span>
            </div>
            <div class="scene-card scene-4" id="scene-focus">
              <div class="scene-overlay-bg"></div>
              <span class="scene-tag">学习专注</span>
              <span class="scene-name">深度专注</span>
            </div>
          </div>
        </div>
      </div>
    `;

    listEl.innerHTML = html;

    // ── 事件绑定 ──

    // 推荐卡片点击
    listEl.querySelectorAll('.recommend-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = Number.parseInt(card.getAttribute('data-index'), 10);
        if (index >= 0) player.play(index);
      });
    });

    // 最近播放点击
    listEl.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = Number.parseInt(item.getAttribute('data-index'), 10);
        if (index >= 0) {
          player.play(index);
          return;
        }
        const filePath = item.getAttribute('data-file-path');
        const song = recentPreview.find(candidate => candidate.file_path === filePath);
        if (song) {
          player.playlist.push(song);
          renderPlaylist(player.playlist);
          player.play(player.playlist.length - 1);
        }
      });
    });

    // 排行榜歌曲点击
    listEl.querySelectorAll('.stats-rank-item').forEach(item => {
      item.addEventListener('click', () => {
        const filePath = item.getAttribute('data-file-path');
        const idx = player.playlist.findIndex(s => s.file_path === filePath);
        if (idx >= 0) {
          player.play(idx);
        } else {
          // 不在当前播放列表中，从统计记录中恢复
          const rankEntry = ranking.find(r => r.filePath === filePath);
          if (rankEntry) {
            const song = { file_path: filePath, title: rankEntry.title, artist: rankEntry.artist, cover_image: rankEntry.cover_image };
            player.playlist.push(song);
            renderPlaylist(player.playlist);
            player.play(player.playlist.length - 1);
          }
        }
      });
    });

    // 月份切换
    listEl.querySelectorAll('.stats-month-btn[data-month]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentStatsMonth = btn.getAttribute('data-month');
        renderDiscoverTab();
      });
    });

    document.getElementById('view-all-recents')?.addEventListener('click', () => switchTab('recent'));
    const triggerScenePlay = () => {
      if (player.playlist.length > 0) {
        player.play(Math.floor(Math.random() * player.playlist.length));
      }
    };
    ['scene-heart', 'scene-afternoon', 'scene-night', 'scene-focus'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', triggerScenePlay);
    });
  };

  return {
    renderDiscoverTab,
    resetRecommendations: () => {
      sessionRecommendations = null;
    },
  };
};
