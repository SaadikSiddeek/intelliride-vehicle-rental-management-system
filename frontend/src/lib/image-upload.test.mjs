import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_MAX_BYTES, imageSelectionError } from './image-upload.mjs';
test('company and profile selections accept only supported image types within the server limit', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    assert.equal(imageSelectionError({type, size: IMAGE_MAX_BYTES}), null);
    assert.match(imageSelectionError({type, size: IMAGE_MAX_BYTES + 1}), /2 MB/);
  }
  for (const type of ['image/svg+xml', 'text/html', 'application/octet-stream', '']) {
    assert.match(imageSelectionError({type, size: 100}), /PNG, JPG or WebP/);
  }
  assert.equal(imageSelectionError(null), null);
});
