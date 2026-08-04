import { createLyricPlayer } from "/lyric-player.js?v=20260730-5";
import { createFlowLight, extractColors } from "/flow-light.js?v=20260730-5";
import { createSideRays } from "/side-rays.js?v=20260730-5";
const LOG_TAG = "[LunaBeat Web]",
  logLines = [],
  LOSSLESS_LOGO_PATH =
    "M8.184,0.35C9.944,0.35 10.703,3.296 11.338,5.238C11.673,3.842 11.497,3.542 11.857,3.542C11.99,3.542 12.126,3.633 12.126,3.798C12.126,3.809 12.123,3.839 12.117,3.883L12.091,4.058C12.02,4.522 11.845,5.494 11.654,6.144C13.198,10.191 14.345,4.861 14.474,3.772C14.493,3.615 14.612,3.542 14.731,3.542C14.891,3.542 15.022,3.662 14.997,3.843C14.72,5.605 14.295,8.35 12.547,8.35C11.582,8.35 11.04,7.595 10.611,6.73C9.54,4.626 9.047,1.093 7.997,1.093C7.66,1.093 7.411,1.444 7.394,1.444C7.362,1.444 7.337,1.301 7.023,0.909C7.322,0.567 7.734,0.35 8.184,0.35ZM2.458,0.354C5.211,0.354 5.456,7.618 7.014,7.618C7.197,7.618 7.394,7.507 7.61,7.256C7.729,7.458 7.851,7.638 7.978,7.796C7.667,8.151 7.28,8.35 6.795,8.35C5.054,8.349 4.306,5.434 3.663,3.466C3.511,4.097 3.432,4.669 3.402,4.925C3.382,5.088 3.263,5.163 3.143,5.163C3.009,5.163 2.874,5.071 2.874,4.908L2.874,4.908L2.877,4.87C2.966,4.223 3.146,3.243 3.347,2.56C3.079,1.858 2.745,1.091 2.252,1.091C1.257,1.091 0.687,3.591 0.527,4.925C0.508,5.088 0.388,5.163 0.268,5.163C0.135,5.163 0,5.071 0,4.908C0,4.896 0.001,4.883 0.002,4.87C0.283,2.836 0.808,0.354 2.458,0.354ZM5.315,0.35C5.809,0.35 6.339,0.608 6.797,1.211C6.822,1.241 7.078,1.639 7.159,1.777C8.277,3.802 8.818,7.627 9.881,7.627C10.065,7.627 10.264,7.513 10.484,7.256C10.604,7.458 10.726,7.638 10.852,7.796C10.542,8.15 10.155,8.35 9.67,8.35C6.933,8.349 6.636,1.09 5.128,1.09C4.788,1.09 4.536,1.444 4.519,1.444C4.487,1.444 4.462,1.301 4.148,0.909C4.455,0.558 4.87,0.35 5.315,0.35Z";
function log(e, ...t) {
  const n = t
      .map((e) => {
        if (e instanceof Error)
          return `${e.name}: ${e.message}\n${e.stack || ""}`;
        if ("object" == typeof e)
          try {
            return JSON.stringify(e);
          } catch {
            return String(e);
          }
        return String(e);
      })
      .join(" "),
    a = `${new Date().toISOString().slice(11, 23)} ${e} ${n}`;
  (logLines.push(a), logLines.length > 80 && logLines.shift());
  (console[e] || console.log)(LOG_TAG, ...t);
  const i = document.getElementById("debugLog");
  i && ((i.textContent = logLines.join("\n")), (i.scrollTop = i.scrollHeight));
}
window.appLog = function (e, ...t) {
  log(e, ...t);
};
const $ = (e) => document.querySelector(e),
  content = $("#content"),
  pageTitle = $("#pageTitle"),
  audio = $("#audio"),
  seek = $("#seek"),
  volume = $("#volume"),
  npVolume = $("#npVolume"),
  btnPlay = $("#btnPlay"),
  npPlay = $("#npPlay"),
  nowTitle = $("#nowTitle"),
  nowArtist = $("#nowArtist"),
  nowCover = $("#nowCover"),
  npCover = $("#npCover"),
  npTitle = $("#npTitle"),
  npSubtitle = $("#npSubtitle"),
  npBg = $("#npBg"),
  npVideoBg = $("#npVideoBg"),
  npVideoCover = $("#npVideoCover"),
  npVeil = $(".np-veil"),
  btnRepeat = $("#btnRepeat"),
  npRepeat = $("#npRepeat"),
  npFlowCanvas = $("#npFlowLight"),
  nowPlaying = $("#nowPlaying"),
  miniPlayer = $("#miniPlayer"),
  curTime = $("#curTime"),
  remainTime = $("#remainTime"),
  lyricMount = $("#lyricMount"),
  npLyric = $("#npLyric"),
  queueSidebar = $("#queueSidebar"),
  queueList = $("#queueList"),
  settingsSidebar = $("#settingsSidebar"),
  lyricSizeSlider = $("#lyricSizeSlider"),
  lyricSizeDisplay = $("#lyricSizeDisplay"),
  lyricPosSlider = $("#lyricPosSlider"),
  lyricPosDisplay = $("#lyricPosDisplay"),
  lyricBlurToggle = $("#lyricBlurToggle"),
  lyricElasticToggle = $("#lyricElasticToggle"),
  lyricHideExtraToggle = $("#lyricHideExtraToggle"),
  npPadXSlider = $("#npPadXSlider"),
  npPadXDisplay = $("#npPadXDisplay"),
  debugLogToggle = $("#debugLogToggle"),
  songSearchInput = $("#songSearchInput"),
  NP_PAD_X_KEY = "lunabeat_np_pad_x",
  NP_PAD_X_MIN = 100,
  NP_PAD_X_DEFAULT = "100",
  HIDE_LYRIC_EXTRA_KEY = "lunabeat_hide_lyric_extra",
  SHOW_DEBUG_LOG_KEY = "lunabeat_show_debug_log",
  savedLyricSize = localStorage.getItem("lyricFontSize");
function applyLyricFontSize(e) {
  const t = Math.max(20, Math.min(60, parseInt(e, 10) || 32)) + "px";
  document.documentElement.style.setProperty("--lyric-base-size", t);
  document.documentElement.style.setProperty("--amll-lp-font-size", t);
}
applyLyricFontSize(savedLyricSize || "32");
const savedLyricPos = localStorage.getItem("lyricPos") || "32";
function applyNpPadX(e) {
  const t = Math.max(100, Math.min(200, parseInt(e, 10) || 100));
  document.documentElement.style.setProperty("--np-pad-x", t + "px");
  const n = Math.min(1, Math.max(0, (t - 100) / 100));
  return (
    document.documentElement.style.setProperty(
      "--np-player-w",
      `min(calc((${1 - n}) * (100vw - ${2 * t}px - 40px) / 2 + ${420 * n}px), calc(100dvh - var(--np-chrome-v, 400px)))`,
    ),
    t
  );
}
(document.documentElement.style.setProperty(
  "--lyric-align-offset",
  savedLyricPos + "vh",
),
  (window.lyricAlignOffsetVH = parseInt(savedLyricPos, 10)),
  (window.lyricBlurEnabled = "false" !== localStorage.getItem("lyricBlur")),
  (window.lyricElasticEnabled =
    "false" !== localStorage.getItem("lyricElastic")));
const savedNpPadX = localStorage.getItem(NP_PAD_X_KEY) || "100";
function applyShowDebugLog(e) {
  const t = !!e;
  if (
    (debugLogToggle &&
      ((debugLogToggle.hidden = !t),
      debugLogToggle.classList.toggle("hidden", !t)),
    !t)
  ) {
    const e = $("#debugLog");
    e && e.classList.add("hidden");
  }
  return t;
}
(applyNpPadX(savedNpPadX),
  applyShowDebugLog("true" === localStorage.getItem(SHOW_DEBUG_LOG_KEY)));
const sideRaysBg = document.getElementById("sideRaysBg"),
  sideRays = createSideRays(sideRaysBg, {
    speed: 2.5,
    rayColor1: "#EAB308",
    rayColor2: "#96c8ff",
    intensity: 2,
    spread: 2,
    origin: "top-right",
    tilt: 0,
    saturation: 1.5,
    blend: 0.75,
    falloff: 1.6,
    opacity: 0.9,
  });
document.addEventListener("visibilitychange", () => {
  document.hidden ? sideRays.stop() : sideRays.start();
});
const flowLight = createFlowLight(npFlowCanvas),
  savedShuffle = localStorage.getItem("lunabeat_shuffle"),
  savedRepeatMode = localStorage.getItem("lunabeat_repeatMode"),
  state = {
    view: "home",
    queue: [],
    index: -1,
    seeking: !1,
    current: null,
    shuffle: "true" === savedShuffle,
    repeatMode: savedRepeatMode ? parseInt(savedRepeatMode, 10) : 0,
    playbackSession:
      "web_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).substr(2, 5),
    lyricPlayer: null,
    lyricRaf: 0,
    showLyrics: !0,
  },
  titles = {
    home: "主页",
    songs: "歌曲",
    artists: "艺人",
    albums: "专辑",
    playlists: "歌单",
    folders: "文件夹",
    genres: "流派",
    settings: "设置",
  };
