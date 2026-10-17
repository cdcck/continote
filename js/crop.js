/**
 * ContiNote - Auto-Crop Pixel Detection & Manual Crop Engine
 */

export function computeAutoCropBox(img) {
  const maxSampleDim = 700;
  const scale = Math.min(1, maxSampleDim / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.max(1, Math.round(img.naturalWidth * scale));
  const sh = Math.max(1, Math.round(img.naturalHeight * scale));

  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);

  const imgData = ctx.getImageData(0, 0, sw, sh).data;
  // 상단 모서리 픽셀 색상을 배경색으로 판별
  const bgR = imgData[0], bgG = imgData[1], bgB = imgData[2];
  const tolerance = 24;

  function isBgPixel(x, y) {
    const idx = (y * sw + x) * 4;
    return (
      Math.abs(imgData[idx] - bgR) <= tolerance &&
      Math.abs(imgData[idx + 1] - bgG) <= tolerance &&
      Math.abs(imgData[idx + 2] - bgB) <= tolerance
    );
  }

  function hasRowContent(y) {
    for (let x = 0; x < sw; x += 2) {
      if (!isBgPixel(x, y)) return true;
    }
    return false;
  }

  function hasColContent(x) {
    for (let y = 0; y < sh; y += 2) {
      if (!isBgPixel(x, y)) return true;
    }
    return false;
  }

  let top = 0;
  while (top < sh && !hasRowContent(top)) top++;

  let bottom = sh - 1;
  while (bottom > top && !hasRowContent(bottom)) bottom--;

  let left = 0;
  while (left < sw && !hasColContent(left)) left++;

  let right = sw - 1;
  while (right > left && !hasColContent(right)) right--;

  if (top >= bottom || left >= right) {
    return { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  }

  const pad = 10;
  top = Math.max(0, top - pad);
  left = Math.max(0, left - pad);
  bottom = Math.min(sh - 1, bottom + pad);
  right = Math.min(sw - 1, right + pad);

  const inv = 1 / scale;
  return {
    x: Math.round(left * inv),
    y: Math.round(top * inv),
    w: Math.round((right - left) * inv),
    h: Math.round((bottom - top) * inv)
  };
}

export function renderCroppedDataURL(img, box) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(box.w));
  c.height = Math.max(1, Math.round(box.h));
  const ctx = c.getContext('2d');
  ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

export function syncCropBoxDOM(cropBox, cropDisplayImg, cropTarget, manualBox) {
  if (!cropBox || !cropDisplayImg || !cropTarget) return;
  const scale = cropDisplayImg.clientWidth / cropTarget.naturalW;
  const bw = Math.max(1, Math.round(manualBox.x2 - manualBox.x1));
  const bh = Math.max(1, Math.round(manualBox.y2 - manualBox.y1));
  cropBox.style.left = (manualBox.x1 * scale) + 'px';
  cropBox.style.top = (manualBox.y1 * scale) + 'px';
  cropBox.style.width = (bw * scale) + 'px';
  cropBox.style.height = (bh * scale) + 'px';
}
