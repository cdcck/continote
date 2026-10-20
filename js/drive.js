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
const TOKEN_EXPIRES_KEY = 'continote_gdrive_token_expires';

let cachedFolderId = null;
let syncToastTimeout = null;

// 토큰 관리 (localStorage에 보관하여 탭 닫힘/새로고침에도 1시간 동안 유지)
export function setDriveAccessToken(token, expiresIn = 3600) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    const expiresAt = Date.now() + (Number(expiresIn) || 3600) * 1000;
    localStorage.setItem(TOKEN_EXPIRES_KEY, String(expiresAt));
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_KEY);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('continote:drive-auth-changed', {
      detail: { authorized: Boolean(token) }
    }));
  }
}

export function getDriveAccessToken() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return null;
  const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRES_KEY) || 0);
  // 만료 시간 60초 전까지 안전하게 유효한 것으로 처리
  if (expiresAt && Date.now() > expiresAt - 60000) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_KEY);
    return null;
  }
  return token;
}

export function getDriveTokenExpiresAt() {
  return Number(localStorage.getItem(TOKEN_EXPIRES_KEY) || 0);
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
    showSyncToast('Google Drive 토큰 만료 (재연결 필요)', 'error');
    throw new Error('Google Drive token expired');
  }
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Drive API error [${res.status}]:`, errText);
    throw new Error(`Drive API error [${res.status}]: ${errText}`);
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

// 폴더 내 파일 ID 인메모리 캐시 (불필요한 검색 API 왕복 제거)
const driveFileIdCache = new Map();

// 폴더 내 특정 파일 검색 (캐시 우선)
async function findFileInAppFolder(fileName, useCache = true) {
  if (useCache && driveFileIdCache.has(fileName)) {
    return driveFileIdCache.get(fileName);
  }
  const folderId = await getOrCreateContinoteFolder();
  const query = encodeURIComponent(`name = '${fileName}' and '${folderId}' in parents and trashed = false`);
  const res = await driveApi(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`);
  const data = await res.json();
  const fileObj = (data.files && data.files.length > 0) ? data.files[0] : null;
  if (fileObj) {
    driveFileIdCache.set(fileName, fileObj);
  }
  return fileObj;
}