function fmt(e, t = !1) {
  const n = Math.max(0, Math.floor(t ? e / 1e3 : e));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
async function api(e) {
  const t = performance.now();
  log("info", "api fetch →", e);
  try {
    const n = { credentials: "include" };
    const i = await fetch(e, n),
      s = Math.round(performance.now() - t);
    if ((log("info", "api ←", e, i.status, `${s}ms`), !i.ok)) {
      const t = await i.text().catch(() => "");
      if (401 === i.status) {
        let e = !1;
        try {
          "pairing_required" === JSON.parse(t).error && (e = !0);
        } catch (e) {}
        if (e) {
          if (window.isPromptingPin) return new Promise(() => {});
          {
            window.isPromptingPin = !0;
            const e = prompt(
              getString("pin") || "请输入 PIN 码 / PIN required",
            );
            if (null !== e) {
              const authResponse = await fetch("/api/auth", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: e.trim() }),
              });
              window.isPromptingPin = !1;
              if (authResponse.ok) return api(arguments[0]);
              alert(getString("pairing_failed"));
              throw new Error("pairing_failed");
            }
            window.isPromptingPin = !1;
          }
        }
      }
      throw new Error(`${e} ${i.status} ${t.slice(0, 200)}`);
    }
    return i.json();
  } catch (t) {
    throw (log("error", "api fail", e, t), t);
  }
}
log("info", "app.js boot", {
  href: location.href,
  ua: navigator.userAgent.slice(0, 80),
});
const UPLOAD_AUDIO_EXTENSIONS = new Set([
  "mp3",
  "aac",
  "wav",
  "flac",
  "m4a",
  "ogg",
  "opus",
  "amr",
]);
function isUploadableAudioFile(e) {
  const t = String(e?.name || ""),
    n = t.includes(".") ? t.split(".").pop().toLowerCase() : "";
  return UPLOAD_AUDIO_EXTENSIONS.has(n);
}
function formatFileSize(e) {
  const t = Number(e) || 0;
  return t < 1024
    ? `${t} B`
    : t < 1048576
      ? `${(t / 1024).toFixed(1)} KB`
      : `${(t / 1048576).toFixed(1)} MB`;
}
function apiUploadForm(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/upload");
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };
    request.onload = () => {
      const responseText = request.responseText || "";
      if (request.status === 401) {
        let pairingRequired = false;
        try {
          pairingRequired = JSON.parse(responseText).error === "pairing_required";
        } catch {}
        if (pairingRequired) {
          if (!window.isPromptingPin) {
            window.isPromptingPin = true;
            const pairingCode = prompt(
              getString("pin") || "请输入 PIN 码 / PIN required",
            );
            if (pairingCode !== null) {
              fetch("/api/auth", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: pairingCode.trim() }),
              }).then((response) => {
                window.isPromptingPin = false;
                if (response.ok) {
                  apiUploadForm(formData, onProgress).then(resolve, reject);
                } else {
                  reject(new Error("pairing_failed"));
                }
              }, reject);
              return;
            }
            window.isPromptingPin = false;
          }
          reject(new Error("pairing_required"));
          return;
        }
      }
      if (request.status < 200 || request.status >= 300) {
        let message = responseText.slice(0, 200);
        try {
          const body = JSON.parse(responseText);
          if (body.error) message = body.error;
        } catch {}
        reject(new Error(message || `upload ${request.status}`));
        return;
      }
      try {
        resolve(JSON.parse(responseText));
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(new Error("network_error"));
    request.send(formData);
  });
}
function coverUrl(e, t = 0) {
  if (!e) return "";
  const n = (e) =>
    t > 0 ? e + (e.includes("?") ? "&" : "?") + "size=" + Math.round(t) : e;
  return e.coverUrl
    ? n(e.coverUrl)
    : e.coverPath && String(e.coverPath).startsWith("/")
      ? n(e.coverPath)
      : null != e.id
        ? `/api/cover?id=${e.id}${t > 0 ? "&size=" + Math.round(t) : ""}`
        : null != e.audioId
          ? `/api/cover?id=${e.audioId}${t > 0 ? "&size=" + Math.round(t) : ""}`
          : "";
}
function playSong(e, t = null) {
  if (!e) return;
  t &&
    ((state.queue = t),
    (state.index = t.findIndex(
      (t) => (t.id ?? t.audioId) === (e.id ?? e.audioId),
    )),
    state.index < 0 && (state.index = 0));
  const n = e.id ?? e.audioId;
  if (null == n) return void log("warn", "playSong missing id", e);
  const i = e.streamUrl || `/api/stream?id=${n}`;
  (hideStatusToast(),
    log("info", "play", n, e.title, i),
    (state.current = e),
    (state.playbackSession =
      "web_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).substr(2, 5)),
    setSeekLoading(!0),
    (audio.src = i),
    audio.play().catch((t) => {
      (log("warn", "audio.play rejected", t),
        "NotSupportedError" === t.name
          ? handleUnsupportedPlayback()
          : setPlayingUi(!1));
    }),
    applyNowPlaying(e),
    queueSidebar.classList.contains("hidden") || renderQueue(),
    setPlayingUi(!0),
    loadLyric(n));
}
function applyNowPlaying(e) {
  document.startViewTransition
    ? document.startViewTransition(() => _applyNowPlayingDOM(e))
    : _applyNowPlayingDOM(e);
}
function _applyNowPlayingDOM(e) {
  const t = e.title || getString("unknown_song"),
    n = e.artist || getString("unknown_artist"),
    a = e.album || "",
    i = coverUrl(e, 480);
  ((nowTitle.textContent = t),
    (nowArtist.textContent = n),
    (nowCover.src = i),
    (npTitle.textContent = t),
    (npSubtitle.textContent = a ? `${n} — ${a}` : n),
    (npCover.src = coverUrl(e, 1440)));
  const s = $(".np-quality");
  if (s) {
    let t = "";
    ("SQ" === e.audioQuality
      ? (t = getString("quality_sq"))
      : "HR" === e.audioQuality
        ? (t = getString("quality_hr"))
        : "MASTER" === e.audioQuality && (t = getString("quality_master")),
      t
        ? ((s.innerHTML = `<svg viewBox="0 0 15 9" width="20" height="12" fill="currentColor"><path d="${LOSSLESS_LOGO_PATH}"/></svg><span style="margin-left:5px; font-weight:600;">${t}</span>`),
          (s.hidden = !1),
          (s.style.display = "inline-flex"))
        : ((s.hidden = !0), (s.style.display = "none")));
  }
  npBg.style.backgroundImage = i ? `url("${i}")` : "";
  const o = e.videoCoverUrl;
  (o
    ? (npVideoBg.classList.add("hidden"),
      npVideoBg.removeAttribute("src"),
      npVideoBg.load?.(),
      (npVideoCover.src = o),
      (npVideoCover.onerror = () => {
        npVideoCover.classList.add("hidden");
      }),
      (npVideoCover.oncanplay = () => {
        (npVideoCover.classList.remove("hidden"),
          audio.paused || npVideoCover.play().catch(() => {}));
      }))
    : (npVideoBg.classList.add("hidden"),
      npVideoCover.classList.add("hidden"),
      (npVideoBg.src = ""),
      (npVideoCover.src = "")),
    applyFlowLightFromCover(i));
}
function applyFlowLightFromCover(e) {
  if (!e)
    return (
      npFlowCanvas.classList.remove("active"),
      npBg.classList.remove("hidden-bg"),
      npVeil.classList.remove("flow-active"),
      void flowLight.stop()
    );
  const t = new Image();
  ((t.crossOrigin = "anonymous"),
    (t.onload = () => {
      try {
        const { bgColor: e, colors: n } = extractColors(t, 4);
        if ((log("info", "flowLight colors", e, n.length), 0 === n.length))
          return (
            npFlowCanvas.classList.remove("active"),
            npBg.classList.remove("hidden-bg"),
            npVeil.classList.remove("flow-active"),
            void flowLight.stop()
          );
        (flowLight.setColors(e, n),
          npFlowCanvas.classList.add("active"),
          npBg.classList.add("hidden-bg"),
          npVeil.classList.add("flow-active"));
      } catch (e) {
        log("error", "extractColors fail", e);
      }
    }),
    (t.onerror = () => {
      log("warn", "flowLight cover load fail", e);
    }),
    (t.src = e));
}
function setPlayingUi(e) {
  (btnPlay.classList.toggle("is-playing", e),
    npPlay.classList.toggle("is-playing", e));
  const t = document.querySelector(".np-cover-wrap");
  t && t.classList.toggle("is-paused", !e);
}
function openNowPlaying() {
  document.startViewTransition
    ? document.startViewTransition(() => _openNowPlayingDOM())
    : _openNowPlayingDOM();
}
function _openNowPlayingDOM() {
  (localStorage.setItem("nowPlayingOpen", "true"),
    ensureLyricRenderer(),
    nowPlaying.classList.remove("hidden"),
    nowPlaying.setAttribute("aria-hidden", "false"),
    (miniPlayer.style.visibility = "hidden"),
    syncLyricToAudio(!0),
    flowLight.checkPending && flowLight.checkPending(),
    flowLight.isActive() && flowLight.start());
}
function closeNowPlaying() {
  document.startViewTransition
    ? document.startViewTransition(() => _closeNowPlayingDOM())
    : _closeNowPlayingDOM();
}
function _closeNowPlayingDOM() {
  (localStorage.setItem("nowPlayingOpen", "false"),
    nowPlaying.classList.add("hidden"),
    nowPlaying.setAttribute("aria-hidden", "true"),
    (miniPlayer.style.visibility = ""),
    flowLight.stop());
}
function togglePlay() {
  audio.paused
    ? audio.play().catch((e) => log("warn", "play", e))
    : audio.pause();
}
function updateRepeatUi() {
  const e = [
    { name: getString("repeat_all"), cls: ".icon-rep-all" },
    { name: getString("repeat_one"), cls: ".icon-rep-one" },
    { name: getString("repeat_off"), cls: ".icon-rep-all" },
  ][state.repeatMode];
  [btnRepeat, npRepeat].forEach((t) => {
    if (!t) return;
    ((t.title = e.name),
      t.querySelectorAll("svg").forEach((e) => (e.style.display = "none")));
    const n = t.querySelector(e.cls);
    (n && (n.style.display = ""),
      2 === state.repeatMode
        ? t.classList.remove("active")
        : t.classList.add("active"));
  });
  [$("#btnShuffle"), $("#npShuffleBtn")].forEach((e) => {
    e &&
      (state.shuffle
        ? e.classList.add("active")
        : e.classList.remove("active"));
  });
}
function toggleRepeat() {
  ((state.repeatMode = (state.repeatMode + 1) % 3),
    localStorage.setItem("lunabeat_repeatMode", state.repeatMode.toString()),
    updateRepeatUi());
}
function toggleShuffle() {
  ((state.shuffle = !state.shuffle),
    localStorage.setItem("lunabeat_shuffle", state.shuffle.toString()),
    updateRepeatUi());
}
function playAt(e, t = !1) {
  if (state.queue.length) {
    if (t && 1 === state.repeatMode)
      return (
        (audio.currentTime = 0),
        (state.playbackSession =
          "web_" +
          Date.now().toString(36) +
          "_" +
          Math.random().toString(36).substr(2, 5)),
        void audio.play().catch((e) => log("warn", "playAt repeat-one", e))
      );
    if (state.shuffle)
      state.index = Math.floor(Math.random() * state.queue.length);
    else {
      const n = state.index + e;
      if (t && 2 === state.repeatMode && n >= state.queue.length)
        return void audio.pause();
      state.index = (n + state.queue.length) % state.queue.length;
    }
    playSong(state.queue[state.index]);
  }
}
let queueDragSource = null;
function renderQueue() {
  ((queueList.innerHTML = ""),
    state.queue && 0 !== state.queue.length
      ? ((lastSaveTime = 0),
        "function" == typeof savePlaybackState && savePlaybackState(),
        state.queue.forEach((e, t) => {
          const n = document.createElement("div");
          ((n.className = "queue-item" + (t === state.index ? " active" : "")),
            (n.draggable = !0),
            (n.ondragstart = (e) => {
              ((queueDragSource = t),
                (e.dataTransfer.effectAllowed = "move"),
                n.classList.add("dragging"));
            }),
            (n.ondragend = () => {
              (n.classList.remove("dragging"),
                queueList
                  .querySelectorAll(".drag-over")
                  .forEach((e) => e.classList.remove("drag-over")));
            }),
            (n.ondragover = (e) => (
              e.preventDefault(),
              (e.dataTransfer.dropEffect = "move"),
              !1
            )),
            (n.ondragenter = () => {
              t !== queueDragSource && n.classList.add("drag-over");
            }),
            (n.ondragleave = () => {
              n.classList.remove("drag-over");
            }),
            (n.ondrop = (e) => {
              if (
                (e.stopPropagation(),
                n.classList.remove("drag-over"),
                null !== queueDragSource && queueDragSource !== t)
              ) {
                const e = state.queue.splice(queueDragSource, 1)[0];
                (state.index === queueDragSource
                  ? (state.index = t)
                  : state.index > queueDragSource && state.index <= t
                    ? state.index--
                    : state.index < queueDragSource &&
                      state.index >= t &&
                      state.index++,
                  state.queue.splice(t, 0, e),
                  renderQueue());
              }
              return !1;
            }),
            (n.onclick = (n) => {
              n.target.closest(".queue-item-del") ||
                n.target.closest(".queue-item-drag") ||
                (t !== state.index && ((state.index = t), playSong(e)));
            }));
          const a = document.createElement("div");
          ((a.className = "queue-item-drag"),
            (a.innerHTML =
              '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>'));
          const i = document.createElement("div");
          ((i.className = "queue-item-meta"),
            (i.innerHTML = `<div class="queue-item-title">${escapeHtml(e.title || getString("unknown"))}</div>\n                      <div class="queue-item-artist">${escapeHtml(e.artist || getString("unknown"))}</div>`));
          const s = document.createElement("button");
          ((s.className = "queue-item-del"),
            (s.title = getString("queue_remove")),
            (s.innerHTML =
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'),
            (s.onclick = (e) => {
              (e.stopPropagation(),
                state.queue.splice(t, 1),
                state.index === t
                  ? 0 === state.queue.length
                    ? (audio.pause(), applyNowPlaying({}), (state.index = -1))
                    : (state.index >= state.queue.length && (state.index = 0),
                      playSong(state.queue[state.index]))
                  : state.index > t && state.index--,
                renderQueue());
            }),
            n.appendChild(a),
            n.appendChild(i),
            n.appendChild(s),
            queueList.appendChild(n));
        }))
      : (queueList.innerHTML = `<div class="empty" style="text-align: center; margin-top: 40px;">${getString("queue_empty")}</div>`));
}
async function loadLyric(e) {
  try {
    ensureLyricRenderer();
    const t = await api(`/api/lyric?id=${e}`),
      n = Array.isArray(t.lines) ? t.lines : [],
      i = "true" === localStorage.getItem(HIDE_LYRIC_EXTRA_KEY),
      s = i
        ? n.map((e) => ({
            ...e,
            translatedLyric: "",
            translation: "",
            romanLyric: "",
            words: Array.isArray(e.words)
              ? e.words.map(({ romanWord, transliteration, ...e }) => e)
              : e.words,
          }))
        : n;
    state.lyricPlayer?.setLines(s);
    state.lyricPlayer?.setSongwriters(
      i ? [] : t.songwriters,
      getString("creator_label"),
    );
  } catch (e) {
    (log("error", "loadLyric", e),
      state.lyricPlayer?.setLines([]),
      state.lyricPlayer?.setSongwriters([]));
  }
}
function ensureLyricRenderer() {
  if (
    (state.lyricPlayer ||
      ((state.lyricPlayer = createLyricPlayer(lyricMount, {
        karaokeRise: !0,
        karaokeGradient: !0,
        onSeek: (e) => {
          const t = Math.max(0, e / 1e3);
          audio.currentTime = t;
        },
      })),
      log("info", "lyric player ready")),
    state.lyricRaf)
  )
    return;
  const e = () => {
    const t = Math.floor(1e3 * (audio.currentTime || 0));
    (state.lyricPlayer?.setTime(t, !1),
      (state.lyricRaf = requestAnimationFrame(e)));
  };
  state.lyricRaf = requestAnimationFrame(e);
}
function syncLyricToAudio(e = !1) {
  if (!state.lyricPlayer) return;
  const t = Math.floor(1e3 * (audio.currentTime || 0));
  state.lyricPlayer.setTime(t, e);
}
function renderHome(e) {
  if (
    ((content.innerHTML = ""),
    log("info", "renderHome sections", e.sections?.length || 0),
    !e.sections?.length)
  )
    return void (content.innerHTML = `<div class="empty">${getString("home_empty")}</div>`);
  const t = document.createElement("div");
  ((t.className = "home-waterfall"),
    (e.sections || []).forEach((e) => {
      if (e.title) {
        const n = document.createElement("h2");
        ((n.className = "waterfall-title"),
          (n.textContent = e.title),
          t.appendChild(n));
      }
      if ("library_entrance" === e.id) {
        const n = {
            0: '<svg viewBox="0 0 960 960" width="28" height="28" fill="currentColor"><path d="M240,792.31Q190.5,792.31 155.25,757.06Q120,721.81 120,672.31Q120,622.81 155.25,587.56Q190.5,552.31 240,552.31Q263,552.31 283.65,560.5Q304.31,568.69 320,585.08L320,274.77Q320,262.81 327.58,253.63Q335.15,244.46 346.85,242.46L724.54,174.92Q739.46,172.69 750.88,181.88Q762.31,191.06 762.31,206.23L762.31,592.31Q762.31,641.81 727.06,677.06Q691.81,712.31 642.31,712.31Q592.81,712.31 557.56,677.06Q522.31,641.81 522.31,592.31Q522.31,542.81 557.56,507.56Q592.81,472.31 642.31,472.31Q665.31,472.31 685.96,480.5Q706.62,488.69 722.31,505.08L722.31,323.92L360,392.31L360,672.31Q360,721.81 324.75,757.06Q289.5,792.31 240,792.31Z"/></svg>',
            1: '<svg viewBox="0 0 960 960" width="28" height="28" fill="currentColor"><path d="M700.02,772.31Q662.23,772.31 636.12,746.21Q610,720.12 610,682.33Q610,644.54 636.1,618.42Q662.2,592.31 700,592.31Q710.31,592.31 720.88,594.96Q731.46,597.61 742.31,604.15L742.31,433.08Q742.31,417.71 752.7,407.32Q763.1,396.92 778.46,396.92L834.61,396.92Q849.31,396.92 859.65,407.1Q870,417.27 870,432.31Q870,447 859.65,457.35Q849.31,467.69 834.61,467.69L790,467.69L790,682.31Q790,720.11 763.91,746.21Q737.81,772.31 700.02,772.31ZM166.15,772.31Q150.79,772.31 140.39,761.91Q130,751.52 130,736.15L130,683.38Q130,653.38 145.96,628.65Q161.92,603.92 188.62,590.46Q248.69,561 308.65,546.65Q368.61,532.31 430,532.31Q454.54,532.31 478.35,534.39Q502.15,536.46 525.15,541.46Q540.77,544.69 546.46,554.85Q552.15,565 550.54,576.15Q548.92,587.31 540.19,595.23Q531.46,603.15 517.85,600.31Q496.85,596.31 474.81,594.31Q452.77,592.31 430,592.31Q374.92,592.31 321.46,605.54Q268,618.77 216.15,644Q204.08,650.15 197.04,660.69Q190,671.23 190,683.38L190,712.31L496.46,712.31Q511.46,712.31 518.96,721.66Q526.46,731.01 526.46,742.24Q526.46,753.46 518.96,762.88Q511.46,772.31 496.46,772.31L166.15,772.31ZM430,467.69Q372.25,467.69 331.13,426.57Q290,385.44 290,327.69Q290,269.94 331.13,228.82Q372.25,187.69 430,187.69Q487.75,187.69 528.87,228.82Q570,269.94 570,327.69Q570,385.44 528.87,426.57Q487.75,467.69 430,467.69ZM430,407.69Q463,407.69 486.5,384.19Q510,360.69 510,327.69Q510,294.69 486.5,271.19Q463,247.69 430,247.69Q397,247.69 373.5,271.19Q350,294.69 350,327.69Q350,360.69 373.5,384.19Q397,407.69 430,407.69ZM430,327.69Q430,327.69 430,327.69Q430,327.69 430,327.69Q430,327.69 430,327.69Q430,327.69 430,327.69Q430,327.69 430,327.69Q430,327.69 430,327.69Q430,327.69 430,327.69Q430,327.69 430,327.69ZM430,712.31L430,712.31L430,712.31Q430,712.31 430,712.31Q430,712.31 430,712.31Q430,712.31 430,712.31Q430,712.31 430,712.31Q430,712.31 430,712.31Q430,712.31 430,712.31Q430,712.31 430,712.31Q430,712.31 430,712.31Z"/></svg>',
            2: '<svg viewBox="0 0 960 960" width="28" height="28" fill="currentColor"><path d="M480,640Q546.92,640 593.46,593.46Q640,546.92 640,480Q640,413.08 593.46,366.54Q546.92,320 480,320Q413.08,320 366.54,366.54Q320,413.08 320,480Q320,546.92 366.54,593.46Q413.08,640 480,640ZM480,520Q463,520 451.5,508.5Q440,497 440,480Q440,463 451.5,451.5Q463,440 480,440Q497,440 508.5,451.5Q520,463 520,480Q520,497 508.5,508.5Q497,520 480,520ZM480.07,860Q401.23,860 331.86,830.08Q262.49,800.16 211.18,748.87Q159.87,697.58 129.93,628.24Q100,558.9 100,480.07Q100,401.23 129.92,331.86Q159.84,262.49 211.13,211.18Q262.42,159.87 331.76,129.93Q401.1,100 479.93,100Q558.77,100 628.14,129.92Q697.51,159.84 748.82,211.13Q800.13,262.42 830.07,331.76Q860,401.1 860,479.93Q860,558.77 830.08,628.14Q800.16,697.51 748.87,748.82Q697.58,800.13 628.24,830.07Q558.9,860 480.07,860ZM480,800Q614,800 707,707Q800,614 800,480Q800,346 707,253Q614,160 480,160Q346,160 253,253Q160,346 160,480Q160,614 253,707Q346,800 480,800ZM480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Z"/></svg>',
            3: '<svg viewBox="0 0 960 960" width="28" height="28" fill="currentColor"><path d="M460,594.61Q520.15,594.61 566.96,558.58Q613.77,522.54 629.31,466.15Q631.31,460.54 626.88,456.42Q622.46,452.31 616.85,454.31L349.08,529.46Q342.23,531.46 340.73,538Q339.23,544.54 344.23,549.15Q367.69,570.46 397.39,582.54Q427.08,594.61 460,594.61ZM295.54,445.38L396.15,416.92Q399.38,391.62 382.54,372.73Q365.69,353.85 340,353.85Q316.54,353.85 300.19,370.19Q283.85,386.54 283.85,410Q283.85,419.85 287.27,428.5Q290.69,437.15 295.54,445.38ZM535.54,375.38L636.15,346.92Q640,321.62 622.85,302.73Q605.69,283.85 580,283.85Q556.54,283.85 540.19,300.19Q523.85,316.54 523.85,340Q523.85,349.85 527.27,358.5Q530.69,367.15 535.54,375.38ZM212.31,820Q182,820 161,799Q140,778 140,747.69L140,212.31Q140,182 161,161Q182,140 212.31,140L747.69,140Q778,140 799,161Q820,182 820,212.31L820,601.61Q820,616.08 814.38,629.42Q808.77,642.77 798.92,652.61L652.61,798.92Q642.77,808.77 629.42,814.38Q616.08,820 601.61,820L212.31,820ZM600,760L600,680Q600,647 623.5,623.5Q647,600 680,600L760,600L760,212.31Q760,207.69 756.15,203.85Q752.31,200 747.69,200L212.31,200Q207.69,200 203.85,203.85Q200,207.69 200,212.31L200,747.69Q200,752.31 203.85,756.15Q207.69,760 212.31,760L600,760ZM600,760L600,760L600,760Q600,760 600,760Q600,760 600,760ZM200,760L200,760Q200,760 200,756.15Q200,752.31 200,747.69L200,212.31Q200,207.69 200,203.85Q200,200 200,200L200,200Q200,200 200,203.85Q200,207.69 200,212.31L200,600L200,600Q200,600 200,623.5Q200,647 200,680L200,760Z"/></svg>',
            4: '<svg viewBox="0 0 960 960" width="28" height="28" fill="currentColor"><path d="M172.31,780Q142,780 121,759Q100,738 100,707.69L100,252.31Q100,222 121,201Q142,180 172.31,180L362,180Q376.46,180 389.81,185.62Q403.15,191.23 413,201.08L471.92,260L787.69,260Q818,260 839,281Q860,302 860,332.31L860,707.69Q860,738 839,759Q818,780 787.69,780L172.31,780ZM172.31,720L787.69,720Q793.08,720 796.54,716.54Q800,713.08 800,707.69L800,332.31Q800,326.92 796.54,323.46Q793.08,320 787.69,320L447.38,320L370.85,243.46Q368.92,241.54 366.81,240.77Q364.69,240 362.38,240L172.31,240Q166.92,240 163.46,243.46Q160,246.92 160,252.31L160,707.69Q160,713.08 163.46,716.54Q166.92,720 172.31,720ZM160,720Q160,720 160,716.54Q160,713.08 160,707.69L160,252.31Q160,246.92 160,243.46Q160,240 160,240L160,240Q160,240 160,240.77Q160,241.54 160,243.46L160,320L160,320Q160,320 160,323.46Q160,326.92 160,332.31L160,707.69Q160,713.08 160,716.54Q160,720 160,720Z"/></svg>',
            5: '<svg viewBox="0 0 960 960" width="28" height="28" fill="currentColor"><path d="M401.45,713.85Q448.85,713.85 482.12,680.64Q515.38,647.44 515.38,600L515.38,316.92L596.92,316.92Q611.61,316.92 621.96,306.75Q632.31,296.58 632.31,281.54Q632.31,266.85 621.96,256.5Q611.61,246.15 596.92,246.15L503.08,246.15Q488.39,246.15 478.04,256.5Q467.69,266.85 467.69,281.54L467.69,508.31Q452.92,498 436.17,492.08Q419.41,486.15 401.54,486.15Q354.1,486.15 320.9,519.33Q287.69,552.51 287.69,599.91Q287.69,647.31 320.87,680.58Q354.05,713.85 401.45,713.85ZM480.07,860Q401.23,860 331.86,830.08Q262.49,800.16 211.18,748.87Q159.87,697.58 129.93,628.24Q100,558.9 100,480.07Q100,401.23 129.92,331.86Q159.84,262.49 211.13,211.18Q262.42,159.87 331.76,129.93Q401.1,100 479.93,100Q558.77,100 628.14,129.92Q697.51,159.84 748.82,211.13Q800.13,262.42 830.07,331.76Q860,401.1 860,479.93Q860,558.77 830.08,628.14Q800.16,697.51 748.87,748.82Q697.58,800.13 628.24,830.07Q558.9,860 480.07,860ZM480,800Q614,800 707,707Q800,614 800,480Q800,346 707,253Q614,160 480,160Q346,160 253,253Q160,346 160,480Q160,614 253,707Q346,800 480,800ZM480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Q480,480 480,480Z"/></svg>',
          },
          a = document.createElement("div");
        return (
          (a.style.display = "grid"),
          (a.style.gridTemplateColumns =
            "repeat(auto-fill, minmax(130px, 1fr))"),
          (a.style.gap = "14px"),
          (a.style.gridColumn = "1 / -1"),
          e.items.forEach((e) => {
            const t = document.createElement("div");
            t.className = "entrance";
            const i = n[e.entranceType] || "";
            ((t.innerHTML = `\n          <div class="entrance-icon">${i}</div>\n          <div class="entrance-text">${escapeHtml(e.title || "")}</div>\n        `),
              (t.onclick = () => {
                switchView(
                  {
                    0: "songs",
                    1: "artists",
                    2: "albums",
                    3: "playlists",
                    4: "folders",
                    5: "genres",
                  }[e.entranceType] || "songs",
                );
              }),
              a.appendChild(t));
          }),
          void t.appendChild(a)
        );
      }
      if ("quick_access" === e.id)
        return void e.items.forEach((e) => {
          t.appendChild(
            makeTile(
              {
                ...e,
                coverUrl: null,
                coverPath: null,
                path: null,
                id: null,
                audioId: null,
              },
              { onClick: () => onMetaClick(e) },
            ),
          );
        });
      if ("life_progress" === e.id) {
        const n = document.createElement("div");
        n.className = "waterfall-span heat-wrap";
        const a = document.createElement("div");
        a.className = "heat";
        const i = Math.max(1, ...e.items.map((e) => e.totalPlayTime || 0));
        return (
          e.items.forEach((e) => {
            const t = document.createElement("i");
            ((e.totalPlayTime || 0) > 0 &&
              (t.classList.add("on"),
              (t.style.opacity = String(
                0.35 + ((e.totalPlayTime || 0) / i) * 0.65,
              ))),
              a.appendChild(t));
          }),
          n.appendChild(a),
          void t.appendChild(n)
        );
      }
      if ("random_walk" === e.id) {
        const n = e.items.filter((e) => "song" === e.type || null != e.audioId);
        return void e.items.forEach((e) => {
          const a = document.createElement("div");
          ((a.className = "list-row"),
            (a.innerHTML = `<img src="${coverUrl(e, 150)}" alt="" />\n          <div style="min-width:0; overflow:hidden;">\n            <div class="t" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(e.title || "")}</div>\n            <div class="s" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(e.artist || "")}</div>\n          </div>`),
            (a.onclick = () => playSong(e, n)),
            t.appendChild(a));
        });
      }
      const n = [];
      (e.items.forEach((e) => {
        "recent_album" === e.type && e.children?.length
          ? n.push(...e.children)
          : ("song" !== e.type && null == e.audioId) || n.push(e);
      }),
        e.items.forEach((e) => {
          const a = e.type || "";
          "recent_album" === a && e.children?.length
            ? t.appendChild(
                makeTile(e, {
                  badge: getString("album_badge"),
                  onClick: () => playSong(e.children[0], e.children),
                }),
              )
            : "song" === a
              ? t.appendChild(makeTile(e, { onClick: () => playSong(e, n) }))
              : "artist" === a
                ? t.appendChild(
                    makeTile(e, {
                      subtitle:
                        null != e.playTimeMs
                          ? `${Math.round((e.playTimeMs || 0) / 6e4)}${getString("minutes")}`
                          : e.subtitle || "",
                      onClick: () => onMetaClick(e),
                    }),
                  )
                : t.appendChild(makeTile(e, { onClick: () => onMetaClick(e) }));
        }));
    }),
    content.appendChild(t));
}
const SVG_ARTIST =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 960" fill="#999"><path d="M700.02 772.31q-37.79 0-63.9-26.1-26.12-26.09-26.12-63.88 0-37.79 26.1-63.91 26.1-26.11 63.9-26.11 10.31 0 20.88 2.65 10.58 2.65 21.43 9.19l0-171.07q0-15.37 10.39-25.76 10.4-10.4 25.76-10.4l56.15 0q14.7 0 25.04 10.18 10.35 10.17 10.35 25.21 0 14.69-10.35 25.04-10.34 10.34-25.04 10.34l-44.61 0 0 214.62q0 37.8-26.09 63.9-26.1 26.1-63.89 26.1zM166.15 772.31q-15.36 0-25.76-10.4-10.39-10.39-10.39-25.76l0-52.77q0-30 15.96-54.73 15.96-24.73 42.66-38.19 60.07-29.46 120.03-43.81 59.96-14.34 121.35-14.34 24.54 0 48.35 2.08 23.8 2.07 46.8 7.07 15.62 3.23 21.31 13.39 5.69 10.15 4.08 21.3-1.62 11.16-10.35 19.08-8.73 7.92-22.34 5.08-21-4-43.04-6-22.04-2-44.81-2-55.08 0-108.54 13.23-53.46 13.23-105.31 38.46-12.07 6.15-19.11 16.69-7.04 10.54-7.04 22.69l0 28.93 306.46 0q15 0 22.5 9.35 7.5 9.35 7.5 20.58 0 11.22-7.5 20.64-7.5 9.43-22.5 9.43l-330.31 0zm263.85-304.62q-57.75 0-98.87-41.12-41.13-41.13-41.13-98.88 0-57.75 41.13-98.87 41.12-41.13 98.87-41.13 57.75 0 98.87 41.13 41.13 41.12 41.13 98.87 0 57.75-41.13 98.88-41.12 41.12-98.87 41.12zM430 407.69q33 0 56.5-23.5 23.5-23.5 23.5-56.5 0-33-23.5-56.5-23.5-23.5-56.5-23.5-33 0-56.5 23.5-23.5 23.5-23.5 56.5 0 33 23.5 56.5 23.5 23.5 56.5 23.5z"/></svg>',
    ),
  SVG_FOLDER =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 960" fill="#999"><path d="M172.31 780q-30.31 0-51.31-21-21-21-21-51.31l0-455.38q0-30.31 21-51.31 21-21 51.31-21l189.69 0q14.46 0 27.81 5.62 13.34 5.61 23.19 15.46l58.92 58.92 315.77 0q30.31 0 51.31 21 21 21 21 51.31l0 375.38q0 30.31-21 51.31-21 21-51.31 21l-615.38 0zm0-60l615.38 0q5.39 0 8.85-3.46 3.46-3.46 3.46-8.85l0-375.38q0-5.39-3.46-8.85-3.46-3.46-8.85-3.46l-340.31 0-76.53-76.54q-1.93-1.92-4.04-2.69-2.12-0.77-4.43-0.77l-190.07 0q-5.39 0-8.85 3.46-3.46 3.46-3.46 8.85l0 455.38q0 5.39 3.46 8.85 3.46 3.46 8.85 3.46z"/></svg>',
    ),
  SVG_ALBUM =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#999"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>',
    );
