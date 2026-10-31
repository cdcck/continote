const SUPERSCRIPT_MAP = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
};

export function formatChordHtml(rawText) {
  if (!rawText) return '';
  const escaped = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  return escaped.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (match) => {
    const normalDigits = match.split('').map(ch => SUPERSCRIPT_MAP[ch] || ch).join('');
    return `<span class="chord-sup">${normalDigits}</span>`;
  });
}

/**
 * ContiNote - Sticker DOM Layer & Drag System
 */

import { state } from './state.js';
import { saveStickers } from './db.js';
import { debounceSyncContiDetail, debounceSyncLibraryToDrive } from './drive.js';

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
  const isTextMemo = item.type === 'text';
  const isI = item.label === 'I';
  const isBis = item.label === 'bis';
  const typeClass = isSongform ? 'songform' : (isChord ? 'chord' : 'text-memo');
  el.className = `sticker ${typeClass} ${isI ? 'part-serif-i' : ''} ${isBis ? 'part-bis' : ''}`;
  el.style.left = item.x + '%';
  el.style.top = item.y + '%';
  if (isChord) {
    el.innerHTML = formatChordHtml(item.label);
  } else {
    el.textContent = item.label;
  }

  let isPointerDown = false;
  let dragging = false;
  let moved = false;
  let longPressed = false;
  let startX = 0, startY = 0;
  let longPressTimer = null;

  el.addEventListener('pointerdown', (e) => {
    if (state.locked) return;
    // 툴팁 또는 삭제 뱃지(×) 클릭 시 부모 스티커의 드래그나 캡처 이벤트 방지
    if (e.target.closest('.del-badge, .text-memo-tooltip')) return;

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
        if (isTextMemo) {
          deselectAllTextMemos();
          el.classList.add('selected');
          showTextMemoTooltip(el, songId, item);
        } else {
          showStickerDeleteBadge(el, songId, item);
        }
      }
    }, 400);
  });

  // PC 우클릭 시 즉시 툴팁 / 삭제 뱃지 토글
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (state.locked) return;
    if (isTextMemo) {
      if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        removeTextMemoTooltip(el);
      } else {
        deselectAllTextMemos();
        el.classList.add('selected');
        showTextMemoTooltip(el, songId, item);
      }
    } else {
      showStickerDeleteBadge(el, songId, item);
    }
  });

  el.addEventListener('pointermove', (e) => {
    if (state.locked || !isPointerDown) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > 5) {
      moved = true;
      dragging = true;
      clearTimeout(longPressTimer);
      if (isTextMemo) {
        removeTextMemoTooltip(el);
      } else {
        removeStickerDeleteBadge(el);
      }
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
    if (e.target.closest('.del-badge, .text-memo-tooltip')) return;
    isPointerDown = false;
    clearTimeout(longPressTimer);
    if (dragging) {
      dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (_) { }
      saveStickers(songId);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('continote:viewer-dirty'));
      if (state.viewerReturnView === 'songLibrary') {
        debounceSyncLibraryToDrive();
      } else if (state.currentContiId) {
        debounceSyncContiDetail(state.currentContiId);
      }
    } else if (!moved && !longPressed) {
      if (isTextMemo) {
        // 텍스트 메모인 경우: 탭 시 선택/해제 토글 및 플로팅 툴팁(수정/삭제) 노출
        if (el.classList.contains('selected')) {
          el.classList.remove('selected');
          removeTextMemoTooltip(el);
        } else {
          deselectAllTextMemos();
          document.querySelectorAll('.del-badge').forEach(b => b.remove());
          el.classList.add('selected');
          showTextMemoTooltip(el, songId, item);
        }
      } else {
        // 송폼 칩 또는 코드 스티커인 경우: 삭제 뱃지 토글
        if (el.querySelector('.del-badge')) {
          removeStickerDeleteBadge(el);
        } else {
          showStickerDeleteBadge(el, songId, item);
        }
      }
    }
    longPressed = false;
  };

  el.addEventListener('pointerup', endHandler);
  el.addEventListener('pointercancel', endHandler);

  // 텍스트 메모 더블 탭(더블 클릭) 시 즉시 수정 모달 오픈
  if (isTextMemo) {
    el.addEventListener('dblclick', (e) => {
      if (state.locked) return;
      e.preventDefault();
      e.stopPropagation();
      deselectAllTextMemos();
      window.dispatchEvent(new CustomEvent('continote:edit-textmemo', { detail: { songId, item } }));
    });
  }

  return el;
}

export function showTextMemoTooltip(el, songId, item) {
  removeTextMemoTooltip(el);
  const tooltip = document.createElement('div');
  tooltip.className = 'text-memo-tooltip';

  // 악보 최상단 근처(Y < 9%)에 배치된 경우 화면 밖으로 벗어나지 않게 아래쪽에 표시
  if (item.y < 9) {
    tooltip.style.bottom = 'auto';
    tooltip.style.top = 'calc(100% + 6px)';
  }

  // 1. 수정 버튼 (모바일: 아이콘만 / PC·태블릿: 아이콘 + 텍스트)
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'tooltip-btn-edit px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all';
  editBtn.style.backgroundColor = 'var(--surface-2)';
  editBtn.style.color = 'var(--text)';
  editBtn.title = '텍스트 수정';
  editBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
    <span class="hidden sm:inline">수정</span>
  `;
  editBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deselectAllTextMemos();
    window.dispatchEvent(new CustomEvent('continote:edit-textmemo', { detail: { songId, item } }));
  });

  // 2. 삭제 버튼 (모바일: 아이콘만 / PC·태블릿: 아이콘 + 텍스트)
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'tooltip-btn-delete px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all text-red-500 hover:bg-red-500/10';
  delBtn.title = '텍스트 삭제';
  delBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0">
      <path d="M3 6h18"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
    <span class="hidden sm:inline">삭제</span>
  `;
  delBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  delBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteStickerItem(songId, item, el);
  });

  tooltip.appendChild(editBtn);
  tooltip.appendChild(delBtn);
  el.appendChild(tooltip);
}

export function removeTextMemoTooltip(el) {
  if (!el) return;
  const t = el.querySelector('.text-memo-tooltip');
  if (t) t.remove();
}

export function deselectAllTextMemos() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.sticker.text-memo.selected').forEach(el => {
    el.classList.remove('selected');
    removeTextMemoTooltip(el);
  });
}

export function deleteStickerItem(songId, item, el) {
  const list = state.stickersBySong[songId] || [];
  const idx = list.findIndex(s => s.id === item.id);
  if (idx !== -1) {
    list.splice(idx, 1);
    saveStickers(songId);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('continote:viewer-dirty'));
    if (state.viewerReturnView === 'songLibrary') {
      debounceSyncLibraryToDrive();
    } else if (state.currentContiId) {
      debounceSyncContiDetail(state.currentContiId);
    }
  }
  if (el) el.remove();
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
    deleteStickerItem(songId, item, el);
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

// 화면 빈 영역 클릭 시 열려있는 삭제 뱃지 및 텍스트 툴팁 닫기 (선택 해제)
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.sticker')) {
      document.querySelectorAll('.del-badge').forEach(b => b.remove());
      deselectAllTextMemos();
    }
  });
}
