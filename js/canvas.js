/**
 * ContiNote - 3-Layer Canvas Engine & Drawing System (악보 1:1 밀착형)
 */

import { state } from './state.js';
import { idbGet } from './db.js';

export let currentSheetRect = { x: 0, y: 0, w: 0, h: 0 };

export function clearCanvases(sheetContainer, baseCanvas, userCanvas) {
  if (baseCanvas) {
    baseCanvas.style.opacity = '1';
    baseCanvas._lastRenderKey = null;
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

    const areaX = bounds ? bounds.x : 0;
    const areaY = bounds ? bounds.y : 0;
    let areaW = bounds ? bounds.w : viewer.clientWidth;
    let areaH = bounds ? bounds.h : viewer.clientHeight;

    const isDark = document.documentElement.classList.contains('dark');
    // 스마트 가드: 동일 곡 및 동일 크기/테마일 때 불필요한 캔버스 리페인팅 원천 차단 (깜빡임 0ms)
    // 단, 캔버스가 비워졌거나(너비/높이 0), 슬롯이 숨겨졌던 경우에는 안전하게 리페인트 수행
    const renderKey = `${song.id}_${song.isLeadSheet ? (song.content || '') : (song.image ? song.image.length : '')}_${areaW}x${areaH}_${isDark ? 'd' : 'l'}`;
    if (baseCanvas._lastRenderKey === renderKey && baseCanvas.width > 0 && baseCanvas.height > 0 && sheetContainer.clientWidth > 0 && sheetContainer.style.display !== 'none') {
      return resolve();
    }

    const finishRender = () => {
      baseCanvas._lastRenderKey = renderKey;
      resolve();
    };

    // [인도자 전용 리드 시트] 악보 이미지가 없는 깨끗한 노트 용지 렌더링
    if (song.isLeadSheet) {
      baseCanvas.classList.add('leadsheet-canvas');
      if (areaW <= 0 || areaH <= 0) {
        finishRender();
        return;
      }

      // 악보 영역 전체(1곡 모드: 화면 전체 / 2곡 모드: 해당 슬롯)에 100% 꽉 차게 밀착
      const dw = areaW;
      const dh = areaH;
      const dx = areaX;
      const dy = areaY;

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

      ctx.fillStyle = isDark ? '#18181B' : '#FAFAFA';
      ctx.fillRect(0, 0, dw, dh);

      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, dw - 1, dh - 1);

      const sheetScaleRatio = Math.max(0.8, dw / 380);
      sheetContainer.style.setProperty('--sheet-scale', sheetScaleRatio.toFixed(3));
      finishRender();
      return;
    }

    // 일반 악보 렌더링
    baseCanvas.classList.remove('leadsheet-canvas');

    const img = new Image();
    img.onload = () => {
      if (areaW <= 0 || areaH <= 0) {
        requestAnimationFrame(() => {
          const retryW = bounds ? bounds.w : viewer.clientWidth;
          const retryH = bounds ? bounds.h : viewer.clientHeight;
          if (retryW > 0 && retryH > 0) {
            renderBaseSheet(viewer, sheetContainer, baseCanvas, song, bounds).then(resolve);
          } else {
            finishRender();
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

      sheetContainer.style.left = `${dx}px`;
      sheetContainer.style.top = `${dy}px`;
      sheetContainer.style.width = `${dw}px`;
      sheetContainer.style.height = `${dh}px`;

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

      finishRender();
    };
    img.onerror = () => {
      finishRender();
    };
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


// ==========================================
// [캔버스 실행 취소 / 다시 실행 (Undo / Redo) 히스토리 엔진]
// ==========================================
const historyByCanvas = new WeakMap();

export function getCanvasHistory(canvas) {
  if (!canvas) return null;
  if (!historyByCanvas.has(canvas)) {
    historyByCanvas.set(canvas, {
      undoStack: [],
      redoStack: [],
      maxDepth: 30
    });
  }
  return historyByCanvas.get(canvas);
}

export function pushCanvasSnapshot(canvas) {
  if (!canvas) return;
  const history = getCanvasHistory(canvas);
  if (!history) return;
  const ctx = canvas.getContext('2d');
  const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  history.undoStack.push(snapshot);
  if (history.undoStack.length > history.maxDepth) {
    history.undoStack.shift();
  }
  history.redoStack = [];
}

export function undoDrawing(canvas) {
  if (!canvas) return false;
  const history = getCanvasHistory(canvas);
  if (!history || !history.undoStack.length) return false;
  const ctx = canvas.getContext('2d');
  const currentSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  history.redoStack.push(currentSnapshot);
  const prevSnapshot = history.undoStack.pop();
  ctx.putImageData(prevSnapshot, 0, 0);
  return true;
}

export function redoDrawing(canvas) {
  if (!canvas) return false;
  const history = getCanvasHistory(canvas);
  if (!history || !history.redoStack.length) return false;
  const ctx = canvas.getContext('2d');
  const currentSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  history.undoStack.push(currentSnapshot);
  const nextSnapshot = history.redoStack.pop();
  ctx.putImageData(nextSnapshot, 0, 0);
  return true;
}

export function canUndo(canvas) {
  if (!canvas) return false;
  const history = getCanvasHistory(canvas);
  return Boolean(history && history.undoStack.length > 0);
}

export function canRedo(canvas) {
  if (!canvas) return false;
  const history = getCanvasHistory(canvas);
  return Boolean(history && history.redoStack.length > 0);
}

export function resetDrawingHistory(canvas) {
  if (!canvas) return;
  const history = getCanvasHistory(canvas);
  if (history) {
    history.undoStack = [];
    history.redoStack = [];
  }
}


let eraserRingEl = null;
let lastRingPos = null;

export function updateEraserCursorRing(e, isHover = true) {
  if (!eraserRingEl) {
    eraserRingEl = document.getElementById('eraserCursorRing');
  }
  if (!eraserRingEl) return;

  if (!state.eraseMode || state.locked || state.activeMenu !== 'user' || !isHover) {
    eraserRingEl.style.display = 'none';
    lastRingPos = null;
    return;
  }

  const viewer = document.getElementById('viewer');
  if (!viewer) return;

  if (e && typeof e.clientX === 'number') {
    const vRect = viewer.getBoundingClientRect();
    const x = e.clientX - vRect.left;
    const y = e.clientY - vRect.top;
    if (x < -20 || y < -20 || x > vRect.width + 20 || y > vRect.height + 20) {
      eraserRingEl.style.display = 'none';
      lastRingPos = null;
      return;
    }
    lastRingPos = { x, y };
  }

  if (!lastRingPos) {
    eraserRingEl.style.display = 'none';
    return;
  }

  const zoomScale = (typeof window !== 'undefined' && window.__continoteGetZoomScale) ? window.__continoteGetZoomScale() : 1;
  const d = Math.max(5, Math.round((state.eraserThickness || 15) * zoomScale));

  eraserRingEl.style.left = `${lastRingPos.x}px`;
  eraserRingEl.style.top = `${lastRingPos.y}px`;
  eraserRingEl.style.width = `${d}px`;
  eraserRingEl.style.height = `${d}px`;
  eraserRingEl.style.display = 'block';
}

const activeCancelFns = [];

export function cancelActiveDrawing() {
  activeCancelFns.forEach(fn => {
    try { fn(); } catch (_) {}
  });
}

export function setupDrawingSystem(userCanvas, onStrokeEnd) {
  if (!userCanvas) return;
  const ctx = userCanvas.getContext('2d');
  let isDrawing = false;
  let activePointerId = null;

  const cancelStroke = () => {
    if (!isDrawing) return;
    isDrawing = false;
    try {
      if (activePointerId !== null) {
        userCanvas.releasePointerCapture(activePointerId);
      }
    } catch (_) {}
    activePointerId = null;
  };
  activeCancelFns.push(cancelStroke);

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
      return; // 손가락 터치는 필기하지 않고 버블링되어 줌 이동(Pan)으로 넘김!
    }

    // 펜(pen), 마우스(mouse), 또는 stylusOnly=false일 때 손가락(touch)은 "필기"로 확정!
    // 확대 상태에서 악보 이동(Pan)으로 버블링되는 것을 확실히 차단!
    e.stopPropagation();

    isDrawing = true;
    activePointerId = e.pointerId;
    try {
      userCanvas.setPointerCapture(e.pointerId);
    } catch (_) {}

    // [실행 취소 스냅샷 저장] 스트로크 시작 직전 현재 캔버스 상태 캡처
    pushCanvasSnapshot(userCanvas);

    const pt = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = state.eraseMode ? '#000000' : state.penColor;
    // 펜과 지우개의 독립 기억된 두께 게이지 적용
    const strokeWidth = state.eraseMode ? (state.eraserThickness || 15) : (state.penThickness || 3);
    ctx.lineWidth = strokeWidth;
    ctx.globalCompositeOperation = state.eraseMode ? 'destination-out' : 'source-over';
  });

  userCanvas.addEventListener('pointerenter', (e) => {
    if (state.eraseMode && (e.pointerType === 'pen' || e.pointerType === 'mouse')) {
      updateEraserCursorRing(e, true);
    }
  });

  userCanvas.addEventListener('pointermove', (e) => {
    // 1. 지우개 모드 시 실시간 원형 가이드 링 위치 추적 (스타일러스 펜 호버 & PC 마우스)
    if (state.eraseMode) {
      if (e.pointerType === 'pen' || e.pointerType === 'mouse' || isDrawing) {
        updateEraserCursorRing(e, true);
      }
    }

    if (!isDrawing) return;
    e.stopPropagation();
    const pt = getPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  });

  const finishStroke = (e) => {
    if (e && e.pointerType === 'touch') {
      updateEraserCursorRing(null, false);
    }
    if (!isDrawing) return;
    isDrawing = false;
    try {
      userCanvas.releasePointerCapture(e.pointerId);
    } catch (_) { }
    activePointerId = null;
    if (onStrokeEnd) onStrokeEnd();
  };

  userCanvas.addEventListener('pointerup', finishStroke);
  userCanvas.addEventListener('pointercancel', (e) => {
    updateEraserCursorRing(null, false);
    finishStroke(e);
  });
  userCanvas.addEventListener('pointerleave', (e) => {
    updateEraserCursorRing(null, false);
    finishStroke(e);
  });
}
