export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
export function imageSelectionError(file) {
  if (!file) return null;
  if (!TYPES.has(file.type)) return 'Choose a PNG, JPG or WebP image.';
  if (file.size > IMAGE_MAX_BYTES) return 'Choose an image no larger than 2 MB.';
  return null;
}
