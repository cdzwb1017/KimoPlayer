const defaults = {
  timeOffset: 0,
  liftAmplitude: 4,
  scrollAlign: 0.5,
  rowFollowEnabled: true,
  blurEnabled: true,
};

let cachedPreferences = null;

function readNumber(key, fallback) {
  const value = Number.parseFloat(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function loadPreferences() {
  return {
    timeOffset: readNumber('kimo-lyrics-time-offset', defaults.timeOffset),
    liftAmplitude: Math.max(0, Math.min(5, readNumber('kimo-lyrics-lift-amplitude', defaults.liftAmplitude))),
    scrollAlign: readNumber('kimo-lyrics-scroll-align', defaults.scrollAlign),
    rowFollowEnabled: localStorage.getItem('kimo-lyrics-row-follow-enabled') !== 'false',
    blurEnabled: localStorage.getItem('kimo-lyrics-blur-enabled') !== 'false',
  };
}

export function getLyricsPreferences() {
  if (!cachedPreferences) cachedPreferences = loadPreferences();
  return cachedPreferences;
}

export function updateLyricsPreference(name, value) {
  const preferences = getLyricsPreferences();
  preferences[name] = value;

  const storageKeys = {
    timeOffset: 'kimo-lyrics-time-offset',
    liftAmplitude: 'kimo-lyrics-lift-amplitude',
    scrollAlign: 'kimo-lyrics-scroll-align',
    rowFollowEnabled: 'kimo-lyrics-row-follow-enabled',
    blurEnabled: 'kimo-lyrics-blur-enabled',
  };
  const storageKey = storageKeys[name];
  if (storageKey) localStorage.setItem(storageKey, String(value));
}

export function refreshLyricsPreferences() {
  cachedPreferences = loadPreferences();
  return cachedPreferences;
}