function makeTile(e, t = {}) {
  const { badge: n, subtitle: a, onClick: i } = t,
    s = Boolean(coverUrl(e, 500)),
    o = document.createElement("div");
  if (((o.className = s ? "tile" : "tile tile-plain"), (o.onclick = i), s)) {
    const t = document.createElement("div");
    t.className = "tile-media";
    const a = coverUrl(e, 500),
      i = document.createElement("img");
    if (
      ((i.loading = "lazy"),
      (i.alt = ""),
      "artist" === e.type
        ? ((i.src = a || SVG_ARTIST),
          (i.onerror = () => {
            ((i.src = SVG_ARTIST), (i.onerror = null));
          }))
        : "folder" === e.type
          ? ((i.src = a || SVG_FOLDER),
            (i.onerror = () => {
              ((i.src = SVG_FOLDER), (i.onerror = null));
            }))
          : ((i.src = a),
            (i.onerror = () => {
              i.style.opacity = "0.3";
            })),
      t.appendChild(i),
      n)
    ) {
      const e = document.createElement("span");
      ((e.className = "tile-badge"), (e.textContent = n), t.appendChild(e));
    }
    o.appendChild(t);
  } else {
    const t = document.createElement("div");
    ((t.className = "tile-plain-icon"),
      (t.textContent = (e.title || e.name || "?").slice(0, 1)),
      o.appendChild(t));
  }
  const r = document.createElement("div");
  r.className = "tile-meta";
  const l = e.title || e.name || "",
    c = null != a ? a : e.subtitle || e.artist || e.albumArtist || "";
  return (
    (r.innerHTML = `<div class="t">${escapeHtml(l)}</div>\n    <div class="s">${escapeHtml(c)}</div>`),
    o.appendChild(r),
    o
  );
}
function makeCard(e, t) {
  return makeTile(e, { onClick: t });
}
function escapeHtml(e) {
  return String(e)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
async function onMetaClick(e) {
  if (
    (log("info", "meta click", e.type, e.title || e.name),
    "pin_artist" === e.type || "artist" === e.type)
  ) {
    const t = await api(
      `/api/songs?artist=${encodeURIComponent(e.title || e.artist || "")}`,
    );
    return void (t[0] && playSong(t[0], t));
  }
  if ("pin_album" === e.type) {
    const t = new URLSearchParams({ album: e.album || e.title || "" });
    e.albumArtist && t.set("albumArtist", e.albumArtist);
    const n = await api(`/api/songs?${t}`);
    return void (n[0] && playSong(n[0], n));
  }
  if ("pin_playlist" === e.type && e.id) {
    const t = await api(`/api/songs?playlistId=${e.id}`);
    return void (t[0] && playSong(t[0], t));
  }
  if ("pin_dir" === e.type && e.path) {
    const t = await api(`/api/songs?dir=${encodeURIComponent(e.path)}`);
    return void (t[0] && playSong(t[0], t));
  }
  (null == e.audioId && null == e.id) || playSong(e);
}
function renderSongList(e) {
  if (
    (log("info", "renderSongList", e.length),
    (content.innerHTML = ""),
    !e.length)
  )
    return void (content.innerHTML = `<div class="empty">${getString("no_songs")}</div>`);
  const t = document.createElement("div");
  ((t.className = "song-list-header song-list-grid"),
    (t.innerHTML = `\n    <div>${getString("songs")}</div>\n    <div>${getString("artists")}</div>\n    <div>${getString("albums")}</div>\n    <div>${getString("col_year")}</div>\n    <div>${getString("genres")}</div>\n    <div style="text-align: right">${getString("col_time")}</div>\n  `),
    content.appendChild(t));
  const n = document.createElement("div");
  ((n.className = "song-list"),
    e.forEach((t) => {
      const a = document.createElement("div");
      ((a.className = "song-row song-list-grid"),
        state.current &&
          state.current.id === t.id &&
          a.classList.add("playing"),
        (a.innerHTML = `\n      <div class="cell-title">\n        <img class="cover" src="${coverUrl(t, 150) || SVG_ALBUM}" alt="" onerror="this.src='${SVG_ALBUM}'" />\n        <div class="t" title="${escapeHtml(t.title || "")}">${escapeHtml(t.title || "")}</div>\n      </div>\n      <div class="cell-artist" title="${escapeHtml(t.artist || "")}">${escapeHtml(t.artist || "")}</div>\n      <div class="cell-album" title="${escapeHtml(t.album || "")}">${escapeHtml(t.album || "")}</div>\n      <div class="cell-year">${t.year || ""}</div>\n      <div class="cell-genre" title="${escapeHtml(t.genre || "")}">${escapeHtml(t.genre || "")}</div>\n      <div class="cell-time" style="text-align: right">${fmt(t.durationMs || 0, !0)}</div>\n    `),
        (a.onclick = () => playSong(t, e)),
        n.appendChild(a));
    }),
    content.appendChild(n));
  if (songPageInfo.total > songPageInfo.pageSize) {
    const pagination = document.createElement("div");
    pagination.className = "song-pagination";
    pagination.innerHTML = `<button type="button" data-page="prev" ${songPageInfo.page <= 1 ? "disabled" : ""}>上一页</button><span>${songPageInfo.page} / ${Math.max(1, Math.ceil(songPageInfo.total / songPageInfo.pageSize))}</span><button type="button" data-page="next" ${songPageInfo.page * songPageInfo.pageSize >= songPageInfo.total ? "disabled" : ""}>下一页</button>`;
    pagination.querySelector('[data-page="prev"]').onclick = () => loadSongPage(songPageInfo.page - 1);
    pagination.querySelector('[data-page="next"]').onclick = () => loadSongPage(songPageInfo.page + 1);
    content.appendChild(pagination);
  }
}

let songPageInfo = { page: 1, pageSize: 100, total: 0 };
async function loadSongPage(page = 1) {
  const params = new URLSearchParams({
    page: String(Math.max(1, page)),
    pageSize: String(songPageInfo.pageSize),
    sort: "title",
  });
  const keyword = songSearchInput?.value?.trim();
  if (keyword) params.set("keyword", keyword);
  const result = await api(`/api/songs?${params}`);
  songPageInfo = {
    page: Number(result.page) || 1,
    pageSize: Number(result.pageSize) || 100,
    total: Number(result.total) || 0,
  };
  setListData(Array.isArray(result.songs) ? result.songs : [], "songs", renderSongList);
}
function renderNamedList(e, t, n, a = "") {
  (log("info", "renderNamedList", e.length), (content.innerHTML = ""));
  const i = document.createElement("div");
  ((i.className = "list"),
    e.forEach((e) => {
      const s = document.createElement("div");
      s.className = "list-row";
      const o = e[t] || e.name || e.title || "";
      let r = "";
      "artists" === a ? (r = SVG_ARTIST) : "folders" === a && (r = SVG_FOLDER);
      const l = coverUrl(e, 400);
      let c = "this.style.opacity='0.3'";
      (r && (c = `this.src='${r}'; this.onerror=null;`),
        (s.innerHTML = `<img src="${l || r}" alt="" onerror="${c}" />\n      <div><div class="t">${escapeHtml(o)}</div>\n      <div class="s">${escapeHtml(e.albumArtist || null != e.songCount ? `${e.songCount || ""}` : "")}</div></div>\n      <div></div>`),
        (s.onclick = () => n(e)),
        i.appendChild(s));
    }),
    content.appendChild(i));
}
function resolveMaskColor(e) {
  const t = [
    "#0F9D58",
    "#DB4437",
    "#4285F4",
    "#AB47BC",
    "#F4511E",
    "#00897B",
    "#C2185B",
  ];
  let n = 0;
  for (let t = 0; t < e.length; t++) n = e.charCodeAt(t) + ((n << 5) - n);
  const a = t[Math.abs(n) % t.length];
  return `rgba(${parseInt(a.slice(1, 3), 16)}, ${parseInt(a.slice(3, 5), 16)}, ${parseInt(a.slice(5, 7), 16)}, 0.39)`;
}
function renderGenreGrid(e, t, n) {
  (log("info", "renderGenreGrid", e.length), (content.innerHTML = ""));
  const a = document.createElement("div");
  ((a.className = "genre-list-grid"),
    e.forEach((e) => {
      const i = document.createElement("div");
      i.className = "genre-grid-item";
      const s = e[t] || e.name || e.title || "",
        o = coverUrl(e, 400);
      ((i.innerHTML = `\n      <div class="mask" style="background-color: ${resolveMaskColor(s)}"></div>\n      <div class="title">${escapeHtml(s)}</div>\n      <img src="${o || ""}" alt="" onerror="this.style.display='none';" />\n    `),
        (i.onclick = () => n(e)),
        a.appendChild(i));
    }),
    content.appendChild(a));
}
const sortOptions = {
  songs: [
    { value: "title", labelKey: "sort_name" },
    { value: "artist", labelKey: "artists" },
    { value: "album", labelKey: "albums" },
    { value: "durationMs", labelKey: "sort_duration" },
    { value: "size", labelKey: "sort_size" },
    { value: "dateAdded", labelKey: "sort_date_added" },
    { value: "dataModified", labelKey: "sort_date_modified" },
    { value: "track", labelKey: "sort_track" },
    { value: "year", labelKey: "col_year" },
  ],
  artists: [
    { value: "name", labelKey: "sort_name" },
    { value: "songCount", labelKey: "sort_song_count" },
    { value: "albumCount", labelKey: "sort_album_count" },
  ],
  albums: [
    { value: "album", labelKey: "sort_name" },
    { value: "albumArtist", labelKey: "artists" },
    { value: "songCount", labelKey: "sort_song_count" },
  ],
  playlists: [
    { value: "name", labelKey: "sort_name" },
    { value: "songCount", labelKey: "sort_song_count" },
  ],
  folders: [
    { value: "name", labelKey: "sort_name" },
    { value: "songCount", labelKey: "sort_song_count" },
  ],
  genres: [{ value: "name", labelKey: "sort_name" }],
};
let currentListData = null,
  currentListRenderFn = null,
  currentSortViewType = "",
  currentSortKey = "",
  currentSortDesc = !1;
function applySortAndRender() {
  if (!currentListData || !currentListRenderFn) return;
  const e = [...currentListData];
  (currentSortKey &&
    (e.sort((e, t) => {
      let n = e[currentSortKey],
        a = t[currentSortKey];
      if ("year" === currentSortKey && (n || a)) {
        const e = (e) => {
          if (!e) return 0;
          let t = String(e).replace(/\D/g, "");
          return t.length >= 8
            ? parseInt(t.substring(0, 8), 10)
            : t.length >= 6
              ? 1e4 * parseInt(t.substring(0, 4), 10) +
                100 * parseInt(t.substring(4, 6), 10)
              : t.length >= 4
                ? 1e4 * parseInt(t.substring(0, 4), 10)
                : 0;
        };
        ((n = e(n)), (a = e(a)));
      }
      return (
        null == n && (n = ""),
        null == a && (a = ""),
        "string" == typeof n && "string" == typeof a
          ? n.localeCompare(a, "zh-CN")
          : n > a
            ? 1
            : n < a
              ? -1
              : 0
      );
    }),
    currentSortDesc && e.reverse()),
    currentListRenderFn(e));
}
function updateSortUI(e) {
  const t = document.getElementById("sortContainer"),
    n = document.getElementById("sortSelect"),
    a = sortOptions[e];
  if (!a)
    return (
      t && (t.style.display = "none"),
      (currentListData = null),
      (currentListRenderFn = null),
      void (currentSortViewType = "")
    );
  (t && (t.style.display = "flex"),
    n &&
      ((n.innerHTML = a
        .map(
          (e) => `<option value="${e.value}">${getString(e.labelKey)}</option>`,
        )
        .join("")),
      (currentSortKey = a[0].value)),
    (currentSortDesc = !1));
  const i = document.getElementById("sortOrderBtn");
  i && (i.style.transform = "none");
}
function setListData(e, t, n) {
  ((currentListData = e),
    (currentListRenderFn = n),
    (currentSortViewType = t),
    updateSortUI(t),
    applySortAndRender());
}
function renderAlbum(e, t) {
  ((content.innerHTML = ""),
    (pageTitle.textContent = e.album || getString("albums")));
  const n = document.createElement("div");
  ((n.className = "album-header"),
    (n.innerHTML = `\n    <div class="album-cover-container">\n      <div class="vinyl-disc"></div>\n      <img src="${coverUrl(e, 500) || SVG_ALBUM}" alt="" onerror="this.src='${SVG_ALBUM}'" />\n    </div>\n    <div class="album-info">\n      <div class="t">${escapeHtml(e.album || "")}</div>\n      <div class="s">${escapeHtml(e.albumArtist || "")}</div>\n      <div class="actions">\n        <button type="button" class="btn-play-all">\n          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>\n          ${getString("play_all")}\n        </button>\n        <button type="button" class="btn-shuffle-play">\n          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>\n          ${getString("repeat_shuffle")}\n        </button>\n      </div>\n    </div>\n  `),
    (n.querySelector(".btn-play-all").onclick = () => {
      t.length > 0 && playSong(t[0], t);
    }),
    (n.querySelector(".btn-shuffle-play").onclick = () => {
      if (t.length > 0) {
        const e = [...t].sort(() => Math.random() - 0.5);
        ((state.shuffle = !0),
          localStorage.setItem("lunabeat_shuffle", "true"),
          updateRepeatUi(),
          playSong(e[0], e));
      }
    }),
    content.appendChild(n));
  const a = new Map();
  t.forEach((e) => {
    let t = e.disc || 1;
    (t <= 0 && (t = -1), a.has(t) || a.set(t, []), a.get(t).push(e));
  });
  const i = Array.from(a.keys()).sort((e, t) =>
      -1 === e ? 1 : -1 === t ? -1 : e - t,
    ),
    s = document.createElement("div");
  ((s.className = "album-track-list"),
    i.forEach((e) => {
      if (-1 !== e && i.length > 1) {
        const t = document.createElement("div");
        ((t.className = "disc-header"),
          (t.textContent = formatString(getString("disc_number"), e)),
          s.appendChild(t));
      }
      const n = a.get(e);
      (n.sort((e, t) => (e.track || 0) - (t.track || 0)),
        n.forEach((e) => {
          const n = document.createElement("div");
          ((n.className = "track-row"),
            (n.innerHTML = `\n        <div class="num">${e.track > 0 ? e.track : ""}</div>\n        <div class="t">${escapeHtml(e.title || "")}</div>\n        <div class="d">${fmt(e.durationMs || 0, !0)}</div>\n      `),
            (n.onclick = () => playSong(e, t)),
            s.appendChild(n));
        }));
    }),
    content.appendChild(s));
}
((document.getElementById("sortSelect").onchange = (e) => {
  ((currentSortKey = e.target.value), applySortAndRender());
}),
  (document.getElementById("sortOrderBtn").onclick = () => {
    ((currentSortDesc = !currentSortDesc),
      (document.getElementById("sortOrderBtn").style.transform = currentSortDesc
        ? "scaleY(-1)"
        : "none"),
      applySortAndRender());
  }));
const NAV_VIEW_KEY = "lunabeat_nav_view",
  NAV_VIEWS = new Set([
    "home",
    "songs",
    "artists",
    "albums",
    "playlists",
    "folders",
    "genres",
    "settings",
  ]);
function renderSettingsPage() {
  updateSortUI("");
  const e = "true" === localStorage.getItem(SHOW_DEBUG_LOG_KEY);
  content.innerHTML = `\n    <div class="settings-page">\n      <div class="settings-page-row">\n        <div class="settings-page-text">\n          <div class="settings-page-title">${escapeHtml(getString("show_debug_log"))}</div>\n        </div>\n        <label class="settings-page-switch">\n          <input type="checkbox" id="showDebugLogToggle" ${e ? "checked" : ""} />\n          <span class="settings-page-switch-ui" aria-hidden="true"></span>\n        </label>\n      </div>\n    </div>\n  `;
  const t = $("#showDebugLogToggle");
  t &&
    (t.onchange = (e) => {
      const t = applyShowDebugLog(e.target.checked);
      localStorage.setItem(SHOW_DEBUG_LOG_KEY, t ? "true" : "false");
    });
}
async function renderTransferPage() {
  const e = await api("/api/upload");
  if (!e?.configured)
    return void (content.innerHTML = `\n      <div class="transfer-page">\n        <div class="transfer-page-hint">${escapeHtml(getString("upload_no_folder"))}</div>\n      </div>\n    `);
  const t = e.folderName
    ? formatString(getString("upload_folder_label"), e.folderName)
    : "";
  content.innerHTML = `\n    <div class="transfer-page">\n      ${t ? `<div class="transfer-page-hint">${escapeHtml(t)}</div>` : ""}\n      <div class="transfer-dropzone" id="transferDropzone">\n        <div>${escapeHtml(getString("upload_drop_hint"))}</div>\n        <button type="button" id="transferPickBtn">${escapeHtml(getString("upload_select_files"))}</button>\n        <input type="file" id="transferFileInput" multiple accept="audio/*,.mp3,.flac,.m4a,.aac,.wav,.ogg,.opus,.amr" />\n      </div>\n      <div class="transfer-file-list" id="transferFileList"></div>\n    </div>\n  `;
  const n = $("#transferDropzone"),
    a = $("#transferFileInput"),
    i = $("#transferPickBtn"),
    s = $("#transferFileList"),
    o = [];
  let r = !1;
  function l() {
    s &&
      (s.innerHTML = o
        .map((e, t) => {
          const n =
              "success" === e.state
                ? "success"
                : "error" === e.state
                  ? "error"
                  : "",
            a =
              "success" === e.state
                ? getString("upload_success")
                : "error" === e.state
                  ? `${getString("upload_fail")}${e.error ? `: ${e.error}` : ""}`
                  : "uploading" === e.state
                    ? getString("upload_uploading")
                    : getString("upload_pending"),
            i =
              "success" === e.state ? 100 : Math.round(100 * (e.progress || 0));
          return `\n        <div class="transfer-file-item" data-index="${t}">\n          <div class="transfer-file-meta">\n            <div class="transfer-file-name" title="${escapeHtml(e.file.name)}">${escapeHtml(e.file.name)}</div>\n            <div class="transfer-file-status ${n}">${escapeHtml(a)} · ${formatFileSize(e.file.size)}</div>\n          </div>\n          <div class="transfer-file-progress"><span style="width:${i}%"></span></div>\n        </div>\n      `;
        })
        .join(""));
  }
  async function c() {
    if (r) return;
    const e = o.find((e) => "pending" === e.state);
    if (!e) return;
    ((r = !0), (e.state = "uploading"), (e.progress = 0), l());
    const t = new FormData();
    (t.append("file", e.file, e.file.name), t.append("fileName", e.file.name));
    try {
      (await apiUploadForm(t, (t) => {
        ((e.progress = t), l());
      }),
        (e.state = "success"),
        (e.progress = 1));
    } catch (t) {
      ((e.state = "error"),
        (e.error = t.message || String(t)),
        "invalid_file" === e.error &&
          (e.error = getString("upload_invalid_file")));
    } finally {
      ((r = !1), l(), c());
    }
  }
  function d(e) {
    let t = !1;
    (Array.from(e || []).forEach((e) => {
      if (!isUploadableAudioFile(e))
        return (
          o.push({
            file: e,
            state: "error",
            progress: 0,
            error: getString("upload_invalid_file"),
          }),
          void (t = !0)
        );
      (o.push({ file: e, state: "pending", progress: 0 }), (t = !0));
    }),
      t && (l(), c()));
  }
  (i &&
    a &&
    ((i.onclick = () => a.click()),
    (a.onchange = () => {
      (d(a.files), (a.value = ""));
    })),
    n &&
      (["dragenter", "dragover"].forEach((e) => {
        n.addEventListener(e, (e) => {
          (e.preventDefault(), n.classList.add("dragover"));
        });
      }),
      ["dragleave", "drop"].forEach((e) => {
        n.addEventListener(e, (e) => {
          (e.preventDefault(), n.classList.remove("dragover"));
        });
      }),
      n.addEventListener("drop", (e) => {
        d(e.dataTransfer?.files);
      })));
}
async function switchView(e) {
  ((state.view = e),
    (document.documentElement.dataset.navView = e),
    pageTitle &&
      (pageTitle.setAttribute("data-i18n", e),
      (pageTitle.textContent = getString(e) || titles[e] || e)),
    document.querySelectorAll(".nav-item").forEach((t) => {
      t.classList.toggle("active", t.dataset.view === e);
    }),
    NAV_VIEWS.has(e) && localStorage.setItem(NAV_VIEW_KEY, e),
    (content.innerHTML = `<div class="empty">${getString("loading")}</div>`),
    songSearchInput && (songSearchInput.style.display = e === "songs" ? "" : "none"),
    log("info", "switchView", e));
  try {
    if ("home" === e) (updateSortUI(""), renderHome(await api("/api/home")));
    else if ("songs" === e) await loadSongPage(1);
    else if ("artists" === e) {
      setListData(await api("/api/artists"), "artists", (e) =>
        renderNamedList(
          e,
          "name",
          async (e) => {
            const t = await api(
              `/api/songs?artist=${encodeURIComponent(e.name)}`,
            );
            ((pageTitle.textContent = e.name),
              setListData(t, "songs", renderSongList));
          },
          "artists",
        ),
      );
    } else if ("albums" === e) {
      setListData(await api("/api/albums"), "albums", (e) =>
        renderNamedList(
          e,
          "album",
          async (e) => {
            const t = new URLSearchParams({ album: e.album });
            e.albumArtist && t.set("albumArtist", e.albumArtist);
            const n = await api(`/api/songs?${t}`);
            ((pageTitle.textContent = e.album),
              setListData(n, "songs", (t) => renderAlbum(e, t)));
          },
          "albums",
        ),
      );
    } else if ("playlists" === e) {
      setListData(await api("/api/playlists"), "playlists", (e) =>
        renderNamedList(
          e,
          "name",
          async (e) => {
            const t = await api(`/api/songs?playlistId=${e.id}`);
            ((pageTitle.textContent = e.name),
              setListData(t, "songs", renderSongList));
          },
          "playlists",
        ),
      );
    } else if ("folders" === e) {
      setListData(await api("/api/folders"), "folders", (e) =>
        renderNamedList(
          e,
          "name",
          async (e) => {
            const t = await api(`/api/songs?dir=${encodeURIComponent(e.path)}`);
            ((pageTitle.textContent = e.name),
              setListData(t, "songs", renderSongList));
          },
          "folders",
        ),
      );
    } else if ("genres" === e) {
      setListData(await api("/api/genres"), "genres", (e) =>
        renderGenreGrid(e, "name", async (e) => {
          const t = await api(`/api/songs?genre=${encodeURIComponent(e.name)}`);
          ((pageTitle.textContent = e.name),
            setListData(t, "songs", renderSongList));
        }),
      );
    } else "settings" === e && renderSettingsPage();
    log("info", "switchView done", e);
  } catch (t) {
    (log("error", "switchView fail", e, t),
      (content.innerHTML = `<div class="empty">${getString("load_fail")}${escapeHtml(t.message || t)}<br/><small>${getString("see_log")}</small></div>`));
  }
}

let songSearchTimer = 0;
songSearchInput?.addEventListener("input", () => {
  clearTimeout(songSearchTimer);
  songSearchTimer = setTimeout(() => {
    if (state.view === "songs") loadSongPage(1).catch((error) => log("error", "search", error));
  }, 250);
});
(window.addEventListener("error", (e) => {
  log("error", "window.error", e.message, e.filename, e.lineno);
}),
  window.addEventListener("unhandledrejection", (e) => {
    log("error", "unhandledrejection", e.reason);
  }),
  $("#nav").addEventListener("click", (e) => {
    const t = e.target.closest(".nav-item");
    t && switchView(t.dataset.view);
  }));
const sidebar = document.getElementById("sidebar"),
  sidebarToggle = document.getElementById("sidebarToggle"),
  SIDEBAR_COLLAPSED_KEY = "lunabeat_sidebar_collapsed";
function setSidebarCollapsed(e) {
  sidebar &&
    (sidebar.classList.toggle("collapsed", e),
    document.documentElement.classList.toggle("sidebar-collapsed", e),
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, e ? "true" : "false"));
}
if (sidebar) {
  setSidebarCollapsed(
    document.documentElement.classList.contains("sidebar-collapsed") ||
      "true" === localStorage.getItem(SIDEBAR_COLLAPSED_KEY),
  );
}
(sidebarToggle &&
  sidebar &&
  (sidebarToggle.onclick = () => {
    setSidebarCollapsed(!sidebar.classList.contains("collapsed"));
  }),
  (btnPlay.onclick = () => togglePlay()),
  (npPlay.onclick = () => togglePlay()),
  ($("#btnPrev").onclick = () => playAt(-1)),
  ($("#btnNext").onclick = () => playAt(1)),
  ($("#npPrev").onclick = () => playAt(-1)),
  ($("#npNext").onclick = () => playAt(1)),
  ($("#btnOpenNow").onclick = () => openNowPlaying()),
  ($("#btnLyric").onclick = () => openNowPlaying()),
  ($("#npClose").onclick = () => closeNowPlaying()),
  btnRepeat && (btnRepeat.onclick = toggleRepeat),
  npRepeat && (npRepeat.onclick = toggleRepeat));
