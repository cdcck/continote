/**
 * ContiNote - Firebase Cloud Service Module (v10 Modular SDK via official ESM CDN)
 * Multi-tenant architecture (orgId) for Songs, Versions, Contis & Auth
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ==========================================
// [1] Firebase Configuration & Initialization
// ==========================================
export const firebaseConfig = {
  apiKey: "AIzaSyA9mYZvKTlDgswQctnEL03CmaFit5RgUcg",
  authDomain: "continote-cc.firebaseapp.com",
  projectId: "continote-cc",
  storageBucket: "continote-cc.firebasestorage.app",
  messagingSenderId: "389532117634",
  appId: "1:389532117634:web:d23bb84a9949e13845629b",
  measurementId: "G-J66ZHLM4PR"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ==========================================
// [2] Image Compression Engine (100% Free Plan: WebP < 400KB)
// ==========================================
/**
 * 악보 이미지를 고화질 유지하면서 200~350KB 수준의 WebP DataURL로 압축
 * Firestore 단일 문서 1MB 한도 내 안전하게 저장
 * @param {HTMLImageElement|HTMLCanvasElement|Blob|string} imageSource
 * @param {number} maxDimension 최대 가로/세로 픽셀 (기본 1500px - 악보 가독성에 최적화)
 * @param {number} quality 압축 퀄리티 (0.0 ~ 1.0, 기본 0.78)
 * @returns {Promise<string>} WebP Data URL string
 */
export async function compressSheetImage(imageSource, maxDimension = 1500, quality = 0.78) {
  let img;
  if (typeof imageSource === 'string') {
    img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = imageSource;
    });
  } else if (imageSource instanceof Blob) {
    const url = URL.createObjectURL(imageSource);
    img = new Image();
    await new Promise((res, rej) => {
      img.onload = () => { URL.revokeObjectURL(url); res(); };
      img.onerror = (e) => { URL.revokeObjectURL(url); rej(e); };
      img.src = url;
    });
  } else if (imageSource instanceof HTMLImageElement) {
    img = imageSource;
  } else if (imageSource instanceof HTMLCanvasElement) {
    return imageSource.toDataURL('image/webp', quality);
  } else {
    throw new Error('지원하지 않는 이미지 원본 타입입니다.');
  }

  let { width, height } = img;
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // 악보 가독성 향상을 위해 흰색 배경 기본 채우기
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/webp', quality);
}

// ==========================================
// [3] Authentication & Organization Flow
// ==========================================

/** 구글 로그인 (안정적인 리다이렉트 방식: COOP 및 팝업 차단 원천 제거) */
export async function loginWithGoogle() {
  await signInWithRedirect(auth, googleProvider);
}

/** 리다이렉트 로그인 결과 확인 */
export async function checkRedirectAuthResult() {
  try {
    const result = await getRedirectResult(auth);
    return result ? result.user : null;
  } catch (err) {
    console.error('리다이렉트 인증 결과 처리 오류:', err);
    return null;
  }
}

/** 로그아웃 */
export async function logoutUser() {
  await signOut(auth);
}

