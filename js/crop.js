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
  const maxDim = 1800;
  let targetW = Math.max(1, Math.round(box.w));
  let targetH = Math.max(1, Math.round(box.h));

  // 악보 가독성에 충분한 최대 1800px 해상도로 스마트 다운스케일
  if (targetW > maxDim || targetH > maxDim) {
    if (targetW > targetH) {
      targetH = Math.round((targetH * maxDim) / targetW);
      targetW = maxDim;
    } else {
      targetW = Math.round((targetW * maxDim) / targetH);
      targetH = maxDim;
    }
  }

  const c = document.createElement('canvas');
  c.width = targetW;
  c.height = targetH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, c.width, c.height);

  try {
    const webp = c.toDataURL('image/webp', 0.85);
    if (webp.startsWith('data:image/webp')) return webp;
  } catch (_) {}
  return c.toDataURL('image/jpeg', 0.85);
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