const npShuffleBtn = $("#npShuffleBtn");
npShuffleBtn && (npShuffleBtn.onclick = toggleShuffle);
const btnShuffle = $("#btnShuffle");
(btnShuffle && (btnShuffle.onclick = toggleShuffle),
  npLyric?.addEventListener("click", () => {
    ((state.showLyrics = !state.showLyrics),
      npLyric.classList.toggle("active", state.showLyrics),
      nowPlaying.classList.toggle("lyrics-hidden", !state.showLyrics));
  }));
const toggleQueue = () => {
  queueSidebar.classList.contains("hidden")
    ? (queueSidebar.classList.remove("hidden"),
      queueSidebar.setAttribute("aria-hidden", "false"),
      settingsSidebar.classList.add("hidden"),
      settingsSidebar.setAttribute("aria-hidden", "true"),
      renderQueue())
    : (queueSidebar.classList.add("hidden"),
      queueSidebar.setAttribute("aria-hidden", "true"));
};
(($("#btnQueue").onclick = toggleQueue),
  $("#npQueue") && ($("#npQueue").onclick = toggleQueue),
  ($("#btnCloseQueue").onclick = () => {
    (queueSidebar.classList.add("hidden"),
      queueSidebar.setAttribute("aria-hidden", "true"));
  }));
