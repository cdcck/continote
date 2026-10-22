/**
 * ContiNote - Firebase Cloud Service Module (v10 Modular SDK via official ESM CDN)
 * Multi-tenant architecture (orgId) for Songs, Versions, Contis & Auth
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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

/** 구글 로그인 팝업 */
export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
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

// ==========================================
// [4] Songs (곡 마스터 & 버전 공유 라이브러리)
// ==========================================

/**
 * 곡 마스터 등록 (이미지 압축 후 Firestore 저장)
 * @param {Object} param
 * @param {string} param.orgId 소속 조직 ID
 * @param {string} param.title 곡 제목
 * @param {string} param.pHash 유사도 지문 해시
 * @param {string|Blob} param.imageSource 악보 이미지
 * @param {string} [param.initialKey] 초기 조 (예: G, A)
 * @param {string} [param.createdByUid] 등록자 UID
 */
export async function addSongMaster({ orgId, title, pHash, imageSource, initialKey = '', createdByUid = '' }) {
  if (!orgId) throw new Error('orgId가 필요합니다.');
  
  // 100% 무료 WebP 압축
  const compressedDataUrl = await compressSheetImage(imageSource);

  const songsColl = collection(db, 'songs');
  const docRef = await addDoc(songsColl, {
    orgId,
    title: title.trim(),
    pHash: pHash || '',
    imageData: compressedDataUrl, // DataURL 직접 저장 (약 200~350KB)
    initialKey: initialKey || '',
    createdByUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { id: docRef.id, title, pHash, imageData: compressedDataUrl };
}

/**
 * 조직 내 모든 곡 마스터 목록 조회
 */
export async function getOrganizationSongs(orgId) {
  if (!orgId) return [];
  const songsColl = collection(db, 'songs');
  const q = query(songsColl, where('orgId', '==', orgId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  title,
  date,
  items = [], // [{ songId, versionId, songTitle, songForm, stickers, ... }]
  memo = ''
}) {
  if (!orgId) throw new Error('orgId가 필요합니다.');

  const contiData = {
    orgId,
    leaderUid: leaderUid || '',
    leaderName: leaderName || '인도자',
    title: title.trim(),
    date: date || new Date().toISOString().split('T')[0],
    items: items, // 스냅샷 복사본
    memo: memo || '',
    updatedAt: serverTimestamp()
  };

  if (id) {
    const contiRef = doc(db, 'contis', id);
    await updateDoc(contiRef, contiData);
    return { id, ...contiData };
  } else {
    contiData.createdAt = serverTimestamp();
    const docRef = await addDoc(collection(db, 'contis'), contiData);
    return { id: docRef.id, ...contiData };
  }
}

/**
 * 조직 내 콘티 세트리스트 목록 조회
 */
export async function getOrganizationContis(orgId) {
  if (!orgId) return [];
  const contisColl = collection(db, 'contis');
  const q = query(contisColl, where('orgId', '==', orgId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
