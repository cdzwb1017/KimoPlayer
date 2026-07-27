import { convertFileSrc } from '@tauri-apps/api/core';

const EMPTY_COVER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='%23333'/></svg>";

export function getCoverSrc(coverImage) {
  if (!coverImage) return EMPTY_COVER;
  if (coverImage.startsWith('data:')) return coverImage;
  return convertFileSrc(coverImage);
}
