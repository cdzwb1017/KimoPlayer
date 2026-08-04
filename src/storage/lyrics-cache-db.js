const DATABASE_NAME = 'KimoLyricsCacheDB';
const STORE_NAME = 'lyricsCache';
// 容量上限：超出时清理保存时间最旧的条目，防止无界增长
const MAX_CACHE_ENTRIES = 3000;

// 复用打开的数据库连接（避免每次 open）
let dbPromise = null;

function openLyricsDatabase() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }
  return dbPromise;
}

// 兼容旧格式：旧条目直接存 lines 数组；新条目存 { savedAt, lines }
const normalizeEntry = (value) =>
  Array.isArray(value) ? { savedAt: 0, lines: value } : value;

const wrapLines = (lines) => ({ savedAt: Date.now(), lines });

function runTransaction(database, mode, operations) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, mode);
    operations(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveLyricsToDB(filePath, lines) {
  try {
    const database = await openLyricsDatabase();
    // 等待事务真正提交，避免 put 后立即返回导致写入丢失
    await runTransaction(database, 'readwrite', (store) => {
      store.put(wrapLines(lines), filePath);
    });
    await trimCache(database);
  } catch (error) {
    console.error('[LyricsCacheDB] Failed to save to IndexedDB:', error);
  }
}

// 容量控制：遍历条目按 savedAt 排序，删除最旧的超出部分
async function trimCache(database) {
  try {
    const entries = await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).openCursor();
      const found = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          found.push({ key: cursor.key, savedAt: normalizeEntry(cursor.value).savedAt || 0 });
          cursor.continue();
        } else {
          resolve(found);
        }
      };
      request.onerror = () => reject(request.error);
    });

    if (entries.length <= MAX_CACHE_ENTRIES) return;
    entries.sort((a, b) => a.savedAt - b.savedAt);
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
    await runTransaction(database, 'readwrite', (store) => {
      toRemove.forEach(({ key }) => store.delete(key));
    });
    console.warn(`[LyricsCacheDB] 已清理 ${toRemove.length} 条最旧的歌词缓存`);
  } catch (e) {
    console.warn('[LyricsCacheDB] trim failed:', e);
  }
}

/**
 * 删除单首歌的歌词缓存（歌曲从歌库移除时调用）。
 */
export async function deleteLyricsFromDB(filePath) {
  try {
    const database = await openLyricsDatabase();
    await runTransaction(database, 'readwrite', (store) => {
      store.delete(filePath);
    });
  } catch (error) {
    console.error('[LyricsCacheDB] Failed to delete from IndexedDB:', error);
  }
}

/**
 * 清理失效缓存：只保留仍存在于歌库中的 file_path 对应的歌词。
 * @param {string[]} keepFilePaths 当前歌库中的所有文件路径
 */
export async function pruneLyricsCache(keepFilePaths) {
  try {
    const database = await openLyricsDatabase();
    const keep = new Set(keepFilePaths);
    const keys = await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stale = keys.filter((key) => !keep.has(key));
    if (stale.length === 0) return;
    await runTransaction(database, 'readwrite', (store) => {
      stale.forEach((key) => store.delete(key));
    });
    console.warn(`[LyricsCacheDB] 已清理 ${stale.length} 条失效歌词缓存`);
  } catch (error) {
    console.warn('[LyricsCacheDB] prune failed:', error);
  }
}

export async function loadAllLyricsFromDB() {
  try {
    const database = await openLyricsDatabase();
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).openCursor();
    const cache = new Map();

    return new Promise((resolve) => {
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cache.set(cursor.key, normalizeEntry(cursor.value).lines);
          cursor.continue();
        } else {
          resolve(cache);
        }
      };
      request.onerror = () => resolve(cache);
    });
  } catch (error) {
    console.error('[LyricsCacheDB] Failed to load from IndexedDB:', error);
    return new Map();
  }
}

export async function clearLyricsDB() {
  try {
    const database = await openLyricsDatabase();
    await runTransaction(database, 'readwrite', (store) => {
      store.clear();
    });
  } catch (error) {
    console.error('[LyricsCacheDB] Failed to clear IndexedDB:', error);
  }
}
