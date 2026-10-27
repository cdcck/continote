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
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ==========================================
// [1] Firebase Configuration & Initialization
// ==========================================
export const firebaseConfig = {
  apiKey: "AIzaSyChl7K99lOelbofqveYHvrdzhqFrNsxRPY",
  authDomain: "contiz.firebaseapp.com",
  projectId: "contiz",
  storageBucket: "contiz.firebasestorage.app",
  messagingSenderId: "335120800015",
  appId: "1:335120800015:web:0b30acad3ea968facb467a"
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

/** 리다이렉트 잔재 정리용 호환 함수 (no-op) */
export async function checkRedirectAuthResult() {
  return null;
}

/** 로그아웃 */
export async function logoutUser() {
  await signOut(auth);
}

/** 인증 상태 변화 구독 */
export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

let orgConsolidationPromise = null;

/**
 * 동일 이름(name)으로 중복 생성된 조직(orgs) 문서를 감지하여
 * 실제 데이터(악보/콘티/팀원)가 있는 원본 orgId로 자동 통합 및 중복 문서 삭제
 */
export async function consolidateDuplicateOrgs() {
  if (orgConsolidationPromise) return orgConsolidationPromise;

  orgConsolidationPromise = (async () => {
    try {
      const orgsColl = collection(db, 'orgs');
      const snap = await getDocs(orgsColl);
      const allOrgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const byName = new Map();
      for (const org of allOrgs) {
        const key = (org.name || '').trim();
        if (!key) continue;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(org);
      }

      const canonicalOrgs = [];

      for (const [name, group] of byName.entries()) {
        if (group.length === 1) {
          canonicalOrgs.push(group[0]);
          continue;
        }

        const scored = await Promise.all(group.map(async (org) => {
          let dataScore = 0;
          let userScore = 0;
          try {
            const [songsSnap, contisSnap, usersSnap] = await Promise.all([
              getDocs(query(collection(db, 'songs'), where('orgId', '==', org.id))),
              getDocs(query(collection(db, 'contis'), where('orgId', '==', org.id))),
              getDocs(query(collection(db, 'users'), where('orgId', '==', org.id)))
            ]);
            dataScore = songsSnap.size + contisSnap.size;
            userScore = usersSnap.size;
          } catch (e) {
            console.warn('[Firebase] 중복 조직 점수 계산 중 경고:', e);
          }
          const createdMillis = org.createdAt?.toMillis ? org.createdAt.toMillis() : Number.MAX_SAFE_INTEGER;
          return { org, dataScore, userScore, createdMillis };
        }));

        scored.sort((a, b) => {
          if (b.dataScore !== a.dataScore) return b.dataScore - a.dataScore;
          if (b.userScore !== a.userScore) return b.userScore - a.userScore;
          return a.createdMillis - b.createdMillis;
        });

        const primaryOrg = scored[0].org;
        const duplicates = scored.slice(1).map(s => s.org);
        const mergedAdmins = new Set(Array.isArray(primaryOrg.adminUids) ? primaryOrg.adminUids : []);

        for (const dup of duplicates) {
          if (Array.isArray(dup.adminUids)) {
            dup.adminUids.forEach(u => mergedAdmins.add(u));
          }

          for (const colName of ['users', 'songs', 'contis']) {
            try {
              const colSnap = await getDocs(query(collection(db, colName), where('orgId', '==', dup.id)));
              for (const d of colSnap.docs) {
                await updateDoc(doc(db, colName, d.id), { orgId: primaryOrg.id });
              }
            } catch (moveErr) {
              console.warn(`[Firebase] 중복 org(${dup.id}) -> 원본 org(${primaryOrg.id}) ${colName} 이관 실패:`, moveErr);
            }
          }

          try {
            await deleteDoc(doc(db, 'orgs', dup.id));
            console.log(`[Firebase] 중복 생성된 동일 이름 조직 '${name}' (id: ${dup.id}) -> 원본 (id: ${primaryOrg.id}) 통합 및 삭제 완료`);
          } catch (delErr) {
            console.warn(`[Firebase] 중복 조직(${dup.id}) 삭제 권한 대기:`, delErr);
          }
        }

        const updatedAdmins = Array.from(mergedAdmins);
        primaryOrg.adminUids = updatedAdmins;
        try {
          await updateDoc(doc(db, 'orgs', primaryOrg.id), { adminUids: updatedAdmins });
        } catch (_) {}

        canonicalOrgs.push(primaryOrg);
      }

      return canonicalOrgs;
    } catch (err) {
      console.warn('[Firebase] 중복 조직 자동 정리 중 오류:', err);
      return null;
    } finally {
      setTimeout(() => { orgConsolidationPromise = null; }, 10000);
    }
  })();

  return orgConsolidationPromise;
}

/** 유저 프로필 조회 (신규 프로젝트 이동 시 이메일 기반 프로필/조직 자동 승계 및 구 UID 중복 문서 정리) */
export async function getUserProfile(uid, email = '') {
  if (!uid) return null;

  await consolidateDuplicateOrgs();

  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const cleanEmail = (email || (snap.exists() ? snap.data().email : '') || '').toLowerCase().trim();

  let emailDocs = [];
  if (cleanEmail) {
    try {
      const usersColl = collection(db, 'users');
      const q = query(usersColl, where('email', '==', cleanEmail));
      const emailSnap = await getDocs(q);
      emailDocs = emailSnap.docs;
    } catch (err) {
      console.warn('[Firebase] 이메일 기반 프로필 검색 실패:', err);
    }
  }

  const otherDocs = emailDocs.filter(d => d.id !== uid);

  if (otherDocs.length > 0) {
    const currentData = snap.exists() ? snap.data() : {};
    let mergedData = { ...currentData };

    for (const oldDoc of otherDocs) {
      const oldData = oldDoc.data();
      mergedData = {
        ...oldData,
        ...mergedData,
        role: (currentData.role === 'admin' || oldData.role === 'admin') ? 'admin' : (mergedData.role || oldData.role || 'member'),
        status: (currentData.status === 'approved' || oldData.status === 'approved') ? 'approved' : (mergedData.status || oldData.status || 'pending'),
        orgId: mergedData.orgId || oldData.orgId || '',
        orgName: mergedData.orgName || oldData.orgName || ''
      };
    }

    for (const oldDoc of otherDocs) {
      const oldOrgId = oldDoc.data().orgId;
      if (oldOrgId && oldOrgId !== mergedData.orgId) {
        try {
          const checkOldOrg = await getDoc(doc(db, 'orgs', oldOrgId));
          if (checkOldOrg.exists()) {
            mergedData.orgId = oldOrgId;
            mergedData.orgName = checkOldOrg.data().name || mergedData.orgName;
          }
        } catch (_) {}
      }
    }

    const migratedProfile = {
      ...mergedData,
      uid: uid,
      email: cleanEmail || mergedData.email || '',
      updatedAt: serverTimestamp()
    };

    await setDoc(userRef, migratedProfile, { merge: true });

    if (migratedProfile.orgId) {
      try {
        const orgRef = doc(db, 'orgs', migratedProfile.orgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          const orgData = orgSnap.data();
          const oldIds = otherDocs.map(d => d.id);
          let adminUids = Array.isArray(orgData.adminUids) ? [...orgData.adminUids] : [];
          const wasAdmin = migratedProfile.role === 'admin' || oldIds.some(id => adminUids.includes(id));
          adminUids = adminUids.filter(id => !oldIds.includes(id));
          if (wasAdmin && !adminUids.includes(uid)) {
            adminUids.push(uid);
          }
          await updateDoc(orgRef, { adminUids });
        }
      } catch (e) {
        console.warn('[Firebase] org adminUids 자동 승계 건너뜀:', e);
      }
    }

    for (const oldDoc of otherDocs) {
      try {
        await deleteDoc(doc(db, 'users', oldDoc.id));
        console.log(`[Firebase] 구 UID 중복 유저 문서(${oldDoc.id}) 정리 완료`);
      } catch (delErr) {
        console.warn('[Firebase] 구 UID 유저 문서 삭제 실패:', delErr);
      }
    }

    return { uid, ...migratedProfile };
  }

  if (snap.exists()) {
    return { uid, ...snap.data() };
  }

  return null;
}

/** 모든 조직(교회) 목록 조회 (가입 신청 시 선택용 - 중복 이름 자동 통합 및 제거) */
export async function getOrganizationList() {
  const consolidated = await consolidateDuplicateOrgs();
  if (Array.isArray(consolidated) && consolidated.length > 0) {
    return consolidated;
  }

  const orgsColl = collection(db, 'orgs');
  const snap = await getDocs(orgsColl);
  const rawList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const uniqueByName = new Map();
  for (const org of rawList) {
    const key = (org.name || '').trim();
    if (!key) continue;
    if (!uniqueByName.has(key)) {
      uniqueByName.set(key, org);
    }
  }
  return Array.from(uniqueByName.values());
}

/**
 * 신규 조직 생성 (동일 이름 조직이 이미 존재하면 중복 생성하지 않고 기존 조직과 연결)
 */
export async function createOrganization({ orgName, user }) {
  if (!user || !user.uid) throw new Error('인증된 유저 정보가 필요합니다.');
  const trimmedName = orgName.trim();

  const existingOrgs = await getOrganizationList();
  const matchedOrg = existingOrgs.find(o => (o.name || '').trim().toLowerCase() === trimmedName.toLowerCase());

  let orgId;
  if (matchedOrg) {
    orgId = matchedOrg.id;
    const adminUids = Array.isArray(matchedOrg.adminUids) ? [...matchedOrg.adminUids] : [];
    if (!adminUids.includes(user.uid)) {
      adminUids.push(user.uid);
      try {
        await updateDoc(doc(db, 'orgs', orgId), { adminUids });
      } catch (_) {}
    }
  } else {
    const orgRef = await addDoc(collection(db, 'orgs'), {
      name: trimmedName,
      adminUids: [user.uid],
      createdAt: serverTimestamp()
    });
    orgId = orgRef.id;
  }

  await setDoc(doc(db, 'users', user.uid), {
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0],
    photoURL: user.photoURL || '',
    orgId: orgId,
    orgName: trimmedName,
    role: 'admin',
    status: 'approved',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { orgId, orgName: trimmedName };
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
 * 조직 관리자: 승인 대기 유저 목록 조회 (이메일 기준 중복 제거)
 */
export async function getPendingUsers(orgId) {
  const usersColl = collection(db, 'users');
  const q = query(usersColl, where('orgId', '==', orgId), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  const byEmail = new Map();
  snap.docs.forEach(d => {
    const data = { uid: d.id, ...d.data() };
    const key = (data.email || d.id).toLowerCase().trim();
    if (!byEmail.has(key) || d.data().uid === d.id) {
      byEmail.set(key, data);
    }
  });
  return Array.from(byEmail.values());
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
 * 소속 조직의 승인된 팀원 목록 조회 (공유 대상 선택용 - 이메일 기준 중복 제거 및 구 UID 자동 정리)
 */
export async function getApprovedMembers(orgId) {
  if (!orgId) return [];
  const usersColl = collection(db, 'users');
  const q = query(usersColl, where('orgId', '==', orgId), where('status', '==', 'approved'));
  const snap = await getDocs(q);

  const byEmail = new Map();
  for (const d of snap.docs) {
    const raw = d.data();
    const item = { uid: d.id, ...raw };
    const key = (raw.email || d.id).toLowerCase().trim();

    if (!byEmail.has(key)) {
      byEmail.set(key, { docId: d.id, isMigratedUid: raw.uid === d.id, item });
    } else {
      const prev = byEmail.get(key);
      if (raw.uid === d.id && !prev.isMigratedUid) {
        deleteDoc(doc(db, 'users', prev.docId)).catch(() => {});
        byEmail.set(key, { docId: d.id, isMigratedUid: true, item });
      } else if (prev.isMigratedUid && raw.uid !== d.id) {
        deleteDoc(doc(db, 'users', d.id)).catch(() => {});
      }
    }
  }

  return Array.from(byEmail.values()).map(v => v.item);
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