const btnLocateQueue = $("#btnLocateQueue");
btnLocateQueue &&
  (btnLocateQueue.onclick = () => {
    const e = queueList.querySelector(".queue-item.active");
    e && e.scrollIntoView({ behavior: "smooth", block: "center" });
  });
const toggleSettings = () => {
  settingsSidebar.classList.contains("hidden")
    ? (settingsSidebar.classList.remove("hidden"),
      settingsSidebar.setAttribute("aria-hidden", "false"),
      queueSidebar.classList.add("hidden"),
      queueSidebar.setAttribute("aria-hidden", "true"),
      loadLyricSettings())
    : (settingsSidebar.classList.add("hidden"),
      settingsSidebar.setAttribute("aria-hidden", "true"));
};
if (
  ($("#npSettings") && ($("#npSettings").onclick = toggleSettings),
  $("#sidebarSettingsBtn") &&
    ($("#sidebarSettingsBtn").onclick = () => switchView("settings")),
  $("#btnCloseSettings") &&
    ($("#btnCloseSettings").onclick = () => {
      (settingsSidebar.classList.add("hidden"),
        settingsSidebar.setAttribute("aria-hidden", "true"));
    }),
  lyricSizeSlider && lyricSizeDisplay)
) {
  const e = localStorage.getItem("lyricFontSize") || "32";
  ((lyricSizeSlider.value = e),
    (lyricSizeDisplay.textContent = e + "px"),
    (lyricSizeSlider.oninput = (e) => {
      const t = e.target.value;
      ((lyricSizeDisplay.textContent = t + "px"),
        localStorage.setItem("lyricFontSize", t),
        applyLyricFontSize(t));
    }));
}
function loadLyricSettings() {
  if (lyricHideExtraToggle) {
    lyricHideExtraToggle.checked =
      "true" === localStorage.getItem(HIDE_LYRIC_EXTRA_KEY);
  }
}
if (
  (lyricPosSlider &&
    lyricPosDisplay &&
    ((lyricPosSlider.value = savedLyricPos),
    (lyricPosDisplay.textContent = savedLyricPos + "vh"),
    (lyricPosSlider.oninput = (e) => {
      const t = e.target.value;
      ((lyricPosDisplay.textContent = t + "vh"),
        localStorage.setItem("lyricPos", t),
        document.documentElement.style.setProperty(
          "--lyric-align-offset",
          t + "vh",
        ),
        (window.lyricAlignOffsetVH = parseInt(t, 10)));
    })),
  lyricBlurToggle &&
    ((lyricBlurToggle.checked = window.lyricBlurEnabled),
    (lyricBlurToggle.onchange = (e) => {
      ((window.lyricBlurEnabled = e.target.checked),
        localStorage.setItem("lyricBlur", e.target.checked ? "true" : "false"));
    })),
  lyricElasticToggle &&
    ((lyricElasticToggle.checked = window.lyricElasticEnabled),
    (lyricElasticToggle.onchange = (e) => {
      ((window.lyricElasticEnabled = e.target.checked),
        localStorage.setItem(
          "lyricElastic",
          e.target.checked ? "true" : "false",
        ));
    })),
  lyricHideExtraToggle &&
    ((lyricHideExtraToggle.onchange = (e) => {
      const t = !!e.target.checked;
      localStorage.setItem(HIDE_LYRIC_EXTRA_KEY, t ? "true" : "false");
      const n = state.current?.id ?? state.current?.audioId;
      null != n && loadLyric(n);
    }),
    loadLyricSettings()),
  npPadXSlider && npPadXDisplay)
) {
  const e = String(applyNpPadX(savedNpPadX));
  ((npPadXSlider.value = e),
    (npPadXDisplay.textContent = e + "px"),
    (npPadXSlider.oninput = (e) => {
      const t = applyNpPadX(e.target.value);
      ((npPadXDisplay.textContent = t + "px"),
        localStorage.setItem(NP_PAD_X_KEY, String(t)));
    }));
}
(document.addEventListener("keydown", (e) => {
  "Escape" !== e.key ||
    nowPlaying.classList.contains("hidden") ||
    closeNowPlaying();
}),
  (volume.oninput = () => {
    const e = Number(volume.value);
    ((audio.volume = e),
      volume.style.setProperty("--progress", 100 * e + "%"),
      npVolume &&
        ((npVolume.value = e),
        npVolume.style.setProperty("--progress", 100 * e + "%")),
      localStorage.setItem("lunabeat_volume", e.toString()));
  }),
  npVolume &&
    (npVolume.oninput = () => {
      const e = Number(npVolume.value);
      ((audio.volume = e),
        npVolume.style.setProperty("--progress", 100 * e + "%"),
        volume &&
          ((volume.value = e),
          volume.style.setProperty("--progress", 100 * e + "%")),
        localStorage.setItem("lunabeat_volume", e.toString()));
    }),
  (seek.onmousedown = () => {
    state.seeking = !0;
  }),
  (seek.ontouchstart = () => {
    state.seeking = !0;
  }),
  (seek.oninput = () => {
    if (
      (seek.style.setProperty("--progress", (seek.value / 1e3) * 100 + "%"),
      audio.duration)
    ) {
      const e = seek.value / 1e3;
      ((curTime.textContent = fmt(e * audio.duration * 1e3, !0)),
        (remainTime.textContent = `-${fmt((1 - e) * audio.duration * 1e3, !0)}`));
    }
  }),
  (seek.onchange = () => {
    (audio.duration &&
      (audio.currentTime = (Number(seek.value) / 1e3) * audio.duration),
      (state.seeking = !1),
      syncLyricToAudio(!0));
  }),
  (seek.onmouseup = () => {
    state.seeking = !1;
  }));
