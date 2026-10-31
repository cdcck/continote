/**
 * ContiNote - Auto-Crop Pixel Detection & Manual Crop Engine
 */

export function computeAutoCropBox(img) {
  const maxSampleDim = 800;
  const scale = Math.min(1, maxSampleDim / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.max(1, Math.round(img.naturalWidth * scale));
  const sh = Math.max(1, Math.round(img.naturalHeight * scale));

  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);

  const imgData = ctx.getImageData(0, 0, sw, sh).data;

  // 1. 4개 모서리(상하좌우 가장자리) 다중 샘플링을 통한 스마트 배경 밝기(Luminance) 추정
  const cornerSamples = [];
  const sampleInset = Math.max(2, Math.round(Math.min(sw, sh) * 0.02));
  const samplePoints = [
    [sampleInset, sampleInset],
    [sw - sampleInset - 1, sampleInset],
    [sampleInset, sh - sampleInset - 1],
    [sw - sampleInset - 1, sh - sampleInset - 1],
    [Math.floor(sw / 2), sampleInset],
    [Math.floor(sw / 2), sh - sampleInset - 1],
    [sampleInset, Math.floor(sh / 2)],
    [sw - sampleInset - 1, Math.floor(sh / 2)]
  ];

  for (const [px, py] of samplePoints) {
    const idx = (py * sw + px) * 4;
    const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
    cornerSamples.push(lum);
  }

  cornerSamples.sort((a, b) => a - b);
  // 가장자리 샘플 중 상위 75% 수준의 밝기를 배경 기준 밝기로 채택 (그림자/노이즈 왜곡 차단)
  const bgLuminance = Math.max(160, cornerSamples[Math.floor(cornerSamples.length * 0.75)] || 240);

  // 2. 어두운 잉크(오선, 음표, 가사, 제목) 판별 기준 (배경보다 35 이상 어둡거나 180 미만인 픽셀)
  const inkThreshold = Math.min(195, bgLuminance - 32);

  function isInkPixel(x, y) {
    const idx = (y * sw + x) * 4;
    const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
    return lum < inkThreshold;
  }

  // 3. 통계적 노이즈 필터링 (가장자리 먼지나 1픽셀 그림자에 멈추지 않고, 유의미한 밀도 검출)
  const minRowInkCount = Math.max(3, Math.round(sw * 0.012)); // 가로폭의 약 1.2% 이상
  const minColInkCount = Math.max(3, Math.round(sh * 0.012)); // 세로높이의 약 1.2% 이상

  function hasRowContent(y) {
    let count = 0;
    for (let x = 0; x < sw; x += 2) {
      if (isInkPixel(x, y)) {
        count++;
        if (count >= minRowInkCount) return true;
      }
    }
    return false;
  }

  function hasColContent(x) {
    let count = 0;
    for (let y = 0; y < sh; y += 2) {
      if (isInkPixel(x, y)) {
        count++;
        if (count >= minColInkCount) return true;
      }
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

  // 검출 실패 또는 너무 작게 감지된 경우 원본 전체 유지
  if (top >= bottom || left >= right || (right - left) < sw * 0.2 || (bottom - top) < sh * 0.2) {
    return { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  }

  // 4. 악보 가독성을 위한 시원하고 단정한 안전 패딩 (약 2%)
  const pad = Math.round(Math.min(sw, sh) * 0.02);
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
