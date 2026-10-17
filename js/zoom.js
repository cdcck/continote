/**
 * ContiNote - Zoom & Pan Engine (편집 모드 전용 확대/축소 및 이동)
 */

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

export function getZoomScale() {
  return zoomState.scale;
}

export function resetZoom() {
  zoomState.scale = 1;
  zoomState.panX = 0;
  zoomState.panY = 0;
  if (viewerEl) {
    viewerEl.style.overflow = 'hidden';
    viewerEl.scrollLeft = 0;
    viewerEl.scrollTop = 0;
  }
  if (stageEl) {
    stageEl.style.width = '100%';
    stageEl.style.height = '100%';
    stageEl.style.transform = 'none';
  }
  updateZoomUI();
}

export function setZoom(newScale) {
  const prevScale = zoomState.scale;
  const clamped = Math.min(zoomState.maxScale, Math.max(zoomState.minScale, newScale));
  if (clamped === prevScale) return;

  zoomState.scale = clamped;
  if (zoomState.scale === 1) {
    resetZoom();
    return;
  }
  applyStageTransform();
  updateZoomUI();
}

export function applyStageTransform() {
  if (!stageEl || !viewerEl) return;
  const s = zoomState.scale;
  if (s > 1) {
    // PC에서 하단 및 우측 스크롤바가 자연스럽게 동작하도록 뷰어 overflow: auto 설정 및 stage 너비/높이 확장
    viewerEl.style.overflow = 'auto';
    stageEl.style.width = `${viewerEl.clientWidth * s}px`;
    stageEl.style.height = `${viewerEl.clientHeight * s}px`;
    stageEl.style.transform = `scale(${s})`;
    stageEl.style.transformOrigin = '0 0';
  } else {
    viewerEl.style.overflow = 'hidden';
    viewerEl.scrollLeft = 0;
    viewerEl.scrollTop = 0;
    stageEl.style.width = '100%';
    stageEl.style.height = '100%';
    stageEl.style.transform = 'none';
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
    zoomInBtn.addEventListener('click', () => {
      setZoom(zoomState.scale + 0.25);
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      setZoom(zoomState.scale - 0.25);
    });
  }
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      resetZoom();
    });
  }

  // 마우스 휠: Ctrl 키 조합 시 확대/축소, 일반 휠은 자연스러운 상하/좌우 스크롤바 이동 허용
  viewer.addEventListener('wheel', (e) => {
    if (isLockedFn()) return; // 보기 모드에서는 차단
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      setZoom(zoomState.scale + delta);
    }
    // Ctrl이 아닐 때는 viewer의 기본 브라우저 스크롤(상하/좌우)이 동작하도록 e.preventDefault()를 호출하지 않음
  }, { passive: false });

  // 모바일 터치 제스처: 2손가락으로 악보 이동(팬) 및 핀치 줌
  let initialDistance = 0;
  let initialScale = 1;
  let lastTouchMidX = 0, lastTouchMidY = 0;

  viewer.addEventListener('touchstart', (e) => {
    if (isLockedFn()) return;
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      initialDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      initialScale = zoomState.scale;
      lastTouchMidX = (t1.clientX + t2.clientX) / 2;
      lastTouchMidY = (t1.clientY + t2.clientY) / 2;
    }
  }, { passive: true });

  viewer.addEventListener('touchmove', (e) => {
    if (isLockedFn()) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      // 2손가락으로 악보 화면 스크롤 이동
      const dx = midX - lastTouchMidX;
      const dy = midY - lastTouchMidY;
      viewer.scrollLeft -= dx;
      viewer.scrollTop -= dy;
      lastTouchMidX = midX;
      lastTouchMidY = midY;

      // 핀치 줌
      if (initialDistance > 0) {
        const factor = dist / initialDistance;
        const newScale = Math.min(zoomState.maxScale, Math.max(zoomState.minScale, initialScale * factor));
        zoomState.scale = newScale;
        applyStageTransform();
        updateZoomUI();
      }
    }
  }, { passive: false });

  viewer.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      initialDistance = 0;
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