let lastSaveTime = 0;
function savePlaybackState() {
  const e = Date.now();
  if (!(e - lastSaveTime < 2e3)) {
    lastSaveTime = e;
    try {
      const e = {
        queue: state.queue,
        index: state.index,
        progress: audio.currentTime,
        isPlaying: !audio.paused,
      };
      localStorage.setItem("lunabeat_queue", JSON.stringify(e));
    } catch (e) {}
  }
}
function reportTick(e) {
  if (!state.current) return;
  const t = state.current.id ?? state.current.audioId;
  t &&
    fetch(
      `/api/report_tick?id=${t}&tick=${Math.round(e)}&session=${state.playbackSession}`,
    ).catch((e) => log("warn", "report_tick failed", e));
}
let lastReportTime = 0,
  accumulatedPlayTimeMs = 0;
function setSeekLoading(e) {
  const t = seek?.closest(".np-seek");
  t && t.classList.toggle("is-loading", !!e);
}
let statusToastTimer = 0;
const failedQueueIndexes = new Set();
function showStatusToast(e, t = "info", n = 3500) {
  let a = document.getElementById("statusToast");
  (a ||
    ((a = document.createElement("div")),
    (a.id = "statusToast"),
    (a.className = "status-toast"),
    a.setAttribute("role", "status"),
    a.setAttribute("aria-live", "polite"),
    document.body.appendChild(a)),
    clearTimeout(statusToastTimer),
    (a.textContent = e),
    (a.className = `status-toast ${t} visible`),
    n > 0 &&
      (statusToastTimer = window.setTimeout(() => hideStatusToast(), n)));
}
function hideStatusToast() {
  const e = document.getElementById("statusToast");
  (clearTimeout(statusToastTimer), (statusToastTimer = 0), e?.classList.remove("visible"));
}
function handleUnsupportedPlayback() {
  const e = state.playbackSession;
  if (audio.dataset.failedPlaybackSession === e) return;
  ((audio.dataset.failedPlaybackSession = e),
    setSeekLoading(!1),
    audio.pause());
  state.index >= 0 && failedQueueIndexes.add(state.index);
  const t = state.queue.length > 1 && failedQueueIndexes.size < state.queue.length;
  (showStatusToast(
    getString(t ? "audio_unsupported_skipping" : "audio_unsupported"),
    "error",
    t ? 3000 : 6000,
  ),
    t
      ? window.setTimeout(() => {
          state.playbackSession === e && playAt(1);
        }, 1200)
      : setPlayingUi(!1));
}
(audio.addEventListener("timeupdate", () => {
  const e = audio.duration || 0,
    t = audio.currentTime || 0;
  if (
    (!state.seeking &&
      e > 0 &&
      ((seek.value = String((t / e) * 1e3)),
      seek.style.setProperty("--progress", (t / e) * 100 + "%"),
      (curTime.textContent = fmt(1e3 * t, !0)),
      (remainTime.textContent = `-${fmt(1e3 * (e - t), !0)}`)),
    savePlaybackState(),
    !audio.paused && !state.seeking)
  ) {
    const e = Math.max(0, t - lastReportTime);
    e < 2 &&
      ((accumulatedPlayTimeMs += 1e3 * e),
      accumulatedPlayTimeMs >= 15e3 &&
        (reportTick(15e3), (accumulatedPlayTimeMs -= 15e3)));
  }
  lastReportTime = t;
}),
  audio.addEventListener("ended", () => playAt(1, !0)),
  audio.addEventListener("play", () => {
    (setPlayingUi(!0),
      npVideoCover.classList.contains("hidden") ||
        npVideoCover.play().catch(() => {}));
  }),
  audio.addEventListener("pause", () => {
    (setPlayingUi(!1), npVideoCover.pause());
  }),
  audio.addEventListener("error", () => {
    (setSeekLoading(!1),
      log(
        "error",
        "audio element error",
        audio.error?.code,
        audio.error?.message,
        audio.src,
      ),
      (4 === audio.error?.code || 3 === audio.error?.code) &&
        handleUnsupportedPlayback());
  }),
  audio.addEventListener("waiting", () => setSeekLoading(!0)),
  audio.addEventListener("loadstart", () => {
    audio.src && setSeekLoading(!0);
  }),
  audio.addEventListener("stalled", () => setSeekLoading(!0)),
  audio.addEventListener("seeking", () => {
    state.seeking || setSeekLoading(!0);
  }),
  audio.addEventListener("canplay", () => {
    (setSeekLoading(!1), hideStatusToast());
  }),
  audio.addEventListener("playing", () => {
    (failedQueueIndexes.clear(), setSeekLoading(!1), hideStatusToast());
  }),
  audio.addEventListener("seeked", () => {
    (setSeekLoading(!1), syncLyricToAudio(!0));
  }),
  audio.addEventListener("canplaythrough", () => setSeekLoading(!1)));
