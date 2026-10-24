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

export function renderBaseSheet(viewer, sheetContainer, baseCanvas, song, bounds = null) {
  return new Promise((resolve) => {
    if (!song || !baseCanvas || !viewer || !sheetContainer) return resolve();

    // [인도자 전용 리드 시트] 악보 이미지가 없는 깨끗한 노트 용지 렌더링
    if (song.isLeadSheet) {
      baseCanvas.classList.add('leadsheet-canvas');
      const areaX = bounds ? bounds.x : 0;
      const areaY = bounds ? bounds.y : 0;
      let areaW = bounds ? bounds.w : viewer.clientWidth;
      let areaH = bounds ? bounds.h : viewer.clientHeight;
      if (areaW <= 0 || areaH <= 0) return resolve();

      const targetAspect = 3 / 4;
      const dw = Math.floor(Math.min(areaW * 0.96, areaH * targetAspect));
      const dh = Math.floor(dw / targetAspect);
      const dx = areaX + Math.floor((areaW - dw) / 2);
      const dy = areaY + Math.max(0, Math.floor((areaH - dh) / 2));

      currentSheetRect = { x: dx, y: dy, w: dw, h: dh };
      sheetContainer.style.left = `${dx}px`;
      sheetContainer.style.top = `${dy}px`;
      sheetContainer.style.width = `${dw}px`;
      sheetContainer.style.height = `${dh}px`;

      const dpr = window.devicePixelRatio || 1;
      baseCanvas.width = dw * dpr;
      baseCanvas.height = dh * dpr;
      baseCanvas.style.width = `${dw}px`;
      baseCanvas.style.height = `${dh}px`;

      const ctx = baseCanvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const isDark = document.documentElement.classList.contains('dark');
      ctx.fillStyle = isDark ? '#18181B' : '#FAFAFA';
      ctx.fillRect(0, 0, dw, dh);

      // [제안 2: 노션 & 애플 클린 미니멀] 촌스러운 줄눈/누런 띠 완전 제거, 단정하고 매끄러운 1px 외곽선
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, dw - 1, dh - 1);

      const sheetScaleRatio = Math.max(0.8, dw / 380);
      sheetContainer.style.setProperty('--sheet-scale', sheetScaleRatio.toFixed(3));
      return resolve();
    }

    baseCanvas.classList.remove('leadsheet-canvas');

    const img = new Image();
    img.onload = () => {
      const areaX = bounds ? bounds.x : 0;
      const areaY = bounds ? bounds.y : 0;
      let areaW = bounds ? bounds.w : viewer.clientWidth;
      let areaH = bounds ? bounds.h : viewer.clientHeight;
      if (areaW <= 0 || areaH <= 0) {
        // 메뉴 전환 직후 아직 layout reflow 중인 경우 다음 프레임에서 1회 재측정 렌더링
        requestAnimationFrame(() => {
          const retryW = bounds ? bounds.w : viewer.clientWidth;
          const retryH = bounds ? bounds.h : viewer.clientHeight;
          if (retryW > 0 && retryH > 0) {
            renderBaseSheet(viewer, sheetContainer, baseCanvas, song, bounds).then(resolve);
          } else {
            resolve();
          }
        });
        return;
      }

      // 악보 종횡비 유지 계산 (가로는 지정 영역 가운데 정렬, 세로는 상단 여백 없이 위로 밀착)
      const scale = Math.min(areaW / img.width, areaH / img.height);
      const dw = Math.floor(img.width * scale);
      const dh = Math.floor(img.height * scale);
      const dx = areaX + Math.floor((areaW - dw) / 2);
      const dy = areaY; // 악보 위에 여백을 없애고 위로 딱 밀착

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
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, dw, dh);
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
    // [Palm Rejection: 펜 전용 모드] 손바닥/손가락 터치(touch) 필기 원천 차단 (오직 pen 및 PC mouse만 허용)
    if (state.stylusOnly && e.pointerType === 'touch') {
      return;
    }
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
