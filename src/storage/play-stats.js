/**
 * 播放统计模块
 * 记录每首歌的播放次数和播放时长，按月归档
 * 数据结构: { "2026-07": { "file_path": { count, totalDuration } } }
 */
const PLAY_STATS_KEY = 'kimo-play-stats';

// 内存缓存 + 防抖写入：连续播放时不每次全量序列化整个统计对象，
// 统一在 2 秒空闲后合并写一次，降低写放大与配额耗尽风险。
let pendingStats = null;
let dirty = false;
let writeTimer = null;

export const getPlayStats = () => {
  if (pendingStats !== null) return pendingStats;
  try {
    const cached = localStorage.getItem(PLAY_STATS_KEY);
    pendingStats = cached ? JSON.parse(cached) : {};
  } catch {
    pendingStats = {};
  }
  return pendingStats;
};

const persistStats = (stats) => {
  try {
    localStorage.setItem(PLAY_STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    // 配额满：剥离体积最大的 cover_image 字段重试一次
    try {
      const slim = {};
      for (const [month, songs] of Object.entries(stats)) {
        slim[month] = {};
        for (const [path, entry] of Object.entries(songs)) {
          const { cover_image, ...rest } = entry;
          slim[month][path] = rest;
        }
      }
      localStorage.setItem(PLAY_STATS_KEY, JSON.stringify(slim));
      console.warn('[PlayStats] 存储空间不足，已剥离封面字段保存');
    } catch (e2) {
      console.error('[PlayStats] Failed to save:', e2);
    }
  }
};

const scheduleSave = () => {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    if (dirty && pendingStats !== null) {
      dirty = false;
      persistStats(pendingStats);
    }
  }, 2000);
};

const savePlayStats = (stats) => {
  pendingStats = stats;
  persistStats(stats); // 立即写（用于清理等一次性场景）
  dirty = false; // 已落盘，无需防抖定时器再写一次
};

/**
 * 获取当前月份的 key，格式 "YYYY-MM"
 */
const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * 记录一次播放
 */
export const recordPlay = (song) => {
  // 局域网(LunaBeat)歌曲按设置决定是否参与月度统计（默认参与）
  const isLunaSong = song && (song._lunaId || (typeof song.file_path === 'string' && song.file_path.startsWith('luna://')));
  if (isLunaSong && localStorage.getItem('kimo-luna-stats-enabled') === 'false') {
    return;
  }
  // 局域网歌曲封面统一存 luna://{id} 引用：blob URL 是会话级的，重启后失效，
  // 存引用才能让月度榜单从持久化封面缓存恢复显示
  const coverForStats = isLunaSong
    ? `luna://${song._lunaId || song.file_path.replace('luna://', '')}`
    : (song.cover_image || null);

  const stats = getPlayStats();
  const monthKey = getCurrentMonthKey();
  if (!stats[monthKey]) stats[monthKey] = {};

  const filePath = song.file_path;
  if (!stats[monthKey][filePath]) {
    stats[monthKey][filePath] = { count: 0, totalDuration: 0, title: song.title || '未知', artist: song.artist || '未知', cover_image: coverForStats, dailyPlays: {}, dailyDurations: {} };
  }

  const entry = stats[monthKey][filePath];
  entry.count += 1;
  entry.totalDuration += song.duration || 0;

  // 记录每天的播放数据
  const today = new Date().getDate();
  entry.dailyPlays[today] = (entry.dailyPlays[today] || 0) + 1;
  entry.dailyDurations[today] = (entry.dailyDurations[today] || 0) + (song.duration || 0);

  // 更新元数据（封面可能异步获取后才填入；局域网歌曲始终存 luna://{id} 引用）
  if (song.title) entry.title = song.title;
  if (song.artist) entry.artist = song.artist;
  if (coverForStats) entry.cover_image = coverForStats;

  // 合并写入（防抖 2 秒），连续切歌不会反复全量序列化
  pendingStats = stats;
  dirty = true;
  scheduleSave();
};

/**
 * 获取指定月份的排行榜（按播放次数降序）
 * @param {string} [monthKey] - 月份 key，默认当月
 * @returns {Array<{filePath, count, totalDuration, title, artist, cover_image}>}
 */
export const getMonthlyRanking = (monthKey) => {
  const stats = getPlayStats();
  const key = monthKey || getCurrentMonthKey();
  const monthData = stats[key] || {};

  return Object.entries(monthData)
    .map(([filePath, data]) => {
      const entry = { filePath, ...data };
      // 存量记录封面可能是会话级 blob URL（重启后失效），统一规范化为 luna://{id} 引用
      if (filePath.startsWith('luna://') && entry.cover_image && !String(entry.cover_image).startsWith('luna://')) {
        entry.cover_image = `luna://${filePath.replace('luna://', '')}`;
      }
      return entry;
    })
    .sort((a, b) => b.count - a.count);
};

/**
 * 获取指定月份的汇总统计
 */
export const getMonthlySummary = (monthKey) => {
  const ranking = getMonthlyRanking(monthKey);
  const totalPlays = ranking.reduce((sum, item) => sum + item.count, 0);
  const totalDuration = ranking.reduce((sum, item) => sum + item.totalDuration, 0);
  const uniqueSongs = ranking.length;
  return { totalPlays, totalDuration, uniqueSongs };
};

/**
 * 获取所有有数据的月份列表（降序）
 */
export const getAvailableMonths = () => {
  const stats = getPlayStats();
  return Object.keys(stats).sort().reverse();
};

/**
 * 获取指定月份每天的播放数据（用于日历热力图）
 * @param {string} monthKey - 月份 key "YYYY-MM"
 * @returns {{ daysInMonth: number, firstDayOfWeek: number, dailyData: { [day: number]: { count, duration } } }}
 */
export const getMonthlyCalendarData = (monthKey) => {
  const stats = getPlayStats();
  const monthData = stats[monthKey] || {};

  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=周日

  // 汇总每天的数据
  const dailyData = {};
  Object.values(monthData).forEach(songData => {
    // 从 play records 中统计每天的播放
    if (songData.dailyPlays) {
      Object.entries(songData.dailyPlays).forEach(([day, count]) => {
        const dayNum = Number(day);
        if (!dailyData[dayNum]) dailyData[dayNum] = { count: 0, duration: 0 };
        dailyData[dayNum].count += count;
      });
    }
    if (songData.dailyDurations) {
      Object.entries(songData.dailyDurations).forEach(([day, dur]) => {
        const dayNum = Number(day);
        if (!dailyData[dayNum]) dailyData[dayNum] = { count: 0, duration: 0 };
        dailyData[dayNum].duration += dur;
      });
    }
  });

  return { daysInMonth, firstDayOfWeek, dailyData };
};

/**
 * 清理超过 N 个月的旧数据
 */
export const cleanupOldStats = (keepMonths = 12) => {
  const stats = getPlayStats();
  const months = Object.keys(stats).sort().reverse();
  if (months.length <= keepMonths) return;

  const toDelete = months.slice(keepMonths);
  toDelete.forEach(m => delete stats[m]);
  savePlayStats(stats);
};
