import { LyricPlayer } from "/amll-core.js?v=20260730-5";

export function createLyricPlayer(mount, options = {}) {
  const player = new LyricPlayer();
  const element = player.getElement();
  const bottomLine = player.getBottomLineElement();
  mount.replaceChildren(element);

  player.setEnableScale(true);
  player.setWordFadeWidth(0.5);
  player.setAlignPosition((window.lyricAlignOffsetVH || 32) / 100);
  player.setEnableBlur(window.lyricBlurEnabled !== false);
  player.setEnableSpring(window.lyricElasticEnabled !== false);
  player.resume();

  let lines = [];
  let lastFrameTime = performance.now();
  let previousBlur = window.lyricBlurEnabled !== false;
  let previousSpring = window.lyricElasticEnabled !== false;
  let previousAlign = window.lyricAlignOffsetVH || 32;

  player.addEventListener("line-click", (event) => {
    const line = lines[event.lineIndex];
    if (line && Number.isFinite(line.startTime)) {
      // AMLL keeps a temporary manual-scroll offset. Clear it before a
      // click-to-seek, otherwise the selected line is laid out from the old
      // scrolled position.
      player.resetScroll();
      player.setCurrentTime(line.startTime, true);
      player.update(0);
      options.onSeek?.(line.startTime);
    }
  });

  return {
    setLines(input) {
      lines = (Array.isArray(input) ? input : []).map(normalizeLine);
      player.setLyricLines(lines, 0);
    },

    setSongwriters(input, creatorLabel = "创作者：") {
      const songwriters = (Array.isArray(input) ? input : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      bottomLine.replaceChildren();
      if (songwriters.length > 0) {
        const content = document.createElement("div");
        content.className = "amll-bottom-creators";
        const label = document.createElement("strong");
        label.textContent = creatorLabel;
        content.append(label, document.createTextNode(songwriters.join("、")));
        bottomLine.appendChild(content);
      }
    },

    setTime(time, isSeek = false) {
      const blur = window.lyricBlurEnabled !== false;
      const spring = window.lyricElasticEnabled !== false;
      const align = window.lyricAlignOffsetVH || 32;
      if (blur !== previousBlur) {
        previousBlur = blur;
        player.setEnableBlur(blur);
      }
      if (spring !== previousSpring) {
        previousSpring = spring;
        player.setEnableSpring(spring);
      }
      if (align !== previousAlign) {
        previousAlign = align;
        player.setAlignPosition(align / 100);
      }

      const now = performance.now();
      const delta = Math.min(50, Math.max(0, now - lastFrameTime));
      lastFrameTime = now;
      player.setCurrentTime(Math.max(0, Number(time) || 0), Boolean(isSeek));
      player.update(delta);
    },

    destroy() {
      player.dispose();
      lines = [];
    },

    viewport: element,
  };
}

function normalizeLine(line) {
  const words = Array.isArray(line?.words) ? line.words.map(normalizeWord) : [];
  const startTime = finiteNumber(line?.startTime, words[0]?.startTime || 0);
  const endTime = finiteNumber(
    line?.endTime,
    words[words.length - 1]?.endTime || startTime + 2_000,
  );
  return {
    words:
      words.length > 0
        ? words
        : [
            {
              startTime,
              endTime,
              word: String(line?.text || ""),
            },
          ],
    translatedLyric: String(
      line?.translatedLyric || line?.translation || line?.subLines?.[0]?.text || "",
    ),
    romanLyric: String(line?.romanLyric || ""),
    startTime,
    endTime,
    isBG: Boolean(line?.isBG),
    isDuet: Boolean(line?.isDuet),
  };
}

function normalizeWord(word) {
  return {
    startTime: finiteNumber(word?.startTime, 0),
    endTime: finiteNumber(word?.endTime, finiteNumber(word?.startTime, 0) + 1),
    word: String(word?.word ?? word?.text ?? ""),
    ...(word?.romanWord || word?.transliteration
      ? { romanWord: String(word.romanWord || word.transliteration) }
      : {}),
  };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