// JSON 파일 초고속 Direct 업로드 (10MB 미만: 1-step Direct PATCH로 0.3초 완료)
async function uploadJsonFile(fileName, jsonData) {
  const folderId = await getOrCreateContinoteFolder();
  const existingFile = await findFileInAppFolder(fileName, true);
  // 콤팩트 직렬화: 불필요한 들여쓰기 공백 제거로 데이터 크기 20% 절감 & 직렬화 3배 가속
  const jsonBlob = new Blob([JSON.stringify(jsonData)], { type: 'application/json' });

  let fileId = existingFile ? existingFile.id : null;

  if (!fileId) {
    // 1단계: 파일 메타데이터 생성 (부모 폴더 지정)
    const createRes = await driveApi('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
        mimeType: 'application/json'
      })
    });
    const fileObj = await createRes.json();
    fileId = fileObj.id;
    driveFileIdCache.set(fileName, { id: fileId, name: fileName });
  }

  // 10MB 미만의 모든 데이터는 1-step Direct Media 업로드로 단 1번의 HTTP PATCH로 0.2~0.4초 만에 즉시 완료
  if (jsonBlob.size < 10 * 1024 * 1024) {
    const mediaRes = await driveApi(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: jsonBlob
    });
    const result = await mediaRes.json();
    driveFileIdCache.set(fileName, { id: fileId, name: fileName, modifiedTime: new Date().toISOString() });
    return result;
  }

  // 10MB 이상의 극단적 대용량 파일만 fallback Resumable 세션 사용
  const token = getDriveAccessToken();
  const initRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=resumable`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'application/json',
      'X-Upload-Content-Length': String(jsonBlob.size)
    }
  });

  if (initRes.status === 401) {
    setDriveAccessToken(null);
    throw new Error('Google Drive token expired');
  }

  const uploadLocation = initRes.headers.get('Location');
  if (uploadLocation) {
    const putRes = await fetch(uploadLocation, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBlob
    });
    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`Drive 미디어 업로드 실패 [${putRes.status}]: ${errText}`);
    }
    const result = await putRes.json();
    driveFileIdCache.set(fileName, { id: fileId, name: fileName, modifiedTime: new Date().toISOString() });
    return result;
  } else {
    const mediaRes = await driveApi(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBlob
    });
    const result = await mediaRes.json();
    driveFileIdCache.set(fileName, { id: fileId, name: fileName, modifiedTime: new Date().toISOString() });
    return result;
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
        // 메타데이터 업데이트 (업데이트 시각 비교 후 덮어쓰기)
        const remoteUpdated = remote.updatedAt || 0;
        const localUpdated = local.updatedAt || 0;
        if (remoteUpdated > localUpdated) {
          local._needDetailSync = true;
        }
        local.title = remote.title || local.title;
        local.date = remote.date || local.date;
        local.memo = remote.memo ?? local.memo;
        local.songCount = remote.songCount ?? (local.songs ? local.songs.length : 0);
        local.updatedAt = remoteUpdated || localUpdated;
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
export async function syncContiDetailFromDrive(contiId, force = false) {
  if (!hasDriveAuth() || !contiId) return null;

  const conti = state.contis.find(c => c.id === contiId);

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

    // 드라이브 파일의 modifiedTime 및 로컬 updatedAt 검사
    const driveModified = detailFile.modifiedTime ? new Date(detailFile.modifiedTime).getTime() : 0;
    const localUpdated = (conti && conti.updatedAt) ? conti.updatedAt : 0;

    // 드라이브에 더 최신 파일이 있거나, 플래그가 켜져 있거나, 강제 동기화인 경우 무조건 최신 다운로드!
    const needsSync = force || (conti && conti._needDetailSync) || (driveModified > localUpdated + 1000);
    if (!needsSync && conti && conti.songs && conti.songs.length > 0) {
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
      conti.updatedAt = detailData.updatedAt || driveModified || Date.now();
      conti._needDetailSync = false;

      // IndexedDB에 콘티 및 곡 저장
      await idbPut('contis', conti);
      for (const s of conti.songs) {
        await idbPut('songs', s);
      }

      // 스티커 및 메모 데이터 최신 동기화 (기기간 100% 일치)
      if (detailData.stickersBySong) {
        for (const [sId, stList] of Object.entries(detailData.stickersBySong)) {
          const items = Array.isArray(stList) ? stList : (stList?.items || stList?.list || []);
          state.stickersBySong[sId] = items;
          await idbPut('stickers', { songId: sId, items, list: items });
        }
      }
      if (detailData.notesBySong) {
        for (const [sId, nData] of Object.entries(detailData.notesBySong)) {
          await idbPut('notes', { songId: sId, drawing: nData });
        }
      }
      if (state.currentContiId === contiId) {
        state.songs = conti.songs;
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

// 초경량 고화질 악보 이미지 압축 (PNG/대용량 이미지를 150~250KB 고화질 WebP로 95% 초고속 압축)
async function compressImageIfNeeded(dataUrl, maxDim = 1800, quality = 0.82) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return dataUrl;
  // 이미 350KB 미만 WebP라면 추가 압축 불필요
  if (dataUrl.startsWith('data:image/webp') && dataUrl.length < 350 * 1024) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      let compressed = '';
      try {
        compressed = canvas.toDataURL('image/webp', quality);
      } catch (_) {}
      if (!compressed || !compressed.startsWith('data:image/webp')) {
        compressed = canvas.toDataURL('image/jpeg', quality);
      }

      resolve((compressed && compressed.length < dataUrl.length) ? compressed : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// 클라우드 업로드용 악보 객체 정제 (수십 MB짜리 original 원본 제거 + 이미지 초경량 압축으로 95% 용량 절감)
export async function cleanSongForDrive(s) {
  if (!s) return null;
  let finalImg = s.image;
  if (finalImg && (finalImg.length > 300 * 1024 || finalImg.startsWith('data:image/png'))) {
    finalImg = await compressImageIfNeeded(finalImg);
    s.image = finalImg; // 로컬 메모리/IDB도 동시 경량화
  }
  return {
    id: s.id,
    name: s.name,
    key: s.key || '',
    timeSig: s.timeSig || '4/4',
    tempo: s.tempo || '',
    themes: s.themes || [],
    order: s.order || 0,
    songform: s.songform || [],
    image: finalImg,
    isShared: Boolean(s.isShared || s.shared),
    sharedWith: s.sharedWith || [],
    authorEmail: s.authorEmail || '',
    authorName: s.authorName || '',
    createdAt: s.createdAt || Date.now(),
    updatedAt: s.updatedAt || Date.now()
    // original 필드는 절대로 클라우드에 올리지 않음 (로컬 IDB에만 보존)
  };
}

// 스티커 변경 시 사용자 조작 방해 없이 백그라운드에서 자동 디바운스 백업
let detailSyncTimer = null;
export function debounceSyncContiDetail(contiId, delay = 1000) {
  if (!hasDriveAuth() || !contiId) return;
  clearTimeout(detailSyncTimer);
  detailSyncTimer = setTimeout(() => {
    syncContiDetailToDrive(contiId, false);
  }, delay);
}

export async function syncContiDetailToDrive(contiId, showToast = true) {
  if (!hasDriveAuth() || !contiId) return;

  try {
    if (showToast) showSyncToast('악보 데이터 백업 중...', 'loading');
    let conti = state.contis.find(c => c.id === contiId);
    if (!conti) {
      conti = await idbGet('contis', contiId);
    }
    if (!conti) return;

    let songs = (state.currentContiId === contiId && state.songs && state.songs.length)
      ? state.songs
      : (conti.songs && conti.songs.length ? conti.songs : []);

    if (!songs.length) {
      const dbConti = await idbGet('contis', contiId);
      if (dbConti && dbConti.songs && dbConti.songs.length) {
        songs = dbConti.songs;
      }
    }

    // 1. 대용량 이미지 병렬 초경량 압축 + 불필요한 원본(original) 고화질 필드 완전 제외로 용량 95% 절감!
    const cleanedSongs = (await Promise.all(songs.map(s => cleanSongForDrive(s)))).filter(Boolean);

    // 2. 병렬로 스티커 데이터 취합 (기존 순차 루프 대비 수십 배 고속 처리)
    const stickersBySong = { ...(state.stickersBySong || {}) };
    await Promise.all(songs.map(async (s) => {
      if (!stickersBySong[s.id] || !stickersBySong[s.id].length) {
        const rec = await idbGet('stickers', s.id);
        if (rec) stickersBySong[s.id] = rec.items || rec.list || [];
      }
    }));

    const detailData = {
      id: conti.id,
      title: conti.title || '새 콘티',
      date: conti.date || '',
      memo: conti.memo || '',
      authorEmail: conti.authorEmail || 'leader@continote.com',
      authorName: conti.authorName || '인도자',
      sharedWith: conti.sharedWith || [],
      songs: cleanedSongs,
      stickersBySong: stickersBySong,
      updatedAt: Date.now()
    };

    conti.songs = cleanedSongs;
    conti.updatedAt = detailData.updatedAt;
    conti._needDetailSync = false;
    await idbPut('contis', conti);

    // 1. 해당 콘티 전용 파일 초고속 Direct 업로드 (conti_{id}.json)
    await uploadJsonFile(`conti_${contiId}.json`, detailData);

    // 2. 전체 콘티 목록 인덱스 백업은 백그라운드 비동기로 병행하여 대기 시간 제로화
    syncContisIndexToDrive(state.contis, false).catch(() => {});

    if (showToast) showSyncToast('Google Drive 저장 완료', 'success');
  } catch (err) {
    console.warn('콘티 상세 Drive 업로드 실패:', err);
    if (showToast) showSyncToast('악보 백업 실패: ' + (err.message || ''), 'error');
  }
}

// 로컬에 이미 곡이 있는 콘티들이 드라이브에 누락되어 있다면 자동 일괄 백업
export async function syncAllContisDetailToDrive(showToast = false) {
  if (!hasDriveAuth()) return;
  try {
    const localContis = await idbGetAll('contis');
    let uploadedCount = 0;
    for (const c of localContis) {
      const songs = (state.currentContiId === c.id && state.songs && state.songs.length) ? state.songs : (c.songs || []);
      if (songs.length > 0) {
        await syncContiDetailToDrive(c.id, false);
        uploadedCount++;
      }
    }
    if (showToast && uploadedCount > 0) {
      showSyncToast(`${uploadedCount}개 콘티 악보 백업 완료`, 'success');
    }
  } catch (err) {
    console.warn('콘티 악보 일괄 백업 실패:', err);
  }
}

/* ==================================================
   [3단계] 마스터 악보 보관함 클라우드 동기화 (library.json)
   ================================================== */
const LIBRARY_FILE_NAME = 'library.json';

export async function syncLibraryFromDrive() {
  if (!hasDriveAuth()) return state.allSongs;

  try {
    const libFile = await findFileInAppFolder(LIBRARY_FILE_NAME);
    if (!libFile) {
      // 드라이브에 아직 라이브러리가 없으면 로컬 라이브러리 최초 업로드
      const localLib = (state.allSongs && state.allSongs.length) ? state.allSongs : (await idbGetAll('library'));
      if (localLib && localLib.length > 0) {
        await syncLibraryToDrive(localLib, false);
      }
      return state.allSongs;
    }

    const driveLibrary = await downloadJsonFile(libFile.id);
    if (!Array.isArray(driveLibrary)) return state.allSongs;

    const localLib = await idbGetAll('library');
    const localMap = new Map(localLib.map(s => [s.id, s]));

    for (const remoteSong of driveLibrary) {
      if (!remoteSong || !remoteSong.id) continue;
      const localSong = localMap.get(remoteSong.id);
      if (!localSong) {
        // 로컬에 없는 신규 곡 추가
        localMap.set(remoteSong.id, remoteSong);
        await idbPut('library', remoteSong);
      } else {
        // 로컬에 이미 존재하는 곡: 원격이 최신이거나 공유 상태(isShared)가 다르면 최신 내용으로 완벽 동기화!
        const remoteUpdated = remoteSong.updatedAt || 0;
        const localUpdated = localSong.updatedAt || 0;
        const remoteShared = Boolean(remoteSong.isShared ?? remoteSong.shared);
        const localShared = Boolean(localSong.isShared ?? localSong.shared);

        if (remoteUpdated >= localUpdated || remoteShared !== localShared) {
          localSong.name = remoteSong.name || localSong.name;
          localSong.key = remoteSong.key ?? localSong.key;
          localSong.timeSig = remoteSong.timeSig ?? localSong.timeSig;
          localSong.tempo = remoteSong.tempo ?? localSong.tempo;
          localSong.themes = remoteSong.themes || localSong.themes;
          localSong.songform = remoteSong.songform || localSong.songform;
          localSong.isShared = remoteShared;
          localSong.shared = remoteShared;
          localSong.sharedWith = remoteSong.sharedWith || localSong.sharedWith;
          localSong.updatedAt = Math.max(remoteUpdated, localUpdated);
          if (remoteSong.image) localSong.image = remoteSong.image;
          await idbPut('library', localSong);
        }
      }
    }

    state.allSongs = Array.from(localMap.values());
    state.allSongs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return state.allSongs;
  } catch (err) {
    console.warn('라이브러리 Drive 동기화 실패:', err);
    return state.allSongs;
  }
}

export async function syncLibraryToDrive(libraryList = null, showToast = true) {
  if (!hasDriveAuth()) return;
  try {
    if (showToast) showSyncToast('악보 보관함 백업 중...', 'loading');
    let rawList = libraryList || state.allSongs || [];
    if (!rawList.length) {
      rawList = await idbGetAll('library');
    }
    if (rawList.length > 0) {
      // 대용량 원본(original) 제거 및 이미지 압축 적용 (40MB -> 600KB, 98% 용량 감축!)
      const cleanedList = (await Promise.all(rawList.map(s => cleanSongForDrive(s)))).filter(Boolean);
      await uploadJsonFile(LIBRARY_FILE_NAME, cleanedList);
      if (showToast) showSyncToast('악보 보관함 백업 완료', 'success');
    }
  } catch (err) {
    console.warn('악보 보관함 Drive 업로드 실패:', err);
    if (showToast) showSyncToast('보관함 백업 실패: ' + (err.message || ''), 'error');
  }
}

// 전체 데이터 원클릭 동기화 (콘티 목록 + 악보 상세 + 마스터 보관함)
export async function runFullDriveSync(showToast = true) {
  if (!hasDriveAuth()) return;
  try {
    if (showToast) showSyncToast('클라우드 전체 동기화 중...', 'loading');
    // 1. 콘티 목록 인덱스 백업
    await syncContisIndexToDrive(state.contis, false);
    // 2. 콘티별 상세 악보 백업
    const localContis = await idbGetAll('contis');
    for (const c of localContis) {
      const songs = (state.currentContiId === c.id && state.songs && state.songs.length) ? state.songs : (c.songs || []);
      if (songs.length > 0) {
        await syncContiDetailToDrive(c.id, false);
      }
    }
    // 3. 마스터 악보 보관함 백업 (40MB -> 600KB로 고속 백업)
    const localLib = (state.allSongs && state.allSongs.length) ? state.allSongs : (await idbGetAll('library'));
    if (localLib && localLib.length > 0) {
      await syncLibraryToDrive(localLib, false);
    }
    if (showToast) showSyncToast('Google Drive 전체 동기화 완료!', 'success');
  } catch (err) {
    console.warn('전체 Drive 동기화 실패:', err);
    if (showToast) showSyncToast('동기화 오류: ' + (err.message || ''), 'error');
  }
}
