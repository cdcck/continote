/**
 * ContiNote - Google Drive 2-Stage Lazy Sync Service
 * 1단계: 콘티 메타데이터 목록(contis_index.json) 선행 동기화 (가벼움, 즉시 로딩)
 * 2단계: 특정 콘티 진입 시 해당 콘티 상세 및 악보(conti_{id}.json) 지연 동기화
 */

import { state } from './state.js';
import { getDB, idbGet, idbPut, idbGetAll } from './db.js';

const DRIVE_FOLDER_NAME = 'Continote';
const INDEX_FILE_NAME = 'contis_index.json';
const TOKEN_STORAGE_KEY = 'continote_gdrive_token';

let cachedFolderId = null;
let syncToastTimeout = null;

// 토큰 관리
export function setDriveAccessToken(token) {
  if (token) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getDriveAccessToken() {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY) || null;
}

export function hasDriveAuth() {
  return Boolean(getDriveAccessToken());
}

// 상단 미니멀 동기화 상태 토스트 알림
export function showSyncToast(message, type = 'loading') {
  let toast = document.getElementById('driveSyncToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'driveSyncToast';
    toast.className = 'fixed top-3 left-1/2 -translate-x-1/2 z-[100] px-3.5 py-1.5 rounded-full shadow-lg border text-xs font-semibold flex items-center gap-2 pointer-events-none transition-all duration-300 opacity-0 -translate-y-4';
    toast.style.background = 'var(--surface)';
    toast.style.borderColor = 'var(--border)';
    toast.style.color = 'var(--text)';
    document.body.appendChild(toast);
  }

  clearTimeout(syncToastTimeout);

  let icon = '';
  if (type === 'loading') {
    icon = `<svg class="animate-spin w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="32" stroke-linecap="round"/></svg>`;
  } else if (type === 'success') {
    icon = `<svg class="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>`;
  } else if (type === 'error') {
    icon = `<svg class="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>`;
  }

  toast.innerHTML = `${icon}<span>${message}</span>`;
  toast.classList.remove('opacity-0', '-translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');

  if (type !== 'loading') {
    syncToastTimeout = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', '-translate-y-4');
    }, 2000);
  }
}

export function hideSyncToast() {
  const toast = document.getElementById('driveSyncToast');
  if (toast) {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', '-translate-y-4');
  }
}

// Google Drive API 요청 래퍼
async function driveApi(endpoint, options = {}) {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Google Drive access token is not set');

  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };

  const res = await fetch(endpoint, { ...options, headers });
  if (res.status === 401) {
    // 토큰 만료
    setDriveAccessToken(null);
    throw new Error('Google Drive token expired');
  }
  return res;
}

// Continote 앱 전용 폴더 찾기 또는 생성
export async function getOrCreateContinoteFolder() {
  if (cachedFolderId) return cachedFolderId;

  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${DRIVE_FOLDER_NAME}' and trashed = false`);
  const res = await driveApi(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`);
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    cachedFolderId = data.files[0].id;
    return cachedFolderId;
  }

  // 폴더가 없으면 생성
  const createRes = await driveApi('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  const newFolder = await createRes.json();
  cachedFolderId = newFolder.id;
  return cachedFolderId;
}

// 폴더 내 특정 파일 검색
async function findFileInAppFolder(fileName) {
  const folderId = await getOrCreateContinoteFolder();
  const query = encodeURIComponent(`name = '${fileName}' and '${folderId}' in parents and trashed = false`);
  const res = await driveApi(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`);
  const data = await res.json();
  return (data.files && data.files.length > 0) ? data.files[0] : null;
}

