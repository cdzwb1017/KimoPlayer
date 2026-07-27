/**
 * 播放统计模块
 * 记录每首歌的播放次数和播放时长，按月归档
 * 数据结构: { "2026-07": { "file_path": { count, totalDuration } } }
 */
const PLAY_STATS_KEY = 'kimo-play-stats';

export const getPlayStats = () => {
  try {
    const cached = localStorage.getItem(PLAY_STATS_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

const savePlayStats = (stats) => {
  try {
    localStorage.setItem(PLAY_STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('[PlayStats] Failed to save:', e);
  }
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
  const stats = getPlayStats();
  const monthKey = getCurrentMonthKey();
  if (!stats[monthKey]) stats[monthKey] = {};

  const filePath = song.file_path;
  if (!stats[monthKey][filePath]) {
    stats[monthKey][filePath] = { count: 0, totalDuration: 0, title: song.title || '未知', artist: song.artist || '未知', cover_image: song.cover_image || null, dailyPlays: {}, dailyDurations: {} };
  }

  const entry = stats[monthKey][filePath];
  entry.count += 1;
  entry.totalDuration += song.duration || 0;

  // 记录每天的播放数据
  const today = new Date().getDate();
  entry.dailyPlays[today] = (entry.dailyPlays[today] || 0) + 1;
  entry.dailyDurations[today] = (entry.dailyDurations[today] || 0) + (song.duration || 0);

  // 更新元数据（封面可能异步获取后才填入）
  if (song.title) entry.title = song.title;
  if (song.artist) entry.artist = song.artist;
  if (song.cover_image) entry.cover_image = song.cover_image;

  savePlayStats(stats);
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
    .map(([filePath, data]) => ({ filePath, ...data }))
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
