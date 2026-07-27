export function formatSecondsToMinSecMs(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return '00:00.000';
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  return `${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

export function formatLrcTimePrefix(seconds) {
  return `[${formatLrcTime(seconds)}]`;
}

export function formatLrcTime(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return '00:00.00';
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const centiseconds = Math.floor((seconds % 1) * 100);
  return `${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

export function parseMinSecMsToSeconds(timeString) {
  if (!timeString) return 0;
  const parts = timeString.trim().split(':');
  if (parts.length !== 2) return parseFloat(timeString) || 0;

  const minutes = parseInt(parts[0], 10) || 0;
  const secondParts = parts[1].split('.');
  const seconds = parseInt(secondParts[0], 10) || 0;
  const fraction = secondParts[1] || '';
  const fractionValue = fraction ? parseInt(fraction, 10) : 0;
  const millisecondScale = fraction ? Math.pow(10, 3 - fraction.length) : 1;
  const milliseconds = fraction ? fractionValue * millisecondScale : 0;
  return minutes * 60 + seconds + milliseconds / 1000;
}

export function formatTTMLTime(seconds) {
  if (seconds === null || seconds === undefined) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}
