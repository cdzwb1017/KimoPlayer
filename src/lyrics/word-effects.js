const BACKGROUND_LIFT_SCALE = 0.5;
const LIFT_WAVE_RADIUS = 1.2;
const LIFT_WRITE_EPSILON = 0.005;
const MAX_LIFT_SPEED_PX_PER_SECOND = 22;
const GLOW_WRITE_EPSILON = 0.01;

export function collectLongGlowIndices(wordSpans) {
  const longIndices = [];

  wordSpans.forEach((span, index) => {
    if (span?.classList.contains('long-glow')) {
      longIndices.push(index);
    }
  });

  return longIndices;
}

function calculateLift(charDistance, liftAmplitude, isBackground) {
  let lift = 0;

  if (charDistance < -1.0) {
    lift = -liftAmplitude;
  } else if (charDistance < LIFT_WAVE_RADIUS) {
    const range = LIFT_WAVE_RADIUS + 1.0;
    const t = 1.0 - (charDistance + 1.0) / range;
    lift = t * -liftAmplitude;
  }

  return isBackground ? lift * BACKGROUND_LIFT_SCALE : lift;
}

function applyLift(span, lift, deltaTime) {
  // ⭐ 恢复逐字抬起动画，但彻底改「抬起位移的作用对象」：
  // 旧做法（破坏对齐的根因）：span.style.transform = translateY(x) → 每个 word 盒子整体上抬，
  //   有注音/没注音、唱完/没唱完的字因为位移值不同 → 内容盒子 baseline 不在同一水平线 → 两层字。
  // 新做法（Apple Music/AMLL 的真实实现思路）：抬起位移作为「视觉内容的 translate」，
  //   用 CSS 变量 --word-lift 驱动，内容（文字 + 注音）在 word 盒子内部相对位移，
  //   **word 盒子本身在 normal flow 里的外盒 baseline/top 永远不动** → 同行字对齐永不破坏。
  //   这样「看起来每个字都上抬不同高度」= 视觉有抬起动画，但 normal flow 盒子还是一个水平线。
  const prevLift = parseFloat(span.dataset.liftVal || '0.000');
  const safeDeltaTime = Number.isFinite(deltaTime)
    ? Math.max(0.001, Math.min(0.08, deltaTime))
    : 0.016;
  const maxStep = MAX_LIFT_SPEED_PX_PER_SECOND * safeDeltaTime;
  const liftDelta = lift - prevLift;
  const limitedLift = Math.abs(liftDelta) > maxStep
    ? prevLift + Math.sign(liftDelta) * maxStep
    : lift;

  if (Math.abs(limitedLift - prevLift) > LIFT_WRITE_EPSILON) {
    // 不再直接写 span.style.transform translateY → 改成写 CSS 变量。
    // .lyrics-word 会用 calc(1em * 内部行高) + 这个 --word-lift 把内部所有内容（含注音）整体上抬，
    // word 盒子外盒（normal flow layout baseline/top/height）完全不变 → 同行字对齐。
    // ⭐ 收敛动画期间（未染色的字没有 CSS will-change）动态提升合成层，
    //    避免每帧整字重绘导致抬起动画帧率低；稳定后由下方逻辑释放。
    span.style.willChange = 'transform';
    span.style.setProperty('--word-lift', `${limitedLift.toFixed(2)}px`);
    span.dataset.liftVal = limitedLift.toFixed(3);
    span._liftStableFrames = 0;
  } else if (span._liftStableFrames !== undefined) {
    // 值已稳定：连续 3 帧无写入才释放图层（避免抖动反复建层/拆层）
    span._liftStableFrames += 1;
    if (span._liftStableFrames >= 3 && span.style.willChange) {
      span.style.willChange = '';
      span._liftStableFrames = undefined;
    }
  }
}

function calculateGlow(index, charC, longIndices) {
  let glow = 0.0;

  longIndices.forEach(longIndex => {
    const longCharDistance = longIndex - charC;
    const power = longCharDistance > 0
      ? Math.max(0, 1 - longCharDistance / 1.2)
      : Math.max(0, 1 - Math.abs(longCharDistance) / 1.8);

    const spreadDistance = Math.abs(index - longIndex);
    const spread = spreadDistance === 0
      ? 1.0
      : Math.max(0, 1 - spreadDistance / 1.2) * 0.55;

    glow = Math.max(glow, power * spread);
  });

  return glow;
}

function applyGlow(span, glow) {
  const prevGlow = parseFloat(span.dataset.glowVal || '-999');

  if (Math.abs(glow - prevGlow) > GLOW_WRITE_EPSILON || glow === 0 || glow === 1) {
    span.style.setProperty('--singing-glow-intensity', glow.toFixed(3));
    span.dataset.glowVal = glow.toFixed(3);

    if (glow > 0.01) {
      span.classList.add('singing-glow');
    } else {
      span.classList.remove('singing-glow');
    }
  }
}

export function renderWordMotionEffects({
  wordSpans,
  charWords,
  charC,
  liftAmplitude,
  isBackground,
  deltaTime,
  longIndices = collectLongGlowIndices(wordSpans),
}) {
  // 原版逐字抬起：每个字按与原版完全一致的 calculateLift 波峰曲线驱动
  wordSpans.forEach((span, index) => {
    const charWord = charWords[index];
    if (!charWord) return;

    const charDistance = index - charC;
    const lift = calculateLift(charDistance, liftAmplitude, isBackground);
    applyLift(span, lift, deltaTime);

    const glow = calculateGlow(index, charC, longIndices);
    applyGlow(span, glow);
  });
}
