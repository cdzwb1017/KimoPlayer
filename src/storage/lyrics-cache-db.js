const DATABASE_NAME = 'KimoLyricsCacheDB';
const STORE_NAME = 'lyricsCache';

function openLyricsDatabase() {
  return new Promise((resolve, reject) => {
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

export async function saveLyricsToDB(filePath, lines) {
  try {
    const database = await openLyricsDatabase();
    database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(lines, filePath);
  } catch (error) {
    console.error('[LyricsCacheDB] Failed to save to IndexedDB:', error);
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
          cache.set(cursor.key, cursor.value);
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
    database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
  } catch (error) {
    console.error('[LyricsCacheDB] Failed to clear IndexedDB:', error);
  }
}