let i18n = {
  title: "LunaBeat",
  home: "主页",
  songs: "歌曲",
  artists: "艺人",
  albums: "专辑",
  playlists: "歌单",
  folders: "文件夹",
  genres: "流派",
  transfer: "传输",
  search: "搜索歌曲、歌手或专辑",
  not_playing: "未播放",
  prev: "上一首",
  play_pause: "播放/暂停",
  next: "下一首",
  lyric: "歌词",
  collapse: "收起",
  repeat_all: "列表循环",
  repeat_one: "单曲循环",
  repeat_shuffle: "随机播放",
  queue_title: "播放列表",
  close: "关闭",
  loading: "加载中...",
  pin: "密码",
  connect: "连接",
  pairing_failed: "配对码不正确，请在 LunaBeat 设置页查看当前配对码。",
  home_empty: "暂无首页内容",
  album_badge: "专辑",
  unknown_artist: "未知艺人",
  unknown_album: "未知专辑",
  load_fail: "加载失败：",
  see_log: "详见右下角日志",
  unknown_song: "未知歌曲",
  unknown: "未知",
  queue_empty: "队列为空",
  queue_remove: "移除",
  audio_unsupported: "当前浏览器无法播放此音频。",
  audio_unsupported_skipping: "当前浏览器无法播放此音频，即将切换到下一首…",
  minutes: "分钟",
  lyric_hide_extra_info: "隐藏翻译、音译和创作者信息",
  creator_label: "创作者：",
  settings: "设置",
  playback_settings: "播放设置",
  lyric_font_size: "歌词字体大小",
  lyric_vertical_align: "歌词垂直对齐位置",
  lyric_blur_inactive: "模糊未唱歌词",
  lyric_elastic_scroll: "开启弹性滚动动画",
  np_side_padding: "宽屏播放页左右留白",
  show_debug_log: "显示日志入口",
  no_lyric: "暂无歌词",
  no_songs: "暂无歌曲",
  col_year: "年份",
  col_time: "时间",
  sort_name: "名称",
  sort_duration: "时长",
  sort_size: "大小",
  sort_date_added: "添加时间",
  sort_date_modified: "修改时间",
  sort_track: "曲目序号",
  sort_song_count: "歌曲数",
  sort_album_count: "专辑数",
  play_all: "播放全部",
  disc_number: "碟 %d",
  quality_sq: "Lossless",
  quality_hr: "Hi-Res",
  quality_master: "Master",
  repeat_off: "关闭循环",
  volume: "音量",
  more: "更多",
  open_now_playing: "打开播放页",
  locate_current: "定位当前播放",
  sort_order: "切换排序方向",
  debug_log: "日志",
  upload_drop_hint: "将音频文件拖放到此处，或点击选择文件",
  upload_select_files: "选择文件",
  upload_no_folder:
    "请先在手机 App「设置 → 局域网 Web 音乐服务」中选择 Web 上传文件夹",
  upload_uploading: "上传中",
  upload_success: "上传成功",
  upload_fail: "上传失败",
  upload_invalid_file: "不支持的音频格式",
  upload_folder_label: "目标文件夹：%s",
  upload_pending: "等待上传",
};
function getString(e) {
  return i18n[e] || e;
}
function formatString(e, ...t) {
  let n = 0;
  return String(e).replace(/%[sd]/g, () => String(t[n++] ?? ""));
}
((window.getWebString = getString),
  api("/api/strings")
    .then((e) => {
      const t = e.__languageTag || "zh-CN",
        n = e.__direction || "ltr";
      (document.documentElement.setAttribute("lang", t),
        document.documentElement.setAttribute("dir", n),
        delete e.__languageTag,
        delete e.__direction);
      if (
        ((i18n = { ...i18n, ...e }),
        document.querySelectorAll("[data-i18n]").forEach((e) => {
          const t = e.getAttribute("data-i18n");
          i18n[t] &&
            ("TITLE" === e.tagName
              ? (document.title = i18n[t])
              : (e.textContent = i18n[t]));
        }),
        document.querySelectorAll("[data-i18n-title]").forEach((e) => {
          const t = e.getAttribute("data-i18n-title");
          i18n[t] && (e.title = i18n[t]);
        }),
        document.querySelectorAll("[data-i18n-aria]").forEach((e) => {
          const t = e.getAttribute("data-i18n-aria");
          i18n[t] && e.setAttribute("aria-label", i18n[t]);
        }),
        document.querySelectorAll("[data-i18n-placeholder]").forEach((e) => {
          const t = e.getAttribute("data-i18n-placeholder");
          i18n[t] && e.setAttribute("placeholder", i18n[t]);
        }),
        updateRepeatUi(),
        state.current)
      ) {
        const e = state.current.title || getString("unknown_song");
        (nowTitle && (nowTitle.textContent = e),
          npTitle && (npTitle.textContent = e));
      } else
        (nowTitle && (nowTitle.textContent = getString("not_playing")),
          npTitle && (npTitle.textContent = getString("not_playing")));
      if (currentListData && currentListRenderFn && currentSortViewType) {
        const e = document.getElementById("sortSelect"),
          t = sortOptions[currentSortViewType];
        if (e && t) {
          const n = e.value;
          ((e.innerHTML = t
            .map(
              (e) =>
                `<option value="${e.value}">${getString(e.labelKey)}</option>`,
            )
            .join("")),
            n && (e.value = n));
        }
        applySortAndRender();
      }
    })
    .catch((e) => log("warn", "/api/strings fetch failed", e)),
  updateRepeatUi());
