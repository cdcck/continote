/**
 * ContiNote - Zoom & Pan Engine (인도자 편집 모드 전용 확대/축소 및 드래그 앤 드롭 악보 이동)
 */
import { state } from './state.js';
import { cancelActiveDrawing } from './canvas.js';

export const zoomState = {
  scale: 1,
  panX: 0,
  panY: 0,
  minScale: 1,
  maxScale: 3,
};

let stageEl = null;
let viewerEl = null;
let zoomTextEl = null;
let zoomControlsEl = null;
let isLockedFn = () => true;

// 드래그 앤 드롭 (Pan) 제어 변수
let isPanning = false;
let startPointerX = 0;
let startPointerY = 0;
let initialPanX = 0;
let initialPanY = 0;

export function getZoomScale() {
  return zoomState.scale;
}

export function resetZoom() {
  zoomState.scale = 1;
  zoomState.panX = 0;
  zoomState.panY = 0;
  isPanning = false;
  if (viewerEl) {
    viewerEl.style.overflow = 'hidden';
    viewerEl.style.cursor = '';
  }
  if (stageEl) {
    stageEl.style.transition = 'transform 0.15s ease-out';
    stageEl.style.width = '100%';
    stageEl.style.height = '100%';
    stageEl.style.transform = 'translate3d(0, 0, 0) scale(1)';
    stageEl.style.transformOrigin = '0 0';
  }
  updateZoomUI();
}

/**
 * panX, panY가 화면 밖으로 과도하게 이탈하지 않도록 경계 제한
 */
function clampPan() {
  if (!viewerEl || zoomState.scale <= 1) {
    zoomState.panX = 0;
    zoomState.panY = 0;
    return;
  }

  const vw = viewerEl.clientWidth;
  const vh = viewerEl.clientHeight;
  const s = zoomState.scale;

  const scaledW = vw * s;
  const scaledH = vh * s;

  // 여유 마진 (악보 경계에서 최대 120px 오버팬 허용)
  const margin = 120;
  const minPanX = vw - scaledW - margin;
  const maxPanX = margin;
  const minPanY = vh - scaledH - margin;
  const maxPanY = margin;

  zoomState.panX = Math.min(maxPanX, Math.max(minPanX, zoomState.panX));
  zoomState.panY = Math.min(maxPanY, Math.max(minPanY, zoomState.panY));
}

/**
 * 화면 중심 또는 포컬 포인트 기준 확대/축소
 */
export function setZoom(newScale, focalX = null, focalY = null) {
  const prevScale = zoomState.scale;
  const clamped = Math.min(zoomState.maxScale, Math.max(zoomState.minScale, newScale));
  if (Math.abs(clamped - prevScale) < 0.001) return;

  if (clamped === 1) {
    resetZoom();
    return;
  }

  if (viewerEl) {
    const vw = viewerEl.clientWidth;
    const vh = viewerEl.clientHeight;
    const fx = focalX !== null ? focalX : vw / 2;
    const fy = focalY !== null ? focalY : vh / 2;

    const contentX = (fx - zoomState.panX) / prevScale;
    const contentY = (fy - zoomState.panY) / prevScale;

    zoomState.scale = clamped;
    zoomState.panX = fx - contentX * clamped;
    zoomState.panY = fy - contentY * clamped;
    clampPan();
  } else {
    zoomState.scale = clamped;
  }

  applyStageTransform(true);
  updateZoomUI();
}

export function applyStageTransform(animated = false) {
  if (!stageEl || !viewerEl) return;
  const s = zoomState.scale;
  const px = zoomState.panX;
  const py = zoomState.panY;

  stageEl.style.width = '100%';
  stageEl.style.height = '100%';
  stageEl.style.transformOrigin = '0 0';

  if (s > 1) {
    viewerEl.style.overflow = 'hidden';
    viewerEl.style.cursor = isPanning ? 'grabbing' : 'grab';
    stageEl.style.transition = animated ? 'transform 0.15s ease-out' : 'none';
    stageEl.style.transform = `translate3d(${Math.round(px)}px, ${Math.round(py)}px, 0) scale(${s})`;
  } else {
    viewerEl.style.overflow = 'hidden';
    viewerEl.style.cursor = '';
    stageEl.style.transition = animated ? 'transform 0.15s ease-out' : 'none';
    stageEl.style.transform = 'translate3d(0, 0, 0) scale(1)';
  }
}

function updateZoomUI() {
  if (zoomTextEl) {
    zoomTextEl.textContent = `${Math.round(zoomState.scale * 100)}%`;
  }
}

