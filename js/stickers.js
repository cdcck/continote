/**
 * ContiNote - Sticker DOM Layer & Drag System
 */

import { state } from './state.js';
import { saveStickers } from './db.js';

export function renderStickerLayer(stickerLayer, viewer, songId) {
  if (!stickerLayer) return;
  stickerLayer.innerHTML = '';
  if (!songId) return;

  const list = state.stickersBySong[songId] || [];
  list.forEach(item => {
    stickerLayer.appendChild(createStickerElement(songId, item, viewer));
  });
}

export function createStickerElement(songId, item, viewer) {
  const el = document.createElement('div');
  const isSongform = item.type === 'songform';
  const isChord = item.type === 'chord';
  const isI = item.label === 'I';
  const isBis = item.label === 'bis';
  const typeClass = isSongform ? 'songform' : (isChord ? 'chord' : 'text-memo');
  el.className = `sticker ${typeClass} ${isI ? 'part-serif-i' : ''} ${isBis ? 'part-bis' : ''}`;
  el.style.left = item.x + '%';
  el.style.top = item.y + '%';
  el.textContent = item.label;

  let isPointerDown = false;
  let dragging = false;
  let moved = false;
  let longPressed = false;
  let startX = 0, startY = 0;
  let longPressTimer = null;

  el.addEventListener('pointerdown', (e) => {
    if (state.locked) return;
    // 삭제 뱃지(×) 클릭 시 부모 스티커의 드래그나 캡처 이벤트 방지
    if (e.target.closest('.del-badge')) return;

    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    isPointerDown = true;
    longPressed = false;
    try {
      el.setPointerCapture(e.pointerId);
    } catch (_) {}
    startX = e.clientX;
    startY = e.clientY;
    moved = false;
    longPressTimer = setTimeout(() => {
      if (!moved && isPointerDown) {
        longPressed = true;
        showStickerDeleteBadge(el, songId, item);
      }
    }, 450);
  });

  // PC 우클릭 시 즉시 삭제 뱃지 토글
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showStickerDeleteBadge(el, songId, item);
  });

  el.addEventListener('pointermove', (e) => {
    // 마우스 버튼을 누르고 있지 않거나(호버 상태), 보기 모드일 때는 절대 이동 방지
    if (state.locked || !isPointerDown) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > 5) {
      moved = true;
      dragging = true;
      clearTimeout(longPressTimer);
      removeStickerDeleteBadge(el);
    }
    if (!dragging || !viewer) return;
    const container = el.parentElement || viewer;
    const rect = container.getBoundingClientRect();
    const nx = Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width) * 100));
    const ny = Math.min(98, Math.max(2, ((e.clientY - rect.top) / rect.height) * 100));
    el.style.left = nx + '%';
    el.style.top = ny + '%';
    item.x = Math.round(nx * 10) / 10;
    item.y = Math.round(ny * 10) / 10;
  });

  const endHandler = (e) => {
    if (e.target.closest('.del-badge')) return;
    isPointerDown = false;
    clearTimeout(longPressTimer);
    if (dragging) {
      dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (_) { }
      saveStickers(songId);
    } else if (!moved && !longPressed) {
      // 롱프레스가 아닌 일반 탭/클릭 시 삭제 뱃지 토글
      if (el.querySelector('.del-badge')) {
        removeStickerDeleteBadge(el);
      } else {
        showStickerDeleteBadge(el, songId, item);
      }
    }
    longPressed = false;
  };

  el.addEventListener('pointerup', endHandler);
  el.addEventListener('pointercancel', endHandler);
  return el;
}

export function showStickerDeleteBadge(el, songId, item) {
  removeStickerDeleteBadge(el);
  const badge = document.createElement('button');
  badge.className = 'del-badge';
  badge.textContent = '×';
  badge.title = '스티커 삭제';

  const deleteAction = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const list = state.stickersBySong[songId] || [];
    const idx = list.findIndex(s => s.id === item.id);
    if (idx !== -1) {
      list.splice(idx, 1);
      saveStickers(songId);
    }
    el.remove();
  };

  // 포인터 이벤트 버블링 차단 및 터치/클릭 즉시 삭제 처리
  badge.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  badge.addEventListener('pointerup', deleteAction);
  badge.addEventListener('click', deleteAction);

  el.appendChild(badge);
}

export function removeStickerDeleteBadge(el) {
  const b = el.querySelector('.del-badge');
  if (b) b.remove();
}

// 화면 빈 영역 클릭 시 열려있는 삭제 뱃지 닫기
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.sticker')) {
      document.querySelectorAll('.del-badge').forEach(b => b.remove());
    }
  });
}
