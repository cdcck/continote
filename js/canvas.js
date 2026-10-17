/**
 * ContiNote - 3-Layer Canvas Engine & Drawing System (악보 1:1 밀착형)
 */

import { state } from './state.js';
import { idbGet } from './db.js';

export let currentSheetRect = { x: 0, y: 0, w: 0, h: 0 };

export function clearCanvases(sheetContainer, baseCanvas, userCanvas) {
  if (baseCanvas) {
    const ctx = baseCanvas.getContext('2d');
    ctx.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
  }
  if (userCanvas) {
    const ctx = userCanvas.getContext('2d');
    ctx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  }
}

export function renderBaseSheet(viewer, sheetContainer, baseCanvas, song) {
  return new Promise((resolve) => {
    if (!song || !baseCanvas || !viewer || !sheetContainer) return resolve();
    const img = new Image();
    img.onload = () => {
      const vw = viewer.clientWidth;
      const vh = viewer.clientHeight;
      if (vw === 0 || vh === 0) return resolve();

      // 악보 종횡비 유지 계산 (가로는 가운데 정렬, 세로는 상단 여백 없이 위로 밀착)
      const scale = Math.min(vw / img.width, vh / img.height);
      const dw = Math.floor(img.width * scale);
      const dh = Math.floor(img.height * scale);
      const dx = Math.floor((vw - dw) / 2);
      const dy = 0; // 악보 위에 여백을 없애고 위로 딱 밀착

      currentSheetRect = { x: dx, y: dy, w: dw, h: dh };

      // sheetContainer를 악보 이미지 바운딩 박스에 1:1 정확히 밀착
      sheetContainer.style.left = `${dx}px`;
      sheetContainer.style.top = `${dy}px`;
      sheetContainer.style.width = `${dw}px`;
      sheetContainer.style.height = `${dh}px`;

      // 기준 모바일 악보 가로폭(380px) 대비 실제 악보 크기 비례 계수 계산 (최소 0.8배 보장)
      const sheetScaleRatio = Math.max(0.8, dw / 380);
      sheetContainer.style.setProperty('--sheet-scale', sheetScaleRatio.toFixed(3));

      // 캔버스 해상도 DPI 동기화
      const dpr = window.devicePixelRatio || 1;
      baseCanvas.width = dw * dpr;
      baseCanvas.height = dh * dpr;
      baseCanvas.style.width = `${dw}px`;
      baseCanvas.style.height = `${dh}px`;

      const ctx = baseCanvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, dw, dh);
      ctx.drawImage(img, 0, 0, dw, dh);

      resolve();
    };
    img.onerror = () => resolve();
    img.src = song.image;
  });
}

export async function renderUserDrawing(sheetContainer, userCanvas, songId) {
  if (!sheetContainer || !userCanvas) return;
  const dw = sheetContainer.clientWidth;
  const dh = sheetContainer.clientHeight;
  if (dw === 0 || dh === 0) return;

  const dpr = window.devicePixelRatio || 1;
  userCanvas.width = dw * dpr;
  userCanvas.height = dh * dpr;
  userCanvas.style.width = `${dw}px`;
  userCanvas.style.height = `${dh}px`;

  const ctx = userCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, dw, dh);
  if (!songId) return;

  const rec = await idbGet('notes', songId);
  if (!rec || !rec.dataURL) return;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, dw, dh);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = rec.dataURL;
  });
}

export function setupDrawingSystem(userCanvas, onStrokeEnd) {
  if (!userCanvas) return;
  const ctx = userCanvas.getContext('2d');
  let isDrawing = false;

  function getPoint(e) {
    const rect = userCanvas.getBoundingClientRect();
    const scaleX = (rect.width / (userCanvas.clientWidth || 1)) || 1;
    const scaleY = (rect.height / (userCanvas.clientHeight || 1)) || 1;
    return {
      x: (e.clientX - rect.left) / scaleX,
      y: (e.clientY - rect.top) / scaleY
    };
  }

  userCanvas.addEventListener('pointerdown', (e) => {
    if (state.locked || state.activeMenu !== 'user') return;
    isDrawing = true;
    userCanvas.setPointerCapture(e.pointerId);
    const pt = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = state.eraseMode ? '#000000' : state.penColor;
    // 지우개 선택 시 펜 대비 5배 크기 적용
    ctx.lineWidth = state.eraseMode ? state.penSize * 5 : state.penSize;
    ctx.globalCompositeOperation = state.eraseMode ? 'destination-out' : 'source-over';
  });

  userCanvas.addEventListener('pointermove', (e) => {
    if (!isDrawing) return;
    const pt = getPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  });

  const finishStroke = (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    try {
      userCanvas.releasePointerCapture(e.pointerId);
    } catch (_) { }
    if (onStrokeEnd) onStrokeEnd();
  };

  userCanvas.addEventListener('pointerup', finishStroke);
  userCanvas.addEventListener('pointercancel', finishStroke);
  userCanvas.addEventListener('pointerleave', finishStroke);
}