/** 인증 상태 변화 구독 */
export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/** 유저 프로필 조회 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

/** 모든 조직(교회) 목록 조회 (가입 신청 시 선택용) */
export async function getOrganizationList() {
  const orgsColl = collection(db, 'orgs');
  const snap = await getDocs(orgsColl);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * 신규 조직 생성 (생성자가 최초 admin이 되고 즉시 approved)
 */
export async function createOrganization({ orgName, user }) {
  if (!user || !user.uid) throw new Error('인증된 유저 정보가 필요합니다.');
  
  const orgRef = await addDoc(collection(db, 'orgs'), {
    name: orgName.trim(),
    adminUids: [user.uid],
    createdAt: serverTimestamp()
  });

  const orgId = orgRef.id;

  // 유저 문서 저장: admin / approved
  await setDoc(doc(db, 'users', user.uid), {
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0],
    photoURL: user.photoURL || '',
    orgId: orgId,
    orgName: orgName.trim(),
    role: 'admin',
    status: 'approved',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { orgId, orgName };
}

/**
 * 기존 조직 가입 신청 (status: pending)
 */
export async function requestJoinOrganization({ orgId, orgName, user }) {
  if (!user || !user.uid) throw new Error('인증된 유저 정보가 필요합니다.');

  await setDoc(doc(db, 'users', user.uid), {
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0],
    photoURL: user.photoURL || '',
    orgId: orgId,
    orgName: orgName || '',
    role: 'member',
    status: 'pending', // 관리자 승인 대기
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

/**
 * 조직 관리자: 승인 대기 유저 목록 조회
 */
export async function getPendingUsers(orgId) {
  const usersColl = collection(db, 'users');
  const q = query(usersColl, where('orgId', '==', orgId), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

/**
 * 조직 관리자: 유저 승인 처리
 */
export async function approveUser(targetUid) {
  const userRef = doc(db, 'users', targetUid);
  await updateDoc(userRef, {
    status: 'approved',
    updatedAt: serverTimestamp()
  });
}

/**
 * 소속 조직의 승인된 팀원 목록 조회 (공유 대상 선택용)
 */
export async function getApprovedMembers(orgId) {
  if (!orgId) return [];
  const usersColl = collection(db, 'users');
  const q = query(usersColl, where('orgId', '==', orgId), where('status', '==', 'approved'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ==========================================
// [4] Songs (곡 마스터 & 버전 공유 라이브러리)
// ==========================================

/**
 * 곡 마스터 등록 (이미지 압축 후 Firestore 저장)
 * @param {Object} param
 * @param {string} [param.id] 문서 ID (지정 시 1:1 매핑)
 * @param {string} param.orgId 소속 조직 ID
 * @param {string} param.title 곡 제목
 * @param {string} param.pHash 유사도 지문 해시
 * @param {string|Blob} param.imageSource 악보 이미지
 * @param {string} [param.initialKey] 초기 조 (예: G, A)
 * @param {string} [param.createdByUid] 등록자 UID
 * @param {string} [param.authorEmail] 등록자 이메일
 * @param {string} [param.authorName] 등록자 이름
 * @param {boolean} [param.isShared] 찬양팀 공유 여부
 */
export async function addSongMaster({
  id = null,
  orgId,
  title,
  pHash,
  imageSource,
  initialKey = '',
  createdByUid = '',
  authorEmail = '',
  authorName = '',
  isShared = true,
  songForm = [],
  stickers = [],
  tempo = '',
  timeSig = '4/4',
  themes = []
}) {
  if (!orgId) throw new Error('orgId가 필요합니다.');
  
  // 100% 무료 WebP 압축 (이미지가 주어졌을 때만 압축, 없으면 기존 이미지 유지 가능)
  let compressedDataUrl = null;
  if (imageSource) {
    compressedDataUrl = await compressSheetImage(imageSource);
  }

  const songData = {
    orgId,
    title: (title || '제목 없음').trim(),
    pHash: pHash || '',
    initialKey: initialKey || '',
    songForm: Array.isArray(songForm) ? songForm : [],
    stickers: Array.isArray(stickers) ? stickers : [],
    tempo: tempo || '',
    timeSig: timeSig || '4/4',
    themes: Array.isArray(themes) ? themes : [],
    createdByUid: createdByUid || '',
    isShared: isShared !== undefined ? Boolean(isShared) : true,
    updatedAt: serverTimestamp()
  };

  if (authorEmail && authorEmail !== 'leader@continote.com') songData.authorEmail = authorEmail.toLowerCase().trim();
  if (authorName && authorName !== '인도자' && authorName !== '찬양인도자') songData.authorName = authorName.trim();

  if (compressedDataUrl) {
    songData.imageData = compressedDataUrl;
  }

  const targetId = id || crypto.randomUUID();
  const songRef = doc(db, 'songs', targetId);
  await setDoc(songRef, {
    ...songData,
    createdAt: serverTimestamp()
  }, { merge: true });

  return { id: targetId, title, pHash, imageData: compressedDataUrl, songForm, stickers, authorEmail: songData.authorEmail, authorName: songData.authorName, isShared: songData.isShared };
}

/**
 * 마스터 곡의 메타정보 또는 송폼을 Firestore에 부분 업데이트 (초경량)
 */
export async function updateSongMaster(songId, fields = {}) {
  if (!songId || !fields || typeof fields !== 'object') return;
  try {
    const songRef = doc(db, 'songs', songId);
    const updateData = {
      ...fields,
      updatedAt: serverTimestamp()
    };
    if (updateData.title) updateData.title = updateData.title.trim();
    if (updateData.authorEmail) updateData.authorEmail = updateData.authorEmail.toLowerCase().trim();
    if (updateData.authorName) updateData.authorName = updateData.authorName.trim();
    await setDoc(songRef, updateData, { merge: true });
  } catch (err) {
    console.warn('[Firebase] 마스터 곡 업데이트 실패:', err);
  }
}

/**
 * 마스터 곡 Firestore 문서 영구 삭제
 */
export async function deleteSongMaster(songId) {
  if (!songId) return;
  try {
    const songRef = doc(db, 'songs', songId);
    await deleteDoc(songRef);
  } catch (err) {
    console.warn('[Firebase] 마스터 곡 삭제 실패:', err);
  }
}

/**
 * 조직 내 모든 곡 마스터 목록 조회
 */
export async function getOrganizationSongs(orgId) {
  if (!orgId) return [];
  const songsColl = collection(db, 'songs');
  const q = query(songsColl, where('orgId', '==', orgId));
  const snap = await getDocs(q);
  const songs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  songs.sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (typeof a.createdAt === 'number' ? a.createdAt : 0);
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (typeof b.createdAt === 'number' ? b.createdAt : 0);
    return timeB - timeA;
  });
  return songs;
}

/**
 * 조직 내 마스터 악보 목록 실시간 구독 (onSnapshot)
 */
export function subscribeOrganizationSongs(orgId, callback, onError) {
  if (!orgId) return () => {};
  try {
    const songsColl = collection(db, 'songs');
    const qOrg = query(songsColl, where('orgId', '==', orgId));
    return onSnapshot(qOrg, (snapshot) => {
      const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      results.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (typeof a.createdAt === 'number' ? a.createdAt : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (typeof b.createdAt === 'number' ? b.createdAt : 0);
        return timeB - timeA;
      });
      if (typeof callback === 'function') {
        callback(results);
      }
    }, (err) => {
      console.warn('[Firebase] 마스터 악보 실시간 구독 오류:', err);
      if (typeof onError === 'function') onError(err);
    });
  } catch (err) {
    console.warn('[Firebase] 마스터 악보 실시간 구독 초기화 실패:', err);
    return () => {};
  }
}

/**
 * 특정 곡 정보 및 악보 이미지 조회
 */
export async function getSongById(songId) {
  if (!songId) return null;
  const songRef = doc(db, 'songs', songId);
  const snap = await getDoc(songRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * 인도자별 송폼 + 스티커 버전 등록/저장
 * songs/{songId}/versions/{versionId}
 */
export async function saveSongVersion(songId, {
  orgId,
  createdByUid,
  createdByName,
  versionName = '기본 버전',
  songForm = [],
  stickers = [],
  bpm = 0,
  memo = ''
}) {
  if (!songId || !orgId) throw new Error('songId와 orgId가 필요합니다.');

  const versionsColl = collection(db, 'songs', songId, 'versions');
  const docRef = await addDoc(versionsColl, {
    orgId,
    songId,
    createdByUid: createdByUid || '',
    createdByName: createdByName || '인도자',
    versionName: versionName.trim(),
    songForm: Array.isArray(songForm) ? songForm : [],
    stickers: Array.isArray(stickers) ? stickers : [],
    bpm: Number(bpm) || 0,
    memo: memo || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { id: docRef.id, songId, versionName };
}

/**
 * 특정 곡의 등록된 모든 버전 목록 조회
 */
export async function getSongVersions(songId) {
  if (!songId) return [];
  const versionsColl = collection(db, 'songs', songId, 'versions');
  const q = query(versionsColl, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ==========================================
// [5] Contis (세트리스트 & 버전 스냅샷 복사)
// ==========================================

/**
 * 콘티 세트리스트 저장 (가져온 버전 스냅샷을 포함하여 원본 변경에 영향받지 않음)
 */
export async function saveContiSet({
  id = null,
  orgId,
  leaderUid,
  leaderName,
  leaderEmail = '',
  authorEmail = '',
  title,
  date,
  items = [], // [{ songId, versionId, songTitle, songForm, stickers, ... }]
  memo = '',
  sharedWith = []
}) {
  if (!orgId) throw new Error('orgId가 필요합니다.');

  const email = (authorEmail || leaderEmail || '').toLowerCase().trim();

  // [1MB 한도 보호] items 배열 내에서 대용량 이미지 DataURL 필드(image, original) 제거하여 문서 크기 최적화(수 KB)
  const sanitizedItems = (items || []).map(s => {
    const { image, original, ...meta } = s;
    return {
      ...meta,
      id: s.id,
      songId: s.songId || s.masterSongId || s.id,
      name: s.name || s.title || '',
      key: s.key || '',
      timeSig: s.timeSig || '4/4',
      tempo: s.tempo || '',
      themes: s.themes || [],
      order: typeof s.order === 'number' ? s.order : 0,
      songform: Array.isArray(s.songform) ? s.songform : [],
      stickers: Array.isArray(s.stickers) ? s.stickers : [],
      authorEmail: s.authorEmail || email || '',
      authorName: s.authorName || leaderName || '인도자',
      isShared: s.isShared !== undefined ? Boolean(s.isShared) : true
    };
  });
  const contiData = {
    orgId,
    leaderUid: leaderUid || '',
    leaderName: leaderName || '인도자',
    leaderEmail: email,
    authorEmail: email,
    title: title.trim(),
    date: date || new Date().toISOString().split('T')[0],
    items: sanitizedItems, // 경량 메타데이터 (수 KB)
    memo: memo || '',
    sharedWith: Array.isArray(sharedWith) ? sharedWith.map(e => (e || '').toLowerCase().trim()).filter(Boolean) : [],
    updatedAt: serverTimestamp()
  };

  const targetId = id || crypto.randomUUID();
  const contiRef = doc(db, 'contis', targetId);
  await setDoc(contiRef, {
    ...contiData,
    createdAt: serverTimestamp()
  }, { merge: true });

  return { id: targetId, ...contiData };
}

/**
 * 특정 단일 콘티 세트리스트 조회
 */
export async function getContiById(contiId) {
  if (!contiId) return null;
  try {
    const contiRef = doc(db, 'contis', contiId);
    const snap = await getDoc(contiRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.warn('[Firebase] 단일 콘티 조회 실패:', err);
    return null;
  }
}

/**
 * 콘티 세트리스트 삭제
 */
export async function deleteContiSet(contiId) {
  if (!contiId) return;
  try {
    const contiRef = doc(db, 'contis', contiId);
    await deleteDoc(contiRef);
  } catch (err) {
    console.warn('[Firebase] 콘티 삭제 실패:', err);
  }
}

/**
 * 조직 내 콘티 세트리스트 실시간 동기화 구독 (onSnapshot)
 */
export function subscribeOrganizationContis(orgId, callback, onError) {
  if (!orgId) return () => {};
  try {
    const contisColl = collection(db, 'contis');
    const qOrg = query(contisColl, where('orgId', '==', orgId));
    return onSnapshot(qOrg, (snapshot) => {
      const results = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      if (typeof callback === 'function') {
        callback(results);
      }
    }, (err) => {
      console.warn('[Firebase] 콘티 실시간 구독 오류:', err);
      if (typeof onError === 'function') onError(err);
    });
  } catch (err) {
    console.warn('[Firebase] 콘티 실시간 구독 초기화 실패:', err);
    return () => {};
  }
}

/**
 * 조직 내 콘티 세트리스트 목록 조회 (및 이메일로 공유받은 콘티 병합 조회)
 */
export async function getOrganizationContis(orgId, userEmail = '') {
  const contisMap = new Map();
  const contisColl = collection(db, 'contis');

  // 1) 소속 조직(orgId)의 콘티 조회
  if (orgId) {
    try {
      const qOrg = query(contisColl, where('orgId', '==', orgId));
      const snapOrg = await getDocs(qOrg);
      snapOrg.docs.forEach(d => contisMap.set(d.id, { id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[Firebase] orgId 콘티 조회 실패:', err);
    }
  }

  // 2) userEmail로 공유된(sharedWith에 포함된) 콘티 조회
  if (userEmail) {
    try {
      const qShared = query(contisColl, where('sharedWith', 'array-contains', userEmail.toLowerCase().trim()));
      const snapShared = await getDocs(qShared);
      snapShared.docs.forEach(d => contisMap.set(d.id, { id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('[Firebase] sharedWith 콘티 조회 실패:', err);
    }
  }

  const results = Array.from(contisMap.values());
  // 날짜 내림차순 정렬
  results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return results;
}