// JSON 파일 업로드 / 덮어쓰기
async function uploadJsonFile(fileName, jsonData) {
  const folderId = await getOrCreateContinoteFolder();
  const existingFile = await findFileInAppFolder(fileName);
  const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });

  if (existingFile) {
    // 기존 파일 내용 업데이트 (PATCH)
    const updateRes = await driveApi(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBlob
    });
    return await updateRes.json();
  } else {
    // 신규 파일 생성 (Multipart POST)
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/json'
    };

    const boundary = 'continote_sync_boundary_' + Date.now();
    const delimiter = `--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metaPart = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const dataPart = `Content-Type: application/json\r\n\r\n${JSON.stringify(jsonData, null, 2)}\r\n`;

    const multipartBody = delimiter + metaPart + delimiter + dataPart + closeDelimiter;

    const createRes = await driveApi('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });
    return await createRes.json();
  }
}

// JSON 파일 다운로드
async function downloadJsonFile(fileId) {
  const res = await driveApi(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  return await res.json();
}

/* ==================================================
   [1단계] 콘티 목록 메타데이터 동기화 (contis_index.json)
   ================================================== */
export async function syncContisIndexFromDrive() {
  if (!hasDriveAuth()) return state.contis;

  try {
    showSyncToast('콘티 목록 동기화 중...', 'loading');
    const indexFile = await findFileInAppFolder(INDEX_FILE_NAME);

    if (!indexFile) {
      // 드라이브에 아직 index가 없으면 현재 로컬 콘티 목록을 드라이브로 최초 업로드
      await syncContisIndexToDrive(state.contis, false);
      showSyncToast('콘티 목록 동기화 완료', 'success');
      return state.contis;
    }

    const driveIndex = await downloadJsonFile(indexFile.id);
    if (!Array.isArray(driveIndex)) return state.contis;

    // 로컬과 Drive 콘티 목록 병합 (Drive 최신 반영)
    const localContis = await idbGetAll('contis');
    const localMap = new Map(localContis.map(c => [c.id, c]));

    driveIndex.forEach(remote => {
      const local = localMap.get(remote.id);
      if (!local) {
        // 드라이브에만 있는 콘티는 메타데이터로 로컬에 추가 (상세 songs는 2단계 진입 시 로드)
        const newConti = {
          id: remote.id,
          title: remote.title || '새 콘티',
          date: remote.date || new Date().toISOString().slice(0, 10),
          memo: remote.memo || '',
          authorEmail: remote.authorEmail || 'leader@continote.com',
          authorName: remote.authorName || '인도자',
          sharedWith: remote.sharedWith || [],
          songs: [], // 지연 로딩 대상
          songCount: remote.songCount || 0,
          createdAt: remote.createdAt || Date.now(),
          updatedAt: remote.updatedAt || Date.now(),
          _needDetailSync: true // 2단계 동기화 필요 플래그
        };
        localMap.set(remote.id, newConti);
      } else {
        // 메타데이터 업데이트
        local.title = remote.title || local.title;
        local.date = remote.date || local.date;
        local.memo = remote.memo ?? local.memo;
        local.songCount = remote.songCount ?? (local.songs ? local.songs.length : 0);
        local.updatedAt = remote.updatedAt || local.updatedAt;
        if (remote.updatedAt && local.updatedAt && remote.updatedAt > local.updatedAt) {
          local._needDetailSync = true;
        }
      }
    });

    state.contis = Array.from(localMap.values());
    state.contis.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // 로컬 DB 갱신
    for (const c of state.contis) {
      await idbPut('contis', c);
    }

    showSyncToast('콘티 목록 동기화 완료', 'success');
    return state.contis;
  } catch (err) {
    console.warn('콘티 목록 Drive 동기화 실패:', err);
    showSyncToast('동기화 실패 (오프라인 모드)', 'error');
    return state.contis;
  }
}

export async function syncContisIndexToDrive(contisList, showToast = true) {
  if (!hasDriveAuth()) return;
  try {
    if (showToast) showSyncToast('콘티 목록 백업 중...', 'loading');
    const indexData = (contisList || state.contis).map(c => ({
      id: c.id,
      title: c.title || '새 콘티',
      date: c.date || '',
      memo: c.memo || '',
      authorEmail: c.authorEmail || 'leader@continote.com',
      authorName: c.authorName || '인도자',
      sharedWith: c.sharedWith || [],
      songCount: (c.songs && c.songs.length) || c.songCount || 0,
      createdAt: c.createdAt || Date.now(),
      updatedAt: c.updatedAt || Date.now()
    }));

    await uploadJsonFile(INDEX_FILE_NAME, indexData);
    if (showToast) showSyncToast('콘티 목록 백업 완료', 'success');
  } catch (err) {
    console.warn('Drive 콘티 목록 업로드 실패:', err);
  }
}

/* ==================================================
   [2단계] 특정 콘티 상세 및 악보 지연 동기화 (conti_{id}.json)
   ================================================== */
export async function syncContiDetailFromDrive(contiId) {
  if (!hasDriveAuth() || !contiId) return null;

  const conti = state.contis.find(c => c.id === contiId);
  // 이미 로컬에 곡이 존재하고 추가 동기화 플래그가 없으면 즉시 반환 (불필요한 네트워크 절약)
  if (conti && conti.songs && conti.songs.length > 0 && !conti._needDetailSync) {
    return conti;
  }

  try {
    showSyncToast('악보 데이터 동기화 중...', 'loading');
    const fileName = `conti_${contiId}.json`;
    const detailFile = await findFileInAppFolder(fileName);

    if (!detailFile) {
      // 드라이브에 아직 상세 파일이 없으면 (로컬 생성 직후 등) 현재 로컬 데이터를 업로드
      if (conti && conti.songs && conti.songs.length > 0) {
        await syncContiDetailToDrive(contiId, false);
      }
      showSyncToast('악보 동기화 완료', 'success');
      return conti;
    }

    const detailData = await downloadJsonFile(detailFile.id);
    if (!detailData || !detailData.id) return conti;

    if (conti) {
      conti.songs = Array.isArray(detailData.songs) ? detailData.songs : [];
      conti.title = detailData.title || conti.title;
      conti.date = detailData.date || conti.date;
      conti.memo = detailData.memo ?? conti.memo;
      conti._needDetailSync = false;

      // IndexedDB에 콘티 및 곡 저장
      await idbPut('contis', conti);
      for (const s of conti.songs) {
        await idbPut('songs', s);
      }

      // 스티커 및 메모 데이터 동기화
      if (detailData.stickersBySong) {
        Object.assign(state.stickersBySong, detailData.stickersBySong);
        for (const [sId, stList] of Object.entries(detailData.stickersBySong)) {
          await idbPut('stickers', { songId: sId, list: stList });
        }
      }
      if (detailData.notesBySong) {
        for (const [sId, nData] of Object.entries(detailData.notesBySong)) {
          await idbPut('notes', { songId: sId, drawing: nData });
        }
      }
    }

    showSyncToast('악보 동기화 완료', 'success');
    return conti;
  } catch (err) {
    console.warn('콘티 상세 Drive 동기화 실패:', err);
    showSyncToast('오프라인 악보 캐시 로드', 'error');
    return conti;
  }
}

export async function syncContiDetailToDrive(contiId, showToast = true) {
  if (!hasDriveAuth() || !contiId) return;

  try {
    if (showToast) showSyncToast('악보 데이터 백업 중...', 'loading');
    const conti = state.contis.find(c => c.id === contiId);
    if (!conti) return;

    const songs = (state.currentContiId === contiId && state.songs.length) ? state.songs : (conti.songs || []);

    const detailData = {
      id: conti.id,
      title: conti.title || '새 콘티',
      date: conti.date || '',
      memo: conti.memo || '',
      authorEmail: conti.authorEmail || 'leader@continote.com',
      authorName: conti.authorName || '인도자',
      sharedWith: conti.sharedWith || [],
      songs: songs,
      stickersBySong: state.stickersBySong || {},
      updatedAt: Date.now()
    };

    conti.songs = songs;
    conti.updatedAt = detailData.updatedAt;
    conti._needDetailSync = false;

    // 1. 해당 콘티 전용 파일 업로드
    await uploadJsonFile(`conti_${contiId}.json`, detailData);

    // 2. 전체 콘티 목록 index도 함께 갱신
    await syncContisIndexToDrive(state.contis, false);

    if (showToast) showSyncToast('Google Drive 저장 완료', 'success');
  } catch (err) {
    console.warn('콘티 상세 Drive 업로드 실패:', err);
  }
}
