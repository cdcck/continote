/**
 * ContiNote - IndexedDB Storage Service (곡별 독립 매핑 & 마스터 악보 라이브러리)
 */

import { state } from './state.js';

const DB_NAME = 'continote_v3_db';
const DB_VERSION = 3;
let dbInstance = null;

export function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('contis')) {
        db.createObjectStore('contis', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('songs')) {
        db.createObjectStore('songs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('library')) {
        db.createObjectStore('library', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'songId' });
      }
      if (!db.objectStoreNames.contains('stickers')) {
        db.createObjectStore('stickers', { keyPath: 'songId' });
      }
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet(store, key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAll(store) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut(store, val) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(val);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(store, key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 곡 식별을 위한 표준화된 고유 키(Song Key) 생성
 * 곡명(공백/특수문자/대소문자 정규화) + Key(코드) 조합으로 동일 악보 식별
 */
export function generateSongKey(name, key = '') {
  const cleanName = (name || '').trim().toLowerCase().replace(/[\s\-_()\[\]]/g, '');
  const cleanKey = (key || '').trim().toUpperCase();
  return `${cleanName}__${cleanKey}`;
}

/* --------------------------------------------------
   마스터 악보 라이브러리 (Library) 영구 저장소
   -------------------------------------------------- */
export async function loadLibrarySongs() {
  let list = await idbGetAll('library');
  
  // 마이그레이션: library에 곡이 없고 기존 contis에 곡이 존재하면 자동 등록
  if (!list.length && state.contis && state.contis.length) {
    const songMap = new Map();
    for (const c of state.contis) {
      for (const s of (c.songs || [])) {
        if (!s.image) continue;
        const key = generateSongKey(s.name, s.key);
        if (!songMap.has(key)) {
          songMap.set(key, {
            ...s,
            songKey: key,
            songform: Array.isArray(s.songform) ? s.songform : [],
            themes: Array.isArray(s.themes) ? s.themes : ['은혜'],
            key: s.key || '',
            timeSig: s.timeSig || '4/4',
            tempo: s.tempo || ''
          });
        }
      }
    }
    for (const song of songMap.values()) {
      await idbPut('library', song);
      list.push(song);
    }
  }

  state.allSongs = list;
  // 기존 중복된 동일 곡(예: 스크린샷과 같이 송폼 없는 빈 곡과 송폼 있는 곡이 공존하는 경우) 자동 병합 정리
  await deduplicateLibrarySongs();
  state.allSongs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return state.allSongs;
}

/**
 * 마스터 악보 라이브러리 내 동일 곡(동일 곡명+코드) 자동 병합 및 중복 제거
 */
export async function deduplicateLibrarySongs() {
  const songs = state.allSongs || [];
  if (songs.length <= 1) return songs;

  const keyMap = new Map();
  const duplicatesToDelete = [];

  for (const s of songs) {
    const songKey = generateSongKey(s.name, s.key);
    s.songKey = songKey;

    if (!keyMap.has(songKey)) {
      keyMap.set(songKey, s);
    } else {
      const existing = keyMap.get(songKey);

      // 송폼, 템포, 테마, 이미지 등 정보가 더 풍부한 쪽을 winner로 판정
      const existingHasSf = Array.isArray(existing.songform) && existing.songform.length > 0;
      const sHasSf = Array.isArray(s.songform) && s.songform.length > 0;

      let winner = existing;
      let loser = s;

      if (!existingHasSf && sHasSf) {
        winner = s;
        loser = existing;
      } else if (!existing.tempo && s.tempo) {
        winner = s;
        loser = existing;
      } else if ((existing.themes || []).length < (s.themes || []).length) {
        winner = s;
        loser = existing;
      }

      // winner에 loser의 누락된 데이터 보완 병합
      if (!winner.image && loser.image) winner.image = loser.image;
      if (!winner.original && loser.original) winner.original = loser.original;
      if (!winner.tempo && loser.tempo) winner.tempo = loser.tempo;
      if (!winner.timeSig && loser.timeSig) winner.timeSig = loser.timeSig;
      if ((!winner.themes || winner.themes.length === 0) && loser.themes) winner.themes = loser.themes;
      if ((!winner.songform || winner.songform.length === 0) && loser.songform) winner.songform = loser.songform;
      if (!winner.authorName && loser.authorName) winner.authorName = loser.authorName;
      if (!winner.authorEmail && loser.authorEmail) winner.authorEmail = loser.authorEmail;

      keyMap.set(songKey, winner);
      duplicatesToDelete.push({ loserId: loser.id, winnerId: winner.id });
    }
  }

  if (duplicatesToDelete.length > 0) {
    for (const { loserId, winnerId } of duplicatesToDelete) {
      await idbDelete('library', loserId);
      // [무결성 보장] 콘티 내 곡들이 참조하던 이전 마스터 곡 ID를 winnerId로 일괄 승계하여 참조 단절 방지
      if (Array.isArray(state.contis)) {
        let contisModified = false;
        for (const c of state.contis) {
          if (Array.isArray(c.songs)) {
            for (const s of c.songs) {
              if (s.id === loserId || s.masterSongId === loserId || s.songId === loserId) {
                s.masterSongId = winnerId;
                contisModified = true;
              }
            }
          }
        }
        if (contisModified) {
          await saveContis();
        }
      }
    }
    state.allSongs = Array.from(keyMap.values());
    for (const song of state.allSongs) {
      await idbPut('library', song);
    }
  }

  return state.allSongs;
}

/**
 * 비로그인(게스트 leader@continote.com) 상태에서 작성했던 로컬 콘티와 악보를
 * 새로 로그인한 실제 계정(구글 이메일 및 소속 교회)으로 안전하게 자동 소유권 승계(Migrate)
 */
export async function claimGuestContisAndSongs(userEmail, userName, orgId) {
  if (!userEmail || userEmail === 'leader@continote.com') return;
  const cleanEmail = userEmail.toLowerCase().trim();
  const cleanName = (userName || cleanEmail.split('@')[0]).trim();

  let contisChanged = false;
  if (Array.isArray(state.contis)) {
    for (const c of state.contis) {
      const isGuest = !c.authorEmail || c.authorEmail === 'leader@continote.com' || c.authorEmail === 'guest';
      if (isGuest) {
        c.authorEmail = cleanEmail;
        c.authorName = cleanName;
        if (orgId && !c.orgId) c.orgId = orgId;
        contisChanged = true;
      }
      if (Array.isArray(c.songs)) {
        for (const s of c.songs) {
          if (!s.authorEmail || s.authorEmail === 'leader@continote.com') {
            s.authorEmail = cleanEmail;
            s.authorName = cleanName;
            contisChanged = true;
          }
        }
      }
    }
    if (contisChanged) {
      await saveContis();
    }
  }

  let songsChanged = false;
  if (Array.isArray(state.allSongs)) {
    for (const s of state.allSongs) {
      if (!s.authorEmail || s.authorEmail === 'leader@continote.com' || s.authorEmail === 'guest') {
        s.authorEmail = cleanEmail;
        s.authorName = cleanName;
        await idbPut('library', s);
        songsChanged = true;
      }
    }
  }
  return { contisChanged, songsChanged };
}

export async function saveLibrarySong(song) {
  if (!song) return;
  const songKey = generateSongKey(song.name, song.key);
  song.songKey = songKey;

  // 1) ID 일치 또는 2) masterSongId 일치 또는 3) 곡명+Key(코드) 일치 검색
  const existingIdx = state.allSongs.findIndex(s =>
    s.id === song.id ||
    (song.masterSongId && s.id === song.masterSongId) ||
    (s.masterSongId && s.masterSongId === song.id) ||
    (s.name && song.name && generateSongKey(s.name, s.key) === songKey)
  );

  if (existingIdx !== -1) {
    const existing = state.allSongs[existingIdx];
    // 기존 마스터 곡에 변경 내용 병합 (기존 ID 유지하여 식별성 보호)
    existing.name = song.name || existing.name;
    existing.key = song.key || existing.key;
    existing.songKey = songKey;
    if (song.tempo) existing.tempo = song.tempo;
    if (song.timeSig) existing.timeSig = song.timeSig;
    if (Array.isArray(song.themes) && song.themes.length > 0) existing.themes = song.themes;
    if (Array.isArray(song.songform) && song.songform.length > 0) existing.songform = song.songform;
    if (song.image) existing.image = song.image;
    if (song.original) existing.original = song.original;
    // 원등록자 정보 보존 (이미 등록자 정보가 존재한다면 다른 사용자로 덮어쓰지 않음)
    if (!existing.authorEmail || existing.authorEmail === 'leader@continote.com') {
      if (song.authorEmail && song.authorEmail !== 'leader@continote.com') {
        existing.authorEmail = song.authorEmail;
        existing.authorName = song.authorName || existing.authorName;
      }
    } else if (song.authorEmail && song.authorEmail === existing.authorEmail && song.authorName) {
      existing.authorName = song.authorName;
    }
    if (song.isShared !== undefined) existing.isShared = song.isShared;
    existing.updatedAt = Date.now();

    // 만약 전달받은 song의 id가 existing.id와 달랐다면, 콘티 곡에게 masterSongId를 맞춰주고 IDB의 중복 ID 제거
    if (song.id !== existing.id) {
      song.masterSongId = existing.id;
      await idbDelete('library', song.id);
    }

    state.allSongs[existingIdx] = existing;
    await idbPut('library', existing);
  } else {
    state.allSongs.unshift(song);
    await idbPut('library', song);
  }
}

export async function deleteLibrarySong(songId) {
  const idx = state.allSongs.findIndex(s => s.id === songId);
  if (idx !== -1) {
    state.allSongs.splice(idx, 1);
    await idbDelete('library', songId);
  }
  // 스티커 데이터도 함께 정리 (고아 스티커 방지)
  try {
    await idbDelete('stickers', songId);
  } catch (_) {}
  if (state.stickersBySong && songId in state.stickersBySong) {
    delete state.stickersBySong[songId];
  }
}

/* --------------------------------------------------
   콘티(Conti) 단위 저장 및 계정 분리
   -------------------------------------------------- */
export async function loadContis() {
  await migrateLegacyDatabase();
  const allContis = await idbGetAll('contis');
  allContis.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // 데이터 안전성: authorEmail 및 sharedWith 배열 보장
  allContis.forEach(c => {
    if (!c.sharedWith) c.sharedWith = [];
    if (!c.authorEmail) c.authorEmail = 'leader@continote.com';
  });

  state.contis = allContis;
  return state.contis;
}

export async function saveContis() {
  for (const c of state.contis) {
    await idbPut('contis', c);
  }
}

export function getContiSongCount(c) {
  if (!c) return 0;
  if (Array.isArray(c.songs) && !c._needDetailSync) {
    return c.songs.length;
  }
  if (c.songCount !== undefined && c.songCount !== null) {
    return Number(c.songCount) || 0;
  }
  return Array.isArray(c.songs) ? c.songs.length : 0;
}

export async function saveCurrentConti() {
  const current = state.contis.find(c => c.id === state.currentContiId);
  if (current) {
    current.songs = state.songs || [];
    current.songCount = current.songs.length;
    current.updatedAt = Date.now();
    current._needDetailSync = false;
    await idbPut('contis', current);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('continote:conti-updated', { detail: { contiId: current.id } }));
    }
  }
}

export async function deleteConti(contiId) {
  const idx = state.contis.findIndex(c => c.id === contiId);
  let removed = null;
  if (idx !== -1) {
    [removed] = state.contis.splice(idx, 1);
  }
  await idbDelete('contis', contiId);

  const songsToPreserve = (removed && removed.songs && removed.songs.length > 0)
    ? removed.songs
    : ((state.currentContiId === contiId && state.songs && state.songs.length > 0) ? state.songs : []);

  if (state.currentContiId === contiId) {
    state.currentContiId = null;
    state.songs = [];
  }

  // 콘티를 삭제하더라도 곡은 절대 삭제하지 않고 마스터 악보 보관함(library)에 안전하게 영구 보존
  if (songsToPreserve.length > 0) {
    const curLib = await idbGetAll('library');
    const libMap = new Map(curLib.map(s => [s.id, s]));
    for (const s of songsToPreserve) {
      if (!libMap.has(s.id)) {
        await idbPut('library', s);
        state.allSongs.push(s);
      }
    }
  }
}

export async function loadSongs() {
  const current = state.contis.find(c => c.id === state.currentContiId);
  state.songs = current ? (current.songs || []) : [];
  return state.songs;
}

export async function saveSongs() {
  state.songs.forEach((s, idx) => {
    s.order = idx;
  });
  await saveCurrentConti();
}

export async function loadStickers(songId) {
  const rec = await idbGet('stickers', songId);
  state.stickersBySong[songId] = rec ? (rec.items || rec.list || []) : [];
  return state.stickersBySong[songId];
}

export async function saveStickers(songId) {
  const items = state.stickersBySong[songId] || [];
  await idbPut('stickers', { songId, items, list: items });
}

export async function saveUserDrawing(songId, canvas) {
  if (!songId || !canvas) return;
  const dataURL = canvas.toDataURL('image/png');
  await idbPut('notes', { songId, dataURL });
}

/* --------------------------------------------------
   구버전(continote_db) 데이터 자동 무손실 마이그레이션
   -------------------------------------------------- */
export async function migrateLegacyDatabase() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('continote_legacy_migrated') === 'true') {
    return;
  }
  try {
    const legacyDBExists = await new Promise(resolve => {
      if (!window.indexedDB || !indexedDB.databases) {
        const req = indexedDB.open('continote_db');
        req.onsuccess = (e) => {
          const db = e.target.result;
          const hasSongs = db.objectStoreNames.contains('songs');
          db.close();
          resolve(hasSongs);
        };
        req.onerror = () => resolve(false);
        return;
      }
      indexedDB.databases().then(dbs => {
        const found = dbs.some(d => d.name === 'continote_db');
        resolve(found);
      }).catch(() => resolve(false));
    });

    if (!legacyDBExists) return;

    const oldDB = await new Promise((resolve, reject) => {
      const req = indexedDB.open('continote_db');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const oldStores = oldDB.objectStoreNames;
    if (!oldStores.contains('songs')) {
      oldDB.close();
      return;
    }

    // 1. 구버전 songs
    const oldSongs = await new Promise(res => {
      const tx = oldDB.transaction('songs', 'readonly');
      const req = tx.objectStore('songs').getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });

    // 2. 구버전 stickers
    let oldStickers = [];
    if (oldStores.contains('stickers')) {
      oldStickers = await new Promise(res => {
        const tx = oldDB.transaction('stickers', 'readonly');
        const req = tx.objectStore('stickers').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });
    }

    // 3. 구버전 notes(필기)
    let oldNotes = [];
    if (oldStores.contains('notes')) {
      oldNotes = await new Promise(res => {
        const tx = oldDB.transaction('notes', 'readonly');
        const req = tx.objectStore('notes').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });
    }

    oldDB.close();

    if (!oldSongs.length && !oldStickers.length && !oldNotes.length) return;

    console.log(`[ContiNote] 구버전(continote_db) 데이터 복원: 악보 ${oldSongs.length}곡, 스티커 ${oldStickers.length}개, 필기 ${oldNotes.length}개`);

    // 신규 DB에 스티커와 필기 복원
    for (const st of oldStickers) {
      if (st.songId) {
        const items = st.items || st.list || [];
        await idbPut('stickers', { songId: st.songId, items, list: items });
      }
    }
    for (const n of oldNotes) {
      if (n.songId) {
        await idbPut('notes', n);
      }
    }

    // 신규 DB의 contis 확인 및 복원
    const currentContis = await idbGetAll('contis');
    oldSongs.sort((a, b) => (a.order || 0) - (b.order || 0));

    // library(보관함)에도 보존
    const curLib = await idbGetAll('library');
    for (const song of oldSongs) {
      if (!curLib.some(s => s.id === song.id)) {
        await idbPut('library', song);
      }
    }

    // 기본 콘티에 곡이 없거나 비어있는 경우 구버전 곡들로 자동 채우기
    if (!currentContis.length || (currentContis.length === 1 && (!currentContis[0].songs || !currentContis[0].songs.length))) {
      const defaultConti = currentContis[0] || {
        id: crypto.randomUUID(),
        title: '주일 예배 콘티',
        date: new Date().toISOString().slice(0, 10),
        memo: '이전 버전에서 복원된 콘티입니다.',
        authorEmail: state.currentUser?.email || 'leader@continote.com',
        authorName: state.currentUser?.name || '인도자',
        sharedWith: [],
        createdAt: Date.now()
      };
      defaultConti.songs = oldSongs;
      await idbPut('contis', defaultConti);
    } else {
      // 기존 콘티가 있을 때도 구버전 곡 중 누락된 곡이 있으면 첫 번째 콘티에 복원
      const firstConti = currentContis[0];
      if (firstConti && Array.isArray(firstConti.songs)) {
        for (const s of oldSongs) {
          if (!firstConti.songs.some(existing => existing.id === s.id)) {
            firstConti.songs.push(s);
          }
        }
        await idbPut('contis', firstConti);
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('continote_legacy_migrated', 'true');
    }
  } catch (err) {
    console.warn('[ContiNote] 구버전 마이그레이션 실패:', err);
  }
}