const savedVolume = localStorage.getItem("lunabeat_volume");
if (null !== savedVolume) {
  const e = Number(savedVolume);
  ((audio.volume = e),
    volume &&
      ((volume.value = e),
      volume.style.setProperty("--progress", 100 * e + "%")),
    npVolume &&
      ((npVolume.value = e),
      npVolume.style.setProperty("--progress", 100 * e + "%")));
}
(api("/api/server")
  .then((e) => {
    (log("info", "server info", e),
      ($("#serverInfo").textContent = e.baseUrl || ""));
  })
  .catch((e) => log("error", "/api/server", e)),
  $("#debugLogToggle")?.addEventListener("click", () => {
    const e = $("#debugLog");
    e && e.classList.toggle("hidden");
  }),
  (content.innerHTML = `<div class="empty">${getString("loading")}</div>`));
const savedNavView = localStorage.getItem(NAV_VIEW_KEY);
switchView(NAV_VIEWS.has(savedNavView) ? savedNavView : "home");
try {
  const e = JSON.parse(localStorage.getItem("lunabeat_queue"));
  if (e && e.queue && e.queue.length > 0) {
    ((state.queue = e.queue), (state.index = e.index || 0));
    const t = state.queue[state.index];
    if (t) {
      ((state.current = t), applyNowPlaying(t));
      const n = t.id ?? t.audioId;
      (setSeekLoading(!0),
        (audio.src = t.streamUrl || `/api/stream?id=${n}`),
        audio.addEventListener("loadedmetadata", function t() {
          ((audio.currentTime = e.progress || 0),
            e.isPlaying
              ? audio.play().catch((e) => log("warn", "auto play blocked", e))
              : setPlayingUi(!1),
            audio.removeEventListener("loadedmetadata", t));
        }),
        loadLyric(n));
    }
  }
} catch (e) {
  log("warn", "restore queue failed", e);
}
"true" === localStorage.getItem("nowPlayingOpen") && _openNowPlayingDOM();
