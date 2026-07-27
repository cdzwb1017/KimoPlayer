const LIFT_WAVE_RADIUS = 1.2;
const BACKGROUND_LIFT_SCALE = 0.5;
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
    span.style.transition = 'none';
    span.style.transform = `translateY(${limitedLift.toFixed(2)}px) translateZ(0)`;
    span.dataset.liftVal = limitedLift.toFixed(3);
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
