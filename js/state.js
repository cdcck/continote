/**
 * ContiNote - State Management & Preferences
 */

export const state = {
  theme: 'system', // 기본값: 'system' ('system' | 'light' | 'dark')
  navDirection: 'horizontal',
  locked: true, // 기본값: 🔒 잠김 (보기 모드)
  activeMenu: 'user', // 'user' | 'leader' | 'library' | 'settings'
  viewLevel: 'contiList', // 'contiList' | 'songList' | 'viewer' | 'songLibrary' | 'settings'
  viewerReturnView: null, // 'songList' | 'songLibrary' (뷰어에서 뒤로갈 대상 뷰)
  currentUser: null, // 로그인 사용자 정보 { email, name, picture }
  contis: [], // 콘티 목록 [{ id, title, date, memo, authorEmail, authorName, sharedWith: [], songs: [] }]
  currentContiId: null, // 현재 선택된 콘티 ID
  songs: [], // 현재 콘티의 곡 목록 (동기화)
  currentIndex: 0,
  allSongs: [], // 전체 마스터 악보 라이브러리 [{ id, name, key, timeSig, tempo, themes: [], image, original, songform: [] }]
  songformLabels: ['A', 'B', 'C', 'D', 'bis', 'I', 'O'],
  themes: ['은혜', '찬양', '감사', '회개', '결단', '십자가', '부흥', '승리'], // 곡 주제 태그 목록
  stickersBySong: {},
  penColor: '#2B2730',
  penSize: 3,
  eraseMode: false,
  stickerScale: 1.0, // 송폼 스티커 배율 (기본 1.0 = 100%)
  cropTarget: null,
  cropMode: 'auto', // 'auto' | 'manual'
  cropAutoBox: null,
  cropManualBox: null,
};

export function getCurrentConti() {
  return state.contis.find(c => c.id === state.currentContiId) || null;
}

export function getCurrentSong() {
  if (state.viewerReturnView === 'songLibrary') {
    return state.songs[state.currentIndex] || null;
  }
  const conti = getCurrentConti();
  if (!conti || !conti.songs || !conti.songs.length) return state.songs[state.currentIndex] || null;
  return conti.songs[state.currentIndex] || null;
}

export const PEN_COLORS = [
  '#2B2730',
  '#E0484B',
  '#3A7BD5',
  '#2FA84F',
  '#E8912D',
  '#9D4EDD'
];

const LS_KEY = 'continote_pref_v3';
const LS_USER_KEY = 'continote_user_session';

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('설정 불러오기 실패:', e);
  }
  return {
    theme: 'system',
    navDirection: 'horizontal',
    songformLabels: ['A', 'B', 'C', 'D', 'bis', 'I', 'O'],
    themes: ['은혜', '찬양', '감사', '회개', '결단', '십자가', '부흥', '승리'],
    stickerScale: 1.0
  };
}

export function savePreferences() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      theme: state.theme,
      navDirection: state.navDirection,
      songformLabels: state.songformLabels,
      themes: state.themes,
      stickerScale: state.stickerScale || 1.0
    }));
  } catch (e) {
    console.warn('설정 저장 실패:', e);
  }
}

export function loadUserSession() {
  try {
    const raw = localStorage.getItem(LS_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('세션 불러오기 실패:', e);
  }
  return null;
}

export function saveUserSession(user) {
  try {
    if (user) {
      localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LS_USER_KEY);
    }
  } catch (e) {
    console.warn('세션 저장 실패:', e);
  }
}