export function setupZoomAndPan({
  viewer,
  stage,
  zoomControls,
  zoomInBtn,
  zoomOutBtn,
  zoomResetBtn,
  zoomLevelText,
  checkIsLocked
}) {
  viewerEl = viewer;
  stageEl = stage;
  zoomControlsEl = zoomControls;
  zoomTextEl = zoomLevelText;
  isLockedFn = checkIsLocked;

  // 버튼 리스너
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setZoom(zoomState.scale + 0.25);
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setZoom(zoomState.scale - 0.25);
    });
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetZoom();
    });
  }

  // ==========================================
  // 1) 마우스 및 터치 드래그 앤 드롭 이동 (Pan)
  // - window 이벤트 등록으로 캔버스 드래그 유실 완벽 차단
  // ==========================================
  function onPointerMove(e) {
    if (!isPanning) return;
    e.preventDefault();
    const dx = e.clientX - startPointerX;
    const dy = e.clientY - startPointerY;

    zoomState.panX = initialPanX + dx;
    zoomState.panY = initialPanY + dy;
    clampPan();
    applyStageTransform(false);
  }

  function onPointerUp(e) {
    if (!isPanning) return;
    isPanning = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    if (viewerEl) {
      viewerEl.style.cursor = zoomState.scale > 1 ? 'grab' : '';
    }
    applyStageTransform(true);
  }

  function onPointerDown(e) {
    if (isLockedFn()) return;
    if (zoomState.scale <= 1) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // 1) 펜(Apple Pencil, S-Pen 등)은 어떤 경우에도 악보 이동(Pan)에 관여하지 않음 (오직 필기 전용!)
    if (e.pointerType === 'pen') return;

    // 2) 손가락 터치(touch)인 경우:
    //    만약 펜 전용 모드(stylusOnly)가 꺼져 있고 필기 모드(사용자 메뉴)라면,
    //    악보 위에서의 1손가락 터치는 필기로 사용되므로 1손가락 악보 이동은 차단하고 2손가락 제스처로 넘김!
    if (e.pointerType === 'touch') {
      const isDrawingActive = !state.locked && state.activeMenu === 'user' && !state.stylusOnly;
      if (isDrawingActive && e.target.closest('#sheetContainer, #sheetContainerRight')) {
        return;
      }
    }

    // 스티커, 삭제 뱃지, 줌 컨트롤러, 일반 버튼/입력창 클릭 시 악보 이동 방지
    if (e.target.closest('.sticker, .del-badge, #zoomControls, button, a, input, select')) return;

    // 브라우저의 기본 캔버스/이미지 드래그 동작 차단 (가장 중요!)
    e.preventDefault();

    isPanning = true;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    initialPanX = zoomState.panX;
    initialPanY = zoomState.panY;

    if (viewerEl) {
      viewerEl.style.cursor = 'grabbing';
    }

    // 전역 window 리스너 등록으로 포인터 이탈 방지
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    applyStageTransform(false);
  }

  viewer.addEventListener('pointerdown', onPointerDown);

  // 2) 마우스 휠: Ctrl 누르면 줌, 일반 휠은 상하/좌우 드래그 스크롤 이동
  viewer.addEventListener('wheel', (e) => {
    if (isLockedFn()) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = viewer.getBoundingClientRect();
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setZoom(zoomState.scale + delta, focalX, focalY);
    } else if (zoomState.scale > 1) {
      e.preventDefault();
      zoomState.panX -= (e.shiftKey ? e.deltaY : e.deltaX);
      zoomState.panY -= (e.shiftKey ? 0 : e.deltaY);
      clampPan();
      applyStageTransform(false);
    }
  }, { passive: false });

  // 3) 모바일 터치 제스처: 2손가락 핀치 줌 & 2손가락 악보 이동 (Pan)
  let initialDist = 0;
  let initialScale = 1;
  let initialMidX = 0, initialMidY = 0;
  let lastTwoFingerMidX = 0, lastTwoFingerMidY = 0;
  let isTwoFingerPanning = false;

  viewer.addEventListener('touchstart', (e) => {
    if (isLockedFn()) return;
    if (e.touches.length === 2) {
      isPanning = false;
      isTwoFingerPanning = true;
      cancelActiveDrawing(); // 진행 중인 1손가락 필기 즉시 중단 및 잔선 방지

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      initialDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      initialScale = zoomState.scale;

      const rect = viewer.getBoundingClientRect();
      initialMidX = (t1.clientX + t2.clientX) / 2 - rect.left;
      initialMidY = (t1.clientY + t2.clientY) / 2 - rect.top;

      lastTwoFingerMidX = (t1.clientX + t2.clientX) / 2;
      lastTwoFingerMidY = (t1.clientY + t2.clientY) / 2;
    }
  }, { passive: true });

  viewer.addEventListener('touchmove', (e) => {
    if (isLockedFn()) return;
    if (e.touches.length === 2 && isTwoFingerPanning) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const currentMidX = (t1.clientX + t2.clientX) / 2;
      const currentMidY = (t1.clientY + t2.clientY) / 2;
      const dx = currentMidX - lastTwoFingerMidX;
      const dy = currentMidY - lastTwoFingerMidY;

      // 1. 두 손가락 드래그로 화면 이동 (Pan)
      if (zoomState.scale > 1) {
        zoomState.panX += dx;
        zoomState.panY += dy;
        clampPan();
      }

      lastTwoFingerMidX = currentMidX;
      lastTwoFingerMidY = currentMidY;

      // 2. 두 손가락 거리 변화로 핀치 줌 (Scale)
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (initialDist > 0 && Math.abs(dist - initialDist) > 10) {
        const factor = dist / initialDist;
        const newScale = Math.min(zoomState.maxScale, Math.max(zoomState.minScale, initialScale * factor));
        setZoom(newScale, initialMidX, initialMidY);
      } else {
        applyStageTransform(false);
      }
    }
  }, { passive: false });

  viewer.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      initialDist = 0;
      isTwoFingerPanning = false;
      if (zoomState.scale > 1) {
        applyStageTransform(true);
      }
    }
  }, { passive: true });
}

export function updateZoomVisibility(isLocked) {
  if (!zoomControlsEl) return;
  if (isLocked) {
    zoomControlsEl.style.display = 'none';
    resetZoom();
  } else {
    zoomControlsEl.style.display = 'flex';
  }
}
