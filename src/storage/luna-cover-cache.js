/**
 * LunaBeat 局域网歌曲封面持久化缓存（IndexedDB）
 *
 * 背景：局域网歌曲的封面 Blob URL 是会话级的，重启后失效；
 * 月度听歌报告上榜的局域网歌曲需要离线也能显示封面。
 * 此处把下载成功的封面 Blob 按 lunaId 持久化，渲染时优先从内存缓存、
 * 其次从此缓存恢复 object URL。
 */

const DATABASE_NAME = 'KimoLunaCoverCache';
const STORE_NAME = 'covers';
// 容量上限：超出时清理保存时间最旧的条目
const MAX_CACHE_ENTRIES = 300;

let dbPromise = null;

function openDatabase() {
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
      // 打开失败时重置 promise，下次调用可重新尝试（避免本会话内持久化永久失效）
      request.onerror = (event) => {
        dbPromise = null;
        reject(event.target.error);
      };
      request.onblocked = () => {
        dbPromise = null;
        reject(new Error('indexedDB open blocked'));
      };
    });
  }
  return dbPromise;
}

function runTransaction(database, mode, operations) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, mode);
    operations(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * 保存封面 Blob（fire-and-forget 风格，内部消化全部异常）。
 * @param {string} lunaId
 * @param {Blob} blob
 */
export async function saveLunaCover(lunaId, blob) {
  if (!lunaId || !blob) return;
  // 单张封面超过 1MB 跳过：正常 480 缩略图远小于此，防止异常封面撑爆配额
  if (blob.size > 1024 * 1024) return;
  try {
    const database = await openDatabase();
    await runTransaction(database, 'readwrite', (store) => {
      store.put({ savedAt: Date.now(), blob }, String(lunaId));
    });
    await trimCache(database);
  } catch (error) {
    console.warn('[LunaCoverCache] Failed to save cover:', error);
  }
}

/**
 * 读取封面 Blob；无缓存返回 null（调用方自行兜底）。
 * @param {string} lunaId
 * @returns {Promise<Blob|null>}
 */
export async function getLunaCoverBlob(lunaId) {
  if (!lunaId) return null;
  try {
    const database = await openDatabase();
    const value = await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(String(lunaId));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    return value && value.blob ? value.blob : null;
  } catch (error) {
    console.warn('[LunaCoverCache] Failed to load cover:', error);
    return null;
  }
}

// 容量控制：按 savedAt 升序删除超出上限的最旧条目
async function trimCache(database) {
  try {
    const entries = await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).openCursor();
      const found = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const value = cursor.value || {};
          found.push({ key: cursor.key, savedAt: value.savedAt || 0 });
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
    console.warn(`[LunaCoverCache] 已清理 ${toRemove.length} 张最旧的封面缓存`);
  } catch (e) {
    console.warn('[LunaCoverCache] trim failed:', e);
  }
}
