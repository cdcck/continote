/**
 * ContiNote - Main Application Bootstrap & UI Controller
 * 3-Tier Hierarchy: Conti -> SongList -> Viewer
 * Google Auth, Cloud Sharing, Master Song Library, Song Metadata (Key, Time, Tempo, Theme)
 */

import {
  state, PEN_COLORS, loadPreferences, savePreferences,
  loadUserSession, saveUserSession,
  getCurrentConti, getCurrentSong
} from './state.js';
import {
  loadContis, saveContis, saveCurrentConti, deleteConti,
  loadSongs, saveSongs, loadStickers, saveStickers,
  saveUserDrawing, idbDelete,
  loadLibrarySongs, saveLibrarySong, deleteLibrarySong,
  generateSongKey, deduplicateLibrarySongs,
  getContiSongCount, claimGuestContisAndSongs
} from './db.js';
import {
  clearCanvases, renderBaseSheet,
  renderUserDrawing, setupDrawingSystem
} from './canvas.js';
import {
  computeAutoCropBox, renderCroppedDataURL, syncCropBoxDOM
} from './crop.js';
import { renderStickerLayer } from './stickers.js';
import { setupZoomAndPan, resetZoom, updateZoomVisibility } from './zoom.js';
import {
  setDriveAccessToken, getDriveAccessToken, hasDriveAuth, getDriveTokenExpiresAt,
  syncContisIndexFromDrive, syncContisIndexToDrive,
  syncContiDetailFromDrive, syncContiDetailToDrive, debounceSyncContiDetail, debounceSyncLibraryToDrive,
  syncAllContisDetailToDrive, syncLibraryFromDrive, syncLibraryToDrive, runFullDriveSync,
  deleteContiFileFromDrive, showSyncToast,
  syncTeamMembersFromDrive, upsertTeamMember, loadTeamMembersFromCache
} from './drive.js';
import { computeImageHash, findMatchingSong } from './phash.js';
import {
  addSongMaster, updateSongMaster, deleteSongMaster, saveSongVersion, getOrganizationSongs, getSongVersions,
  loginWithGoogle, logoutUser, subscribeAuth, getUserProfile, checkRedirectAuthResult,
  getOrganizationList, createOrganization, requestJoinOrganization,
  getPendingUsers, approveUser, getApprovedMembers, saveContiSet, getOrganizationContis,
  getSongById, getContiById, deleteContiSet, subscribeOrganizationContis, subscribeOrganizationSongs
} from './firebase.js';

// DOM Elements Cache
const els = {};
const DOM_IDS = [
  // 1. 헤더 및 네비게이션
  'backBtn', 'backBtnText', 'headerLogoArea', 'viewerHeaderInfo', 'viewerContiTitle', 'viewerSongTitle',
  'addContiBtn', 'songListAddBtn', 'songListAddLeadSheetBtn', 'viewerBpmBtn', 'viewerBpmText', 'viewerBpmBtnRight', 'viewerBpmTextRight',
  'lockToggleContainer', 'lockBtn', 'lockClosedIcon', 'lockOpenIcon', 'lockBtnLabel',
  'lockSwitch', 'lockSwitchViewBtn', 'lockSwitchEditBtn',
  'viewerLibraryShareBtn', 'viewerLibraryShareLabel',
  'authHeaderArea', 'headerGoogleLoginBtn', 'headerProfileChip', 'headerUserAvatar', 'headerUserName',
  // 2. [1단계] 콘티 목록 뷰
  'contiListView', 'contiListContainer', 'contiEmptyState', 'emptyContiCreateBtn',
  // 3. [2단계] 곡 목록 뷰
  'songListView', 'songListContiTitle', 'songListSongCountBadge', 'songListContiDate', 'songListContiMemo',
  'songListContainer', 'songListEmptyState', 'emptySongTitle', 'emptySongDesc', 'emptySongAddBtnWrapper', 'emptySongAddBtn',
  // 4. [마스터 악보 보관함 뷰]
  'songLibraryView', 'libraryUploadBtn', 'librarySearchInput', 'libraryThemeFilterBar',
  'librarySongListContainer', 'libraryEmptyState',
  // 5. [3단계] 악보 뷰어 섹션
  'viewerSection', 'songformStickyBar', 'stickerBarRow', 'songformChipsList', 'openChordModalBtn', 'flowBarRow', 'songformFlowDisplayArea',
  'viewer', 'emptyState',
  'stageContainer', 'sheetContainer', 'zoomControls', 'zoomInBtn', 'zoomOutBtn', 'zoomResetBtn', 'zoomLevelText',
  'baseCanvas', 'stickerLayer', 'userCanvas',
  'sheetContainerRight', 'baseCanvasRight', 'stickerLayerRight', 'userCanvasRight',
  'navUI', 'hotspotPrev', 'hotspotNext', 'navIndicator',
  'leaderToolbar', 'leaderCropBtn', 'leaderRatioBtn', 'leaderSongformBtn', 'leaderClearStickersBtn', 'leaderSaveDoneBtn',
  'userPenToolbar', 'penColorSwatches', 'penSizeSlider', 'penSizePreviewDot', 'penSizeDotInner', 'penEraserBtn', 'penClearBtn', 'userTextMemoBtn', 'penStylusOnlyBtn',
  'bottomNav', 'navLeaderBtn', 'navUserBtn', 'navSongLibraryBtn', 'navSettingsBtn',
  'contiSessionLineupBar', // 하단 메뉴 바로 위 콘티 세션 라인업 바
  'fileInput',
  // 6. 모달들
  'cropModal', 'cropAutoTabBtn', 'cropManualTabBtn', 'cropStage', 'cropDisplayImg', 'cropBox', 'cropHintText', 'cropCancelBtn', 'cropApplyBtn',
  'ratioModal', 'ratioResetBtn', 'ratioStage', 'ratioCanvas', 'ratioWidthVal', 'ratioHeightVal', 'ratioAspectVal', 'ratioPrevBtn', 'ratioNextBtn',
  'duplicateSongModal', 'dupSongMatchedTitle', 'dupSongSimilarityBadge', 'dupSongAddVersionBtn', 'dupSongCreateNewBtn',
  'orgOnboardingModal', 'orgTabJoinBtn', 'orgTabCreateBtn', 'orgJoinPanel', 'orgCreatePanel', 'orgSearchInput', 'orgJoinSelect', 'orgCreateNameInput', 'orgSubmitJoinBtn', 'orgSubmitCreateBtn',
  'pendingApprovalScreen', 'pendingOrgNameDisplay', 'pendingRefreshBtn', 'pendingLogoutBtn',
  'orgAdminSection', 'orgAdminSectionDivider', 'orgAdminPendingBadge', 'openOrgAdminBtn', 'orgAdminModal', 'orgPendingUsersList',
  'songformOrderModal', 'songformOrderSongTitle', 'songformStepInput', 'songformMultiplyBtn', 'songformStepNextBtn', 'songformPickerChips', 'songformClearFlowBtn', 'songformFlowList', 'songformFlowEmptyHint', 'songformOrderApplyBtn',
  'contiModal', 'contiModalTitle', 'contiTitleInput', 'contiDateInput', 'contiMemoInput', 'contiSaveBtn',
  'leadSheetModal', 'leadSheetModalTitle', 'leadSheetTitleInput', 'leadSheetContentInput', 'leadSheetFontSizeSelect', 'leadSheetSaveBtn',
  'addContiSessionRowBtn', 'contiSessionList', // 콘티 모달 내 세션 배정 동적 요소
  'settingsView', 'themeSystemBtn', 'themeLightBtn', 'themeDarkBtn', 'navHBtn', 'navVBtn', 'pageAnimSmoothBtn', 'pageAnimInstantBtn', 'viewCount1Btn', 'viewCount2Btn', 'songformManageList', 'newLabelInput', 'addLabelBtn', 'cloudSyncStatusBadge', 'cloudUserOrgDisplay', 'cloudUserEmailDisplay',
  'themeManageList', 'newThemeInput', 'addThemeBtn',
  'textMemoModal', 'textMemoSongSelectBar', 'textMemoSongLeftBtn', 'textMemoSongRightBtn', 'textMemoInput', 'textMemoAddBtn',
  'chordStickerModal', 'chordStickerInput', 'chordStickerBackspaceBtn', 'chordStickerClearBtn', 'chordStickerPreview', 'chordStickerAddBtn',
  'shareModal', 'shareContiTitle', 'shareMemberSearchInput', 'shareOrgMemberCount', 'shareOrgMemberList', 'shareEmailInput', 'addShareEmailBtn', 'shareEmailList', 'copyShareLinkBtn',
  'songMetaModal', 'songMetaModalTitle', 'songMetaNameInput', 'songMetaKeySelect', 'songMetaTimeSigSelect', 'songMetaTempoInput', 'songMetaBpmBtn', 'songMetaThemesContainer', 'songMetaSaveBtn',
  'songMetaLibrarySyncRow', 'songMetaAddToLibraryCheckbox', 'songMetaAddToLibraryLabel', 'songMetaAddToLibraryDesc',
  'addToContiModal', 'addToContiSongTitle', 'addToContiSearchInput', 'addToContiCountBadge', 'addToContiListContainer', 'confirmAddToContiBtn',
  'pwaInstallSection', 'pwaInstallBtn', 'pwaInstallBtnText', 'pwaInstallHint',
  'stickerSizeControls', 'stickerSizeDecBtn', 'stickerSizeIncBtn', 'stickerSizeLabel'
];

function cacheElements() {
  DOM_IDS.forEach(id => els[id] = document.getElementById(id));
}

function show(el, d = 'block') { if (el) el.style.display = d; }
function hide(el) {
  if (!el) return;
  el.style.display = 'none';
  if (els.songMetaModal && el === els.songMetaModal) {
    stopMetronome();
  }
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}
function formatStepTextHtml(step) {
  const escaped = escapeHtml(step);
  if (escaped.includes('×')) {
    return escaped.replace(/×/g, '<span class="text-[10px] sm:text-xs opacity-75 font-semibold mx-[0.5px]">×</span>');
  }
  return escaped;
}
function renderSongformChipsHtml(songform) {
  if (!Array.isArray(songform) || !songform.length) return '';
  return songform.map((step, idx) => {
    const isI = (step === 'I' || step.startsWith('I×') || step.startsWith('I '));
    const stepContent = formatStepTextHtml(step);
    const chip = `<span class="inline-flex items-center px-1 py-[1px] rounded-[3px] text-xs sm:text-sm font-bold shrink-0 leading-none ${isI ? 'part-serif-i' : ''}" style="background:var(--accent-soft);color:var(--accent)">${stepContent}</span>`;
    const arrow = (idx < songform.length - 1)
      ? `<span class="text-[8px] sm:text-[10px] font-bold opacity-35 shrink-0 select-none mx-[1px]">&gt;</span>`
      : '';
    return chip + arrow;
  }).join('');
}
function setButtonActive(el, active) {
  if (!el) return;
  if (active) {
    el.style.borderColor = 'var(--accent)';
    el.style.background = 'var(--accent)';
    el.style.color = '#ffffff';
  } else {
    el.style.borderColor = 'var(--border)';
    el.style.background = 'var(--surface-2)';
    el.style.color = 'var(--text)';
  }
}

function isDarkThemeActive() {
  if (state.theme === 'dark') return true;
  if (state.theme === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/* ==================================================
   Web Audio API 기반 초경량 실시간 메트로놈 엔진
   ================================================== */
// 뷰어 내 실제 변경 여부(Dirty Flag) 추적 (불필요한 뒤로가기 팝업 방지)
let isViewerDirty = false;
export function markViewerDirty() {
  isViewerDirty = true;
}

let audioCtx = null;
let metronomeTimer = null;
let metronomeActiveBtn = null;
let metronomeBpm = 0;
let metronomeBeatIndex = 0;
let metronomeTimeSig = '4/4';
let metronomePattern = [];

/**
 * 박자 정보 분석 및 8분음표 쪼개기(Subdivision) 패턴 생성
 * @param {string|number} timeSig 박자 문자열 (예: '6/8', '9/8', '12/8', '4/4')
 * @param {number} inputBpm 입력 템포
 * @returns {{ effectiveBpm: number, totalClicks: number, pattern: string[], isCompound: boolean }}
 */
function analyzeMetronomeMeter(timeSig, inputBpm) {
  const str = String(timeSig || '4/4').trim();
  const match = str.match(/^(\d+)(?:\/(\d+))?/);
  const numerator = match ? parseInt(match[1], 10) : 4;
  const denominator = (match && match[2]) ? parseInt(match[2], 10) : 4;

  let effectiveBpm = inputBpm;
  let totalClicks = numerator;
  const pattern = [];
  let isCompound = false;

  // 복합 박자: 6/8, 9/8, 12/8 등 분모가 8이고 분자가 3의 배수인 경우
  if (denominator === 8 && (numerator === 6 || numerator === 9 || numerator === 12)) {
    isCompound = true;
    totalClicks = numerator;

    // 점4분음표 BPM(보통 20~110)으로 입력된 경우 8분음표 쪼갬 템포(x3)로 자동 변환
    if (inputBpm <= 110) {
      effectiveBpm = inputBpm * 3;
    }

    // 복합 박자 클릭 패턴:
    // 6/8:  [0: 강, 1,2: 약, 3: 중강, 4,5: 약]
    // 9/8:  [0: 강, 1,2: 약, 3: 중강, 4,5: 약, 6: 중강, 7,8: 약]
    // 12/8: [0: 강, 1,2: 약, 3: 중강, 4,5: 약, 6: 중강, 7,8: 약, 9: 중강, 10,11: 약]
    for (let i = 0; i < totalClicks; i++) {
      if (i === 0) {
        pattern.push('downbeat');
      } else if (i % 3 === 0) {
        pattern.push('midbeat');
      } else {
        pattern.push('upbeat');
      }
    }
  } else {
    // 일반 박자 (4/4, 3/4, 2/4, 2/2, 6/4 등)
    totalClicks = Math.min(32, Math.max(1, numerator));
    for (let i = 0; i < totalClicks; i++) {
      pattern.push(i === 0 ? 'downbeat' : 'upbeat');
    }
  }

  return { effectiveBpm, totalClicks, pattern, isCompound };
}

function getBeatsPerMeasure(timeSig) {
  const { totalClicks } = analyzeMetronomeMeter(timeSig, 60);
  return totalClicks;
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * 3단계 클릭 사운드 생성 (최강박 / 묶음시작 중강박 / 서브 약박)
 */
function playClickSound(beatType = 'upbeat') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    if (beatType === 'downbeat') {
      // 마디 첫 박 (최강박): 고음 선명하고 또렷한 하이 피치 틱 사운드 (1600Hz -> 600Hz)
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
      gain.gain.setValueAtTime(0.95, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (beatType === 'midbeat') {
      // 복합 박자 묶음 시작박 (중강박): 1200Hz -> 450Hz
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.035);
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } else {
      // 쪼개지는 일반 서브 약박: 가벼운 우드블록 틱 사운드 (750Hz -> 250Hz)
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.025);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
    }
  } catch (err) {
    console.warn('Metronome audio error:', err);
  }
}

function triggerBeatVisual(btn, beatType = 'upbeat') {
  if (!btn) return;
  btn.classList.remove('metronome-tick', 'metronome-tick-downbeat');
  void btn.offsetWidth; // reflow trigger
  if (beatType === 'downbeat') {
    btn.classList.add('metronome-tick-downbeat');
  } else if (beatType === 'midbeat') {
    btn.classList.add('metronome-tick');
  }
}

export function startMetronome(bpm, triggerBtn, timeSig = '4/4') {
  stopMetronome();
  const tempo = parseInt(bpm, 10);
  if (!tempo || tempo < 20 || tempo > 300 || isNaN(tempo)) return;

  const { effectiveBpm, pattern } = analyzeMetronomeMeter(timeSig, tempo);

  metronomeBpm = tempo;
  metronomeTimeSig = timeSig;
  metronomeActiveBtn = triggerBtn;
  metronomePattern = pattern;
  metronomeBeatIndex = 0;

  getAudioContext();

  // 첫 박 (최강박) 재생
  const firstBeatType = pattern[0] || 'downbeat';
  playClickSound(firstBeatType);

  if (triggerBtn) {
    triggerBtn.classList.add('metronome-playing');
    triggerBeatVisual(triggerBtn, firstBeatType);
  }

  metronomeBeatIndex = 1 % pattern.length;

  const intervalMs = (60 / effectiveBpm) * 1000;
  metronomeTimer = setInterval(() => {
    const beatType = pattern[metronomeBeatIndex] || 'upbeat';
    playClickSound(beatType);
    if (triggerBtn) {
      triggerBeatVisual(triggerBtn, beatType);
    }
    metronomeBeatIndex = (metronomeBeatIndex + 1) % pattern.length;
  }, intervalMs);
}

export function stopMetronome() {
  if (metronomeTimer) {
    clearInterval(metronomeTimer);
    metronomeTimer = null;
  }
  if (metronomeActiveBtn) {
    metronomeActiveBtn.classList.remove('metronome-playing', 'metronome-tick', 'metronome-tick-downbeat');
    metronomeActiveBtn = null;
  }
  if (els.viewerBpmBtn) {
    els.viewerBpmBtn.classList.remove('metronome-playing', 'metronome-tick', 'metronome-tick-downbeat');
  }
  if (els.viewerBpmBtnRight) {
    els.viewerBpmBtnRight.classList.remove('metronome-playing', 'metronome-tick', 'metronome-tick-downbeat');
  }
  if (els.songMetaBpmBtn) {
    els.songMetaBpmBtn.classList.remove('metronome-playing', 'metronome-tick', 'metronome-tick-downbeat');
  }
  metronomeBpm = 0;
  metronomeBeatIndex = 0;
  metronomePattern = [];
}

export function isMetronomePlaying() {
  return metronomeTimer !== null;
}

export function toggleMetronome(bpm, triggerBtn, timeSig = '4/4') {
  if (isMetronomePlaying()) {
    const wasSameBtn = (metronomeActiveBtn === triggerBtn);
    stopMetronome();
    if (!wasSameBtn && bpm) {
      startMetronome(bpm, triggerBtn, timeSig);
    }
  } else {
    startMetronome(bpm, triggerBtn, timeSig);
  }
}

function updateSongMetaBpmBtnState() {
  if (!els.songMetaBpmBtn || !els.songMetaTempoInput) return;
  const tempoVal = parseInt(els.songMetaTempoInput.value.trim(), 10);
  const timeSigVal = els.songMetaTimeSigSelect?.value || '4/4';

  if (tempoVal && tempoVal >= 20 && tempoVal <= 300) {
    els.songMetaBpmBtn.disabled = false;
    els.songMetaBpmBtn.classList.remove('opacity-40', 'cursor-not-allowed');
    els.songMetaBpmBtn.classList.add('cursor-pointer');
    els.songMetaBpmBtn.style.pointerEvents = 'auto';
    els.songMetaBpmBtn.title = `템포: ${tempoVal} BPM (${timeSigVal} 박자, 클릭하여 소리 듣기)`;
    // 재생 중 템포 또는 박자가 변경되면 실시간으로 새 설정 반영
    if (isMetronomePlaying() && metronomeActiveBtn === els.songMetaBpmBtn && (metronomeBpm !== tempoVal || metronomeTimeSig !== timeSigVal)) {
      startMetronome(tempoVal, els.songMetaBpmBtn, timeSigVal);
    }
  } else {
    if (isMetronomePlaying() && metronomeActiveBtn === els.songMetaBpmBtn) {
      stopMetronome();
    }
    els.songMetaBpmBtn.disabled = true;
    els.songMetaBpmBtn.classList.add('opacity-40', 'cursor-not-allowed');
    els.songMetaBpmBtn.classList.remove('cursor-pointer');
    els.songMetaBpmBtn.style.pointerEvents = 'none';
    els.songMetaBpmBtn.title = '템포(BPM)를 먼저 입력해주세요';
  }
}


/* ==================================================
   Google 인증 및 사용자 세션 관리
   ================================================== */
const GOOGLE_CLIENT_ID = '994055071886-5kn07k326te23njf8is1t7in47deen9t.apps.googleusercontent.com';
let gisClient = null;

export function clearUserSession() {
  state.currentUser = {
    email: 'leader@continote.com',
    name: '찬양인도자',
    picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=continote'
  };
  setDriveAccessToken(null);
  saveUserSession(null);
  updateAuthUI();
  renderContiListView();
  applyUIState();
}

let tokenRefreshTimer = null;
function setupDriveAutoRefresh() {
  if (tokenRefreshTimer) clearInterval(tokenRefreshTimer);

  tokenRefreshTimer = setInterval(() => {
    const isLoggedIn = Boolean(state.currentUser && state.currentUser.email !== 'leader@continote.com');
    if (!isLoggedIn) return;

    if (!hasDriveAuth()) {
      clearUserSession();
      return;
    }

    const expiresAt = getDriveTokenExpiresAt();
    // 만료 5분(300초) 전이면 백그라운드에서 조용히 토큰 자동 갱신 요청
    if (expiresAt && (expiresAt - Date.now() < 300000)) {
      if (gisClient && state.currentUser && state.currentUser.email !== 'leader@continote.com') {
        try {
          gisClient.requestAccessToken({ prompt: '', hint: state.currentUser.email });
        } catch (e) {
          console.warn('드라이브 토큰 자동 연장 시도:', e);
        }
      }
    }
  }, 60000);
}

function initGoogleAuth() {
  const savedUser = loadUserSession();
  const hasValidToken = hasDriveAuth();

  if (savedUser && savedUser.email !== 'leader@continote.com') {
    state.currentUser = savedUser;
  } else {
    // 디폴트 인도자 가상 계정 (오프라인/미로그인 시 기본)
    state.currentUser = {
      email: 'leader@continote.com',
      name: '찬양인도자',
      picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=continote'
    };
  }
  updateAuthUI();

  if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
    try {
      gisClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (resp) => {
          if (resp.error) {
            console.error(resp);
            return;
          }
          if (resp.access_token) {
            setDriveAccessToken(resp.access_token, resp.expires_in || 3600);
          }
          // Access token 획득 후 사용자 프로필 요청
          try {
            const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${resp.access_token}` }
            });
            const userData = await userInfoResp.json();
            state.currentUser = {
              email: userData.email,
              name: userData.name || userData.email.split('@')[0],
              picture: userData.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userData.name || 'User')}`
            };
            saveUserSession(state.currentUser);
            updateAuthUI();
            setupDriveAutoRefresh();

            // 0. @changdae.cc 찬양팀원 풀에 로그인 사용자 자동 누적 및 드라이브 동기화
            await upsertTeamMember(state.currentUser);
            syncTeamMembersFromDrive().catch(e => console.warn('팀원 목록 동기화:', e));

            // 1. Google Drive에서 콘티 목록 선행 동기화 (최신 클라우드 인덱스 반영 및 로컬 더미 제거)
            await syncContisIndexFromDrive(true);
            // 2. 마스터 악보 보관함 동기화
            await syncLibraryFromDrive();
            // 3. 로그인 전 로컬에 실제로 작성된 미이전 콘티가 있다면 내 계정으로 할당 (더미 제외)
            await migrateLocalContisToUser(state.currentUser);
            // 4. 로컬에 존재하는 콘티 악보들 드라이브로 자동 백업
            syncAllContisDetailToDrive().catch(err => console.warn('콘티 상세 백업 대기:', err));
            renderContiListView();
            if (state.viewLevel === 'songLibrary') renderSongLibraryView();
            applyUIState();
          } catch (err) {
            console.warn('사용자 프로필 불러오기 실패:', err);
          }
        }
      });

      // 기존 로그인 사용자인데 토큰만 만료된 경우 백그라운드 무동의 조용한 갱신 시도
      if (savedUser && savedUser.email && savedUser.email !== 'leader@continote.com' && !hasValidToken) {
        try {
          gisClient.requestAccessToken({ prompt: '', hint: savedUser.email });
        } catch (silentErr) {
          console.warn('앱 시작 시 토큰 조용한 연장 시도 대기:', silentErr);
        }
      }
    } catch (e) {
      console.warn('GIS 초기화 대기:', e);
    }
  }

  window.addEventListener('continote:drive-auth-changed', (e) => {
    if (e.detail && !e.detail.authorized && state.currentUser && state.currentUser.email !== 'leader@continote.com') {
      updateAuthUI();
    } else {
      updateAuthUI();
    }
  });

  // 앱 로드 시 기존 Drive 토큰이 유효하면 백그라운드 동기화 및 자동 연장 타이머 가동
  if (hasDriveAuth()) {
    setupDriveAutoRefresh();
    Promise.all([syncContisIndexFromDrive(), syncLibraryFromDrive()]).then(() => {
      syncAllContisDetailToDrive().catch(() => {});
      renderContiListView();
      if (state.viewLevel === 'songLibrary') renderSongLibraryView();
      applyUIState();
    }).catch(err => {
      console.warn('백그라운드 동기화 대기:', err);
      updateAuthUI();
    });
  }
}

// 로그인 전 기본 계정(leader@continote.com)으로 작성된 로컬 콘티를 현재 로그인 사용자로 안전하게 이전 및 '찬양인도자' 명칭 실명으로 자동 보정
async function migrateLocalContisToUser(user) {
  if (!user || !user.email || user.email === 'leader@continote.com') return;
  let changed = false;
  const userName = user.name || user.email.split('@')[0];
  (state.contis || []).forEach(c => {
    const isDummy = (c.authorEmail === 'leader@continote.com' || !c.authorEmail) && (!c.songs || c.songs.length === 0) && c.title === '주일 1부 예배 콘티';
    if (!isDummy && (!c.authorEmail || c.authorEmail === 'leader@continote.com')) {
      c.authorEmail = user.email;
      c.authorName = userName;
      changed = true;
    }
    // 이미 내 계정으로 되어 있지만 authorName이 '찬양인도자' 또는 '인도자'로 남아있다면 실제 구글 프로필 이름으로 일괄 보정
    if (c.authorEmail === user.email && (!c.authorName || c.authorName === '찬양인도자' || c.authorName === '인도자')) {
      c.authorName = userName;
      changed = true;
    }
  });
  if (changed) {
    await saveContis();
    if (hasDriveAuth()) {
      syncContisIndexToDrive(state.contis, false);
    }
  }
}

function updateAuthUI() {
  const isLoggedIn = Boolean(state.currentUser && state.currentUser.email !== 'leader@continote.com');
  const isDriveAuthed = hasDriveAuth();

  if (isLoggedIn) {
    hide(els.headerGoogleLoginBtn);
    show(els.headerProfileChip, 'flex');
    if (els.headerUserAvatar) {
      const defaultAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9CA3AF">
          <path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clip-rule="evenodd" />
        </svg>
      `)}`;
      els.headerUserAvatar.referrerPolicy = 'no-referrer';
      els.headerUserAvatar.onerror = () => {
        els.headerUserAvatar.onerror = null;
        els.headerUserAvatar.src = defaultAvatar;
      };
      els.headerUserAvatar.src = state.currentUser.picture || defaultAvatar;
    }
    if (els.headerUserName) {
      const rawName = (state.currentUser.name || '').trim();
      els.headerUserName.textContent = rawName ? (rawName.endsWith('님') ? rawName : `${rawName}님`) : '';
    }

    // 프로필 칩 테두리 및 툴팁 (교회 소속 및 역할 반영)
    if (els.headerProfileChip) {
      els.headerProfileChip.style.borderColor = 'var(--border)';
      const orgDesc = state.currentUser.orgName ? ` · ${state.currentUser.orgName}` : '';
      const roleDesc = state.currentUser.role === 'admin' ? ' (관리자)' : ' (팀원)';
      els.headerProfileChip.title = `${state.currentUser.name}${orgDesc}${roleDesc}\n클릭 시 로그아웃`;
    }

    // 설정 화면 내 Firebase 클라우드 정보 표시
    if (els.cloudUserOrgDisplay) {
      els.cloudUserOrgDisplay.textContent = state.currentUser.orgName || '소속 교회 없음';
    }
    if (els.cloudUserEmailDisplay) {
      els.cloudUserEmailDisplay.textContent = state.currentUser.email || '';
    }
  } else {
    show(els.headerGoogleLoginBtn, 'flex');
    hide(els.headerProfileChip);
    if (els.cloudUserOrgDisplay) els.cloudUserOrgDisplay.textContent = '로그인 필요';
    if (els.cloudUserEmailDisplay) els.cloudUserEmailDisplay.textContent = '구글 로그인 시 실시간 동기화됩니다';
  }
}

function updateDriveStatusUI() {
  // Firebase 전환으로 사용하지 않음 (호환성 유지용 빈 함수)
}

// 현재 인증된 Firebase 유저 임시 보관
let currentAuthUser = null;

async function handleLoginClick() {
  try {
    const user = await loginWithGoogle();
    currentAuthUser = user;
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      return;
    }
    if (err.code === 'auth/popup-blocked') {
      alert('브라우저에서 로그인 팝업 창이 차단되었습니다.\n주소창 오른쪽의 [팝업 차단 해제] 아이콘을 눌러 팝업을 허용해 주세요.');
      return;
    }
    console.error('Google 로그인 오류:', err);
    alert('로그인 중 오류가 발생했습니다: ' + err.message);
  }
}

let hasExplicitlyLoggedOut = false;

async function handleProfileClick() {
  if (!state.currentUser) return;
  const churchInfo = state.currentUser.orgName ? ` [소속: ${state.currentUser.orgName}]` : '';
  if (!confirm(`'${state.currentUser.name} (${state.currentUser.email})'${churchInfo} 계정에서 로그아웃하시겠습니까?`)) return;
  hasExplicitlyLoggedOut = true;
  try {
    await logoutUser();
  } catch (err) {
    console.error('로그아웃 오류:', err);
  }
  clearUserSession();
  state.currentUser = null;
  updateAuthUI();
  renderContiListView();
  applyUIState();
}

let cachedOrgList = [];

/**
 * 교회(조직) 온보딩 모달 열기
 */
async function openOrgOnboardingModal(user) {
  currentAuthUser = user;
  if (!els.orgOnboardingModal) return;

  if (els.orgSearchInput) els.orgSearchInput.value = '';

  const renderOrgOptions = (query = '') => {
    if (!els.orgJoinSelect) return;
    const q = query.toLowerCase().trim();
    const filtered = cachedOrgList.filter(o => !q || (o.name || '').toLowerCase().includes(q));

    if (filtered.length === 0) {
      els.orgJoinSelect.innerHTML = `<option value="">${q ? '검색된 교회가 없습니다' : '등록된 교회가 없습니다 (새 교회를 만들어주세요)'}</option>`;
      return;
    }

    els.orgJoinSelect.innerHTML = '<option value="">가입할 교회를 선택하세요</option>' +
      filtered.map(o => `<option value="${escapeHtml(o.id)}" data-name="${escapeHtml(o.name)}">${escapeHtml(o.name)}</option>`).join('');
  };

  // 기존 교회 목록 로드
  if (els.orgJoinSelect) {
    els.orgJoinSelect.innerHTML = '<option value="">불러오는 중...</option>';
    try {
      cachedOrgList = await getOrganizationList();
      renderOrgOptions();
    } catch (err) {
      console.warn('교회 목록 로드 실패:', err);
      els.orgJoinSelect.innerHTML = '<option value="">교회 목록을 불러오지 못했습니다</option>';
    }
  }

  // 검색 인풋 이벤트 연결 (1회성 안전 연결)
  if (els.orgSearchInput && !els.orgSearchInput.dataset.bound) {
    els.orgSearchInput.dataset.bound = 'true';
    els.orgSearchInput.addEventListener('input', (e) => {
      renderOrgOptions(e.target.value);
    });
  }

  // 기본 탭: 가입 신청
  switchOrgTab('join');
  show(els.orgOnboardingModal, 'flex');
}

function switchOrgTab(tab) {
  if (tab === 'join') {
    if (els.orgTabJoinBtn) {
      els.orgTabJoinBtn.style.background = 'var(--accent)';
      els.orgTabJoinBtn.style.color = '#fff';
    }
    if (els.orgTabCreateBtn) {
      els.orgTabCreateBtn.style.background = 'transparent';
      els.orgTabCreateBtn.style.color = 'var(--text-dim)';
    }
    show(els.orgJoinPanel, 'block');
    hide(els.orgCreatePanel);
  } else {
    if (els.orgTabCreateBtn) {
      els.orgTabCreateBtn.style.background = 'var(--accent)';
      els.orgTabCreateBtn.style.color = '#fff';
    }
    if (els.orgTabJoinBtn) {
      els.orgTabJoinBtn.style.background = 'transparent';
      els.orgTabJoinBtn.style.color = 'var(--text-dim)';
    }
    show(els.orgCreatePanel, 'block');
    hide(els.orgJoinPanel);
    setTimeout(() => { if (els.orgCreateNameInput) els.orgCreateNameInput.focus(); }, 100);
  }
}

/**
 * 관리자 승인 대기 뱃지 갱신
 */
async function refreshAdminPendingBadge(orgId) {
  if (!orgId || !els.orgAdminPendingBadge) return;
  try {
    const pendings = await getPendingUsers(orgId);
    if (pendings.length > 0) {
      els.orgAdminPendingBadge.textContent = `${pendings.length}명 대기`;
      show(els.orgAdminPendingBadge, 'inline-block');
    } else {
      hide(els.orgAdminPendingBadge);
    }
  } catch (err) {
    console.warn('승인 대기 유저 조회 실패:', err);
  }
}

/**
 * 관리자 전용 승인 모달 열기
 */
async function openOrgAdminModal() {
  if (!state.currentUser?.orgId) return;
  if (!els.orgAdminModal || !els.orgPendingUsersList) return;

  show(els.orgAdminModal, 'flex');
  els.orgPendingUsersList.innerHTML = '<div class="p-4 text-center text-xs text-neutral-400">대기 명단을 조회 중입니다...</div>';

  try {
    const pendings = await getPendingUsers(state.currentUser.orgId);
    if (pendings.length === 0) {
      els.orgPendingUsersList.innerHTML = '<div class="p-8 text-center text-xs text-neutral-400">현재 가입 승인 대기 중인 팀원이 없습니다.</div>';
      return;
    }

    els.orgPendingUsersList.innerHTML = '';
    pendings.forEach(user => {
      const row = document.createElement('div');
      row.className = 'p-3 rounded-xl border flex items-center justify-between gap-2';
      row.style.borderColor = 'var(--border)';
      row.style.backgroundColor = 'var(--surface-2)';

      row.innerHTML = `
        <div class="min-w-0 flex items-center gap-2">
          <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style="background:var(--accent-soft);color:var(--accent)">
            ${escapeHtml((user.displayName || user.email || '?')[0].toUpperCase())}
          </div>
          <div class="min-w-0">
            <span class="font-bold text-xs block truncate">${escapeHtml(user.displayName || '이름 없음')}</span>
            <span class="text-[11px] block truncate" style="color:var(--text-dim)">${escapeHtml(user.email || '')}</span>
          </div>
        </div>
        <button class="approve-btn px-3 py-1.5 rounded-lg text-white font-bold text-xs shadow-sm active:scale-95 transition-all shrink-0"
          style="background:var(--accent)">
          승인
        </button>
      `;

      row.querySelector('.approve-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = '처리 중...';
        try {
          await approveUser(user.uid);
          row.remove();
          refreshAdminPendingBadge(state.currentUser.orgId);
          if (els.orgPendingUsersList.children.length === 0) {
            els.orgPendingUsersList.innerHTML = '<div class="p-8 text-center text-xs text-neutral-400">모든 팀원이 승인되었습니다!</div>';
          }
        } catch (err) {
          alert('승인 처리 실패: ' + err.message);
          btn.disabled = false;
          btn.textContent = '승인';
        }
      });

      els.orgPendingUsersList.appendChild(row);
    });
  } catch (err) {
    els.orgPendingUsersList.innerHTML = `<div class="p-4 text-center text-xs text-red-500">목록 로드 실패: ${escapeHtml(err.message)}</div>`;
  }
}

let contiSnapshotUnsubscribe = null;
let songSnapshotUnsubscribe = null;

/**
 * Firebase Auth 상태 구독 및 자동 세션 관리
 */
function initFirebaseAuth() {
  checkRedirectAuthResult().catch(err => console.warn('리다이렉트 인증 결과 대기 무시:', err));
  subscribeAuth(async (user) => {
    currentAuthUser = user;
    if (user) {
      try {
        const profile = await getUserProfile(user.uid, user.email);
        if (!profile || !profile.orgId) {
          await openOrgOnboardingModal(user);
          return;
        }

        if (profile.status === 'pending') {
          if (els.pendingOrgNameDisplay) {
            els.pendingOrgNameDisplay.textContent = profile.orgName || '교회';
          }
          show(els.pendingApprovalScreen, 'flex');
          return;
        }

        // 승인 완료된 유저
        hide(els.pendingApprovalScreen);
        hide(els.orgOnboardingModal);

        state.currentUser = {
          uid: user.uid,
          email: user.email,
          name: profile.displayName || user.displayName || user.email.split('@')[0],
          orgId: profile.orgId,
          orgName: profile.orgName,
          role: profile.role || 'member',
          status: profile.status,
          picture: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || user.email)}`
        };
        saveUserSession(state.currentUser);
        updateAuthUI();

        // [로컬 데이터 계정 자동 승계] 비로그인(게스트) 시절 작성한 로컬 콘티와 악보를 현재 계정으로 안전하게 귀속
        await claimGuestContisAndSongs(user.email, profile.displayName || user.displayName, profile.orgId);

        if (profile.role === 'admin') {
          if (els.orgAdminSection) show(els.orgAdminSection, 'block');
          if (els.orgAdminSectionDivider) show(els.orgAdminSectionDivider, 'block');
          refreshAdminPendingBadge(profile.orgId);
        } else {
          if (els.orgAdminSection) hide(els.orgAdminSection);
          if (els.orgAdminSectionDivider) hide(els.orgAdminSectionDivider);
        }

        // 현재 화면이 콘티 목록일 때만 로컬 캐시 렌더링 (설정/뷰어 등 타 뷰 열람 방해 금지)
        if (state.viewLevel === 'contiList') {
          renderContiListView();
        }

        // [실시간 리스너 구독] 조직 내 콘티 세트리스트 실시간 동기화 (곡 추가/순서변경/삭제 시 타 사용자 즉시 반영)
        if (contiSnapshotUnsubscribe) {
          contiSnapshotUnsubscribe();
          contiSnapshotUnsubscribe = null;
        }
        contiSnapshotUnsubscribe = subscribeOrganizationContis(profile.orgId, (cloudContis) => {
          handleCloudContisUpdate(cloudContis, true);
        });

        // [실시간 리스너 구독] 조직 내 마스터 악보 라이브러리 실시간 동기화 (곡 정보/송폼/등록자/공유여부 변경 시 즉시 반영)
        if (songSnapshotUnsubscribe) {
          songSnapshotUnsubscribe();
          songSnapshotUnsubscribe = null;
        }
        songSnapshotUnsubscribe = subscribeOrganizationSongs(profile.orgId, (cloudSongs) => {
          handleCloudSongsUpdate(cloudSongs);
        });

        // [SWR 백그라운드 동기화] UI 블로킹 없이 백그라운드에서 조용히 클라우드와 diff 동기화
        (async () => {
          try {
            // 1. 로컬에 작성된 기존 콘티 및 악보를 Firestore 클라우드로 자동 초기 업로드 (리더 ➔ 클라우드)
            await syncAllLocalDataToCloud(profile.orgId, state.currentUser);

            // 2. Firestore 클라우드 콘티 및 악보 라이브러리 실시간 동기화 (클라우드 ➔ 로컬)
            await Promise.all([
              syncCloudContis(profile.orgId, user.email),
              syncCloudSongs(profile.orgId)
            ]);

            // 동기화 완료 후 현재 보고 있는 화면만 조용히 최신 데이터로 갱신
            if (state.viewLevel === 'contiList') {
              renderContiListView();
            } else if (state.viewLevel === 'songList' && state.currentContiId) {
              await loadSongs();
              renderSongListView();
            } else if (state.viewLevel === 'songLibrary') {
              renderSongLibraryView();
            } else if (state.viewLevel === 'settings') {
              renderSettingsView();
            }
            applyUIState();
          } catch (syncErr) {
            console.warn('[Firebase] 백그라운드 클라우드 동기화 대기:', syncErr);
          }
        })();
      } catch (err) {
        console.error('유저 프로필 동기화 오류:', err);
      }
    } else {
      // [세션 깜빡임 및 튕김 방지] 사용자가 직접 로그아웃한 것이 아니고 로컬 캐시 세션이 있다면 세션을 섣불리 파괴하지 않음
      if (!hasExplicitlyLoggedOut && (state.currentUser || loadUserSession())) {
        return;
      }
      if (contiSnapshotUnsubscribe) {
        contiSnapshotUnsubscribe();
        contiSnapshotUnsubscribe = null;
      }
      if (songSnapshotUnsubscribe) {
        songSnapshotUnsubscribe();
        songSnapshotUnsubscribe = null;
      }
      hide(els.pendingApprovalScreen);
      hide(els.orgOnboardingModal);
      if (els.orgAdminSection) hide(els.orgAdminSection);
      if (els.orgAdminSectionDivider) hide(els.orgAdminSectionDivider);
      state.currentUser = null;
      clearUserSession();
      updateAuthUI();
      renderContiListView();
      applyUIState();
    }
  });
}

/**
 * 로컬에만 존재하는 기존 콘티와 악보들을 Firestore 클라우드로 자동 일괄 업로드(마이그레이션)
 */
export async function syncAllLocalDataToCloud(orgId, user) {
  if (!orgId || !user) return;
  // [보안/격리] 일반 팀원(member)이나 테스트 계정은 로컬에 있는 악보/콘티를 자기 명의로 업로드(하이재킹)할 수 없음!
  // 오직 관리자(admin/인도자)만이 조직의 로컬 데이터를 클라우드로 마이그레이션할 권한을 가짐.
  if (user.role !== 'admin') {
    return;
  }

  const userEmail = (user.email || '').toLowerCase().trim();
  const userName = user.name || userEmail.split('@')[0];

  // 1. 로컬 콘티 및 콘티 내 악보 클라우드 분리 업로드
  const localContis = state.contis || [];
  let contisChanged = false;

  for (const c of localContis) {
    if (!c.orgId) {
      c.orgId = orgId;
      contisChanged = true;
    }
    // 관리자가 로그인했을 때 기존에 오염되었던 '테스트' 등록자나 비어있는 작성자를 관리자 실명으로 정상화
    if (!c.authorEmail || c.authorEmail === 'leader@continote.com' || c.authorName === '테스트') {
      c.authorEmail = userEmail;
      c.authorName = userName;
      contisChanged = true;
    }

    // 콘티에 속한 곡 이미지들을 songs 컬렉션에 독립 저장 (1MB 한도 방지)
    if (Array.isArray(c.songs)) {
      for (const s of c.songs) {
        if (s.image && !s._syncedToCloud) {
          try {
            const songAuthorEmail = (s.authorEmail && s.authorEmail !== 'leader@continote.com') ? s.authorEmail : (c.authorEmail || '');
            const songAuthorName = (s.authorName && s.authorName !== '인도자' && s.authorName !== '찬양인도자') ? s.authorName : (c.authorName || '인도자');
            await addSongMaster({
              id: s.id,
              orgId: orgId,
              title: s.name || '제목 없음',
              pHash: s.pHash || '',
              imageSource: s.image,
              initialKey: s.key || '',
              createdByUid: s.createdByUid || '',
              authorEmail: songAuthorEmail,
              authorName: songAuthorName,
              isShared: s.isShared !== undefined ? s.isShared : true,
              tempo: s.tempo || '',
              timeSig: s.timeSig || '4/4',
              themes: Array.isArray(s.themes) ? s.themes : [],
              songForm: Array.isArray(s.songform) ? s.songform : []
            });
            s._syncedToCloud = true;
          } catch (songErr) {
            console.warn(`[Firebase] 콘티 곡 '${s.name}' 악보 클라우드 업로드 대기:`, songErr);
          }
        }
      }
    }

    try {
      await saveContiSet({
        id: c.id,
        orgId: orgId,
        leaderUid: c.leaderUid || user.uid || '',
        leaderName: c.authorName || userName,
        leaderEmail: c.authorEmail || userEmail,
        authorEmail: c.authorEmail || userEmail,
        title: c.title,
        date: c.date,
        items: Array.isArray(c.songs) ? c.songs : [],
        memo: c.memo || '',
        sharedWith: Array.isArray(c.sharedWith) ? c.sharedWith : []
      });
    } catch (err) {
      console.warn(`[Firebase] 로컬 콘티 '${c.title}' 클라우드 업로드 실패:`, err);
    }
  }

  if (contisChanged) {
    await saveContis();
  }

  // 2. 로컬 마스터 악보 라이브러리 클라우드 업로드 (송폼 및 스티커 포함)
  const localSongs = state.allSongs || [];
  for (const s of localSongs) {
    if (s.image) {
      try {
        const stickers = state.stickersBySong[s.id] || (await loadStickers(s.id)) || [];
        // 이미 원작성자가 있다면 로그인 유저로 덮어쓰지 않고 원작성자 보존!
        const songAuthorEmail = (s.authorEmail && s.authorEmail !== 'leader@continote.com' && s.authorEmail.includes('@'))
          ? s.authorEmail
          : '';
        const songAuthorName = (s.authorName && s.authorName !== '인도자' && s.authorName !== '찬양인도자')
          ? s.authorName
          : '';

        await addSongMaster({
          id: s.id,
          orgId: orgId,
          title: s.name,
          pHash: s.pHash || '',
          imageSource: s.image,
          initialKey: s.key || '',
          createdByUid: s.createdByUid || '',
          authorEmail: songAuthorEmail,
          authorName: songAuthorName,
          isShared: s.isShared !== undefined ? s.isShared : true,
          songForm: Array.isArray(s.songform) ? s.songform : [],
          stickers: Array.isArray(stickers) ? stickers : [],
          tempo: s.tempo || '',
          timeSig: s.timeSig || '4/4',
          themes: Array.isArray(s.themes) ? s.themes : []
        });
        s._syncedToCloud = true;
      } catch (err) {
        console.warn(`[Firebase] 로컬 악보 '${s.name}' 클라우드 업로드 대기:`, err);
      }
    }
  }
}

/**
 * Firestore 클라우드 콘티 변경 사항을 로컬 상태와 병합하고 화면 갱신
 */
export async function handleCloudContisUpdate(cloudContis, isFullOrgSync = false) {
  if (!Array.isArray(cloudContis) || cloudContis.length === 0) return false;
  const localContiMap = new Map((state.contis || []).map(c => [c.id, c]));
  const libMap = new Map((state.allSongs || []).map(s => [s.id, s]));
  let hasChanges = false;
  let currentContiSongsUpdated = false;

  cloudContis.forEach(cc => {
    const existing = localContiMap.get(cc.id);
    const cloudItems = Array.isArray(cc.items) ? cc.items : (Array.isArray(cc.songs) ? cc.songs : []);

    if (existing) {
      const prevSongs = existing.songs || [];
      const existingSongMap = new Map(prevSongs.map(s => [s.id, s]));

      const mappedSongs = cloudItems.map(item => {
        const songKey = generateSongKey(item.name || item.title, item.key);
        const localSong = existingSongMap.get(item.id) || prevSongs.find(s => generateSongKey(s.name, s.key) === songKey);
        const songMasterId = item.songId || item.masterSongId || item.id;
        const libSong = libMap.get(songMasterId) || libMap.get(item.id) || Array.from(libMap.values()).find(s => generateSongKey(s.name, s.key) === songKey);
        const st = (Array.isArray(item.stickers) && item.stickers.length > 0)
          ? item.stickers
          : (localSong?.stickers || state.stickersBySong[item.id] || []);
        if (st.length > 0) {
          state.stickersBySong[item.id] = st;
        }

        // 송폼 보존: 원격에 유효한 송폼이 있으면 우선 적용, 없으면 기존 로컬 콘티 곡의 송폼, 없으면 마스터 보관함 송폼
        const songform = (Array.isArray(item.songform) && item.songform.length > 0)
          ? item.songform
          : ((Array.isArray(localSong?.songform) && localSong.songform.length > 0)
              ? localSong.songform
              : (Array.isArray(libSong?.songform) ? libSong.songform : []));

        const tempo = item.tempo || localSong?.tempo || libSong?.tempo || '';
        const timeSig = item.timeSig || localSong?.timeSig || libSong?.timeSig || '4/4';
        const key = item.key || localSong?.key || libSong?.key || '';
        const name = item.name || item.title || localSong?.name || libSong?.name || '제목 없음';
        const themes = (Array.isArray(item.themes) && item.themes.length > 0)
          ? item.themes
          : (localSong?.themes || libSong?.themes || []);

        // [악보 이미지 유실 방지 방어벽] 원격 메타데이터에 이미지가 없어도 로컬의 기존 이미지를 100% 사수
        const preservedImage = item.image || localSong?.image || libSong?.image || '';
        const preservedOriginal = item.original || localSong?.original || libSong?.original || preservedImage;

        return {
          ...(localSong || {}),
          ...item,
          masterSongId: songMasterId || localSong?.masterSongId || libSong?.id || item.id,
          name,
          key,
          tempo,
          timeSig,
          themes,
          songform,
          stickers: st,
          image: preservedImage,
          original: preservedOriginal
        };
      });

      // [리드 시트 보존 방어벽] 원격 목록에 리드 시트가 누락된 경우 기존 로컬 리드 시트 순서 보존 병합
      const localLeadSheets = prevSongs.filter(s => s.isLeadSheet && !mappedSongs.some(m => m.id === s.id));
      if (localLeadSheets.length > 0) {
        localLeadSheets.forEach(ls => {
          const insertIdx = (typeof ls.order === 'number' && ls.order <= mappedSongs.length) ? ls.order : mappedSongs.length;
          mappedSongs.splice(insertIdx, 0, ls);
        });
      }

      // 변경 사항 감지 (곡 수, 곡 식별자, 순서, 송폼, 제목, 날짜, 메모)
      const songsChanged = (prevSongs.length !== mappedSongs.length) ||
        mappedSongs.some((s, idx) => {
          const p = prevSongs[idx];
          return !p || p.id !== s.id || p.order !== s.order || p.name !== s.name || p.key !== s.key ||
                 p.tempo !== s.tempo || JSON.stringify(p.songform || []) !== JSON.stringify(s.songform || []);
        });

      if (songsChanged || existing.title !== cc.title || existing.date !== cc.date || existing.memo !== cc.memo) {
        hasChanges = true;
      }

      existing.title = cc.title || existing.title;
      existing.date = cc.date || existing.date;
      existing.memo = cc.memo || existing.memo;
      existing.authorEmail = cc.leaderEmail || cc.authorEmail || existing.authorEmail;
      existing.authorName = cc.leaderName || existing.authorName;
      existing.sharedWith = Array.isArray(cc.sharedWith) ? cc.sharedWith : (existing.sharedWith || []);
      existing.orgId = cc.orgId || existing.orgId;
      existing.songs = mappedSongs;
      existing.songCount = mappedSongs.length;
      existing.updatedAt = cc.updatedAt?.toMillis ? cc.updatedAt.toMillis() : Date.now();

      if (state.currentContiId === cc.id && songsChanged) {
        state.songs = mappedSongs;
        currentContiSongsUpdated = true;
      }
    } else {
      const mappedSongs = cloudItems.map(item => {
        const songKey = generateSongKey(item.name || item.title, item.key);
        const songMasterId = item.songId || item.masterSongId || item.id;
        const libSong = libMap.get(songMasterId) || libMap.get(item.id) || Array.from(libMap.values()).find(s => generateSongKey(s.name, s.key) === songKey);
        const st = (Array.isArray(item.stickers) && item.stickers.length > 0)
          ? item.stickers
          : (state.stickersBySong[item.id] || []);
        if (st.length > 0) {
          state.stickersBySong[item.id] = st;
        }

        const songform = (Array.isArray(item.songform) && item.songform.length > 0)
          ? item.songform
          : (Array.isArray(libSong?.songform) ? libSong.songform : []);
        const tempo = item.tempo || libSong?.tempo || '';
        const timeSig = item.timeSig || libSong?.timeSig || '4/4';
        const key = item.key || libSong?.key || '';
        const name = item.name || item.title || libSong?.name || '제목 없음';
        const themes = (Array.isArray(item.themes) && item.themes.length > 0)
          ? item.themes
          : (libSong?.themes || []);

        // [악보 이미지 유실 방지 방어벽]
        const preservedImage = item.image || libSong?.image || '';
        const preservedOriginal = item.original || libSong?.original || preservedImage;

        return {
          ...item,
          masterSongId: songMasterId || libSong?.id || item.id,
          name,
          key,
          tempo,
          timeSig,
          themes,
          songform,
          stickers: st,
          image: preservedImage,
          original: preservedOriginal
        };
      });

      localContiMap.set(cc.id, {
        id: cc.id,
        title: cc.title || '새 콘티',
        date: cc.date || '',
        memo: cc.memo || '',
        authorEmail: cc.leaderEmail || cc.authorEmail || '',
        authorName: cc.leaderName || '인도자',
        sharedWith: Array.isArray(cc.sharedWith) ? cc.sharedWith : [],
        sessions: cc.sessions || [],
        songs: mappedSongs,
        songCount: mappedSongs.length,
        orgId: cc.orgId,
        createdAt: cc.createdAt?.toMillis ? cc.createdAt.toMillis() : Date.now(),
        updatedAt: cc.updatedAt?.toMillis ? cc.updatedAt.toMillis() : Date.now()
      });
      hasChanges = true;
    }
  });

  if (hasChanges) {
    state.contis = Array.from(localContiMap.values());
    state.contis.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    await saveContis();

    if (state.viewLevel === 'contiList') {
      renderContiListView();
    }
    if (state.viewLevel === 'songList' && currentContiSongsUpdated) {
      renderSongListView();
      hydrateContiSongImages(state.songs).then(hydrated => {
        if (hydrated && state.viewLevel === 'songList') renderSongListView();
      });
    } else if (state.viewLevel === 'viewer' && currentContiSongsUpdated) {
      renderAll();
      hydrateContiSongImages(state.songs).then(hydrated => {
        if (hydrated && state.viewLevel === 'viewer') renderAll();
      });
    }
  }
  return hasChanges;
}

/**
 * Firestore 클라우드 콘티 목록을 로컬과 병합
 */
export async function syncCloudContis(orgId, userEmail = '') {
  if (!orgId) return;
  try {
    const cloudContis = await getOrganizationContis(orgId, userEmail);
    if (cloudContis && cloudContis.length > 0) {
      await handleCloudContisUpdate(cloudContis);
    }
  } catch (err) {
    console.warn('[Firebase] 콘티 목록 클라우드 동기화 실패:', err);
  }
}

/**
 * Firestore 클라우드 마스터 악보 목록 업데이트를 로컬 state 및 IndexedDB와 병합
 */
export async function handleCloudSongsUpdate(cloudSongs) {
  if (!Array.isArray(cloudSongs) || cloudSongs.length === 0) return;
  try {
    const localMap = new Map((state.allSongs || []).map(s => [s.id, s]));
    let hasChanges = false;
    let currentContiSongsUpdated = false;

    for (const cs of cloudSongs) {
      const songKey = generateSongKey(cs.title, cs.initialKey || cs.key || '');
      // 1순위: cs.id로 찾기, 2순위: 동일 곡명+코드(songKey)로 찾기
      const existing = localMap.get(cs.id) || Array.from(localMap.values()).find(s => generateSongKey(s.name, s.key) === songKey);
      const sf = Array.isArray(cs.songForm) ? cs.songForm : (Array.isArray(cs.songform) ? cs.songform : []);
      const st = Array.isArray(cs.stickers) ? cs.stickers : [];
      const remoteUpdatedAt = cs.updatedAt?.toMillis ? cs.updatedAt.toMillis() : (typeof cs.updatedAt === 'number' ? cs.updatedAt : (cs.createdAt?.toMillis ? cs.createdAt.toMillis() : 0));

      if (existing) {
        let changed = false;
        existing.songKey = songKey;
        if (cs.title && existing.name !== cs.title) { existing.name = cs.title; changed = true; }
        if (cs.imageData && existing.image !== cs.imageData) { existing.image = cs.imageData; changed = true; }
        if (cs.initialKey !== undefined && existing.key !== cs.initialKey) { existing.key = cs.initialKey; changed = true; }
        if (cs.tempo && existing.tempo !== cs.tempo) { existing.tempo = cs.tempo; changed = true; }
        if (cs.timeSig && existing.timeSig !== cs.timeSig) { existing.timeSig = cs.timeSig; changed = true; }
        if (Array.isArray(cs.themes) && cs.themes.length > 0) {
          const prevThemes = existing.themes || [];
          if (prevThemes.length !== cs.themes.length || prevThemes.some((t, i) => t !== cs.themes[i])) {
            existing.themes = cs.themes;
            changed = true;
          }
        }
        if (cs.authorName && existing.authorName !== cs.authorName) {
          existing.authorName = cs.authorName;
          changed = true;
        }
        if (cs.authorEmail && existing.authorEmail !== cs.authorEmail) {
          existing.authorEmail = cs.authorEmail;
          changed = true;
        }
        if (cs.isShared !== undefined && existing.isShared !== cs.isShared) {
          existing.isShared = cs.isShared;
          changed = true;
        }
        // 송폼 동기화 (원격에 송폼이 있고 로컬과 다른 경우에만 갱신)
        if (sf.length > 0) {
          const prevSf = existing.songform || [];
          const sfChanged = (prevSf.length !== sf.length) || prevSf.some((step, i) => step !== sf[i]);
          if (sfChanged) {
            existing.songform = sf;
            changed = true;
          }
        }
        if (st.length > 0) {
          state.stickersBySong[cs.id] = st;
          await saveStickers(cs.id);
        }
        if (changed) {
          existing.updatedAt = remoteUpdatedAt || Date.now();
          await saveLibrarySong(existing);
          hasChanges = true;

          // 현재 열려 있는 콘티 곡 목록 중 해당 마스터 악보를 참조하는 곡들도 안전하게 보완 동기화
          if (Array.isArray(state.songs)) {
            state.songs.forEach(s => {
              const isMatch = s.id === cs.id || s.songId === cs.id || s.masterSongId === cs.id;
              if (isMatch) {
                if (!s.key && existing.key) s.key = existing.key;
                if (!s.tempo && existing.tempo) s.tempo = existing.tempo;
                if (!s.timeSig && existing.timeSig) s.timeSig = existing.timeSig;
                if ((!s.themes || s.themes.length === 0) && existing.themes) s.themes = existing.themes;
                // 콘티 곡에 이미 송폼 순서가 정의되어 있다면 콘티 송폼 순서를 절대 파괴하지 않음!
                if ((!s.songform || s.songform.length === 0) && Array.isArray(existing.songform) && existing.songform.length > 0) {
                  s.songform = [...existing.songform];
                }
                if (existing.authorName) s.authorName = existing.authorName;
                if (existing.authorEmail) s.authorEmail = existing.authorEmail;
                if (existing.isShared !== undefined) s.isShared = existing.isShared;
                currentContiSongsUpdated = true;
              }
            });
          }
        }
      } else {
        const newLibSong = {
          id: cs.id,
          name: cs.title || '제목 없음',
          image: cs.imageData || '',
          original: cs.imageData || '',
          key: cs.initialKey || '',
          songKey: songKey,
          tempo: cs.tempo || '',
          timeSig: cs.timeSig || '4/4',
          pHash: cs.pHash || '',
          themes: Array.isArray(cs.themes) ? cs.themes : [],
          order: 0,
          songform: sf,
          authorName: cs.authorName || '',
          authorEmail: cs.authorEmail || '',
          isShared: cs.isShared !== undefined ? Boolean(cs.isShared) : true,
          createdAt: cs.createdAt?.toMillis ? cs.createdAt.toMillis() : Date.now(),
          updatedAt: remoteUpdatedAt || Date.now()
        };
        if (st.length > 0) {
          state.stickersBySong[cs.id] = st;
          await saveStickers(cs.id);
        }
        localMap.set(cs.id, newLibSong);
        await saveLibrarySong(newLibSong);
        hasChanges = true;
      }
    }

    // 중복 곡 자동 병합 및 정리
    await deduplicateLibrarySongs();

    if (hasChanges) {
      if (state.viewLevel === 'songLibrary') {
        renderSongLibraryView();
      }
      if (currentContiSongsUpdated) {
        await saveSongs();
        if (state.viewLevel === 'songList') {
          renderSongListView();
        } else if (state.viewLevel === 'viewer') {
          renderAll();
        }
      }
    }
  } catch (err) {
    console.warn('[Firebase] 마스터 악보 라이브러리 병합 실패:', err);
  }
}

/**
 * 소속 교회의 마스터 악보 목록을 Firestore에서 불러와 로컬 라이브러리와 동기화
 */
export async function syncCloudSongs(orgId) {
  if (!orgId) return;
  try {
    const cloudSongs = await getOrganizationSongs(orgId);
    if (cloudSongs && cloudSongs.length > 0) {
      await handleCloudSongsUpdate(cloudSongs);
    }
  } catch (err) {
    console.warn('[Firebase] 악보 라이브러리 클라우드 동기화 실패:', err);
  }
}

/**
 * 단일 콘티를 Firestore 클라우드에 백그라운드 동기화 (곡 이미지 분리 저장 보장)
 */
export function syncContiToFirestore(conti) {
  if (!conti || !state.currentUser?.orgId) return;
  conti.orgId = state.currentUser.orgId;
  const authorEmail = (conti.authorEmail || state.currentUser.email || '').toLowerCase().trim();

  // 콘티 내 곡들의 이미지도 addSongMaster로 백그라운드 업로드
  if (Array.isArray(conti.songs)) {
    for (const s of conti.songs) {
      if (s.image && !s._syncedToCloud) {
        const masterId = s.songId || s.masterSongId || s.id;
        addSongMaster({
          id: masterId,
          orgId: state.currentUser.orgId,
          title: s.name || '제목 없음',
          pHash: s.pHash || '',
          imageSource: s.image,
          initialKey: s.key || '',
          createdByUid: state.currentUser.uid || '',
          authorEmail: s.authorEmail || authorEmail,
          authorName: s.authorName || conti.authorName || state.currentUser?.name || '인도자',
          isShared: s.isShared !== undefined ? s.isShared : true,
          tempo: s.tempo || '',
          timeSig: s.timeSig || '4/4',
          themes: Array.isArray(s.themes) ? s.themes : [],
          songForm: Array.isArray(s.songform) ? s.songform : []
        }).then(() => { s._syncedToCloud = true; })
          .catch(e => console.warn('[Firebase] 곡 이미지 업로드 대기:', e));
      }
    }
  }

  // 콘티 내 곡 및 인도자 리드 시트(isLeadSheet) 포함 동기화 (팀원 뷰에서는 isLeadSheet가 UI 수준에서 격리 보호됨)
  const enrichedItems = (Array.isArray(conti.songs) ? conti.songs : [])
    .map(s => ({
      ...s,
      songId: s.songId || s.masterSongId || s.id,
      stickers: state.stickersBySong[s.id] || s.stickers || []
    }));

  saveContiSet({
    id: conti.id,
    orgId: state.currentUser.orgId,
    leaderUid: state.currentUser.uid || '',
    leaderName: conti.authorName || state.currentUser.name || '인도자',
    leaderEmail: authorEmail,
    authorEmail: authorEmail,
    title: conti.title,
    date: conti.date,
    items: enrichedItems,
    memo: conti.memo || '',
    sharedWith: Array.isArray(conti.sharedWith) ? conti.sharedWith : []
  }).catch(err => console.warn('[Firebase] 콘티 클라우드 저장 실패:', err));
}

/**
 * 콘티 곡 목록 중 이미지가 누락된 곡이 있으면 state.allSongs 또는 Firestore에서 지연 로딩 (Lazy Hydration)
 */
export async function hydrateContiSongImages(songs) {
  if (!Array.isArray(songs) || songs.length === 0) return false;
  const missing = songs.filter(s => !s.image && !s.isLeadSheet);
  if (missing.length === 0) return false;

  const libMap = new Map((state.allSongs || []).map(s => [s.id, s]));
  let hasChanges = false;

  for (const s of missing) {
    const songIdToFind = s.songId || s.masterSongId || s.id;
    const songKey = generateSongKey(s.name, s.key);

    // 1) 로컬 라이브러리 캐시 확인 (ID 또는 SongKey 곡명+코드 조합)
    const libSong = libMap.get(songIdToFind) || libMap.get(s.id) || Array.from(libMap.values()).find(ls => generateSongKey(ls.name, ls.key) === songKey);
    if (libSong && libSong.image) {
      s.image = libSong.image;
      s.original = libSong.original || libSong.image;
      if (!s.masterSongId) s.masterSongId = libSong.id;
      hasChanges = true;
      continue;
    }

    // 2) Firestore songs 컬렉션에서 다운로드
    try {
      let cloudSong = await getSongById(songIdToFind);
      if (!cloudSong && s.id !== songIdToFind) {
        cloudSong = await getSongById(s.id);
      }
      if (cloudSong && cloudSong.imageData) {
        s.image = cloudSong.imageData;
        s.original = cloudSong.imageData;
        hasChanges = true;
        // 라이브러리에도 캐싱
        await saveLibrarySong({
          id: cloudSong.id,
          name: cloudSong.title || s.name,
          image: cloudSong.imageData,
          original: cloudSong.imageData,
          key: cloudSong.initialKey || s.key || '',
          pHash: cloudSong.pHash || '',
          themes: s.themes || [],
          order: 0,
          songform: [],
          createdAt: Date.now()
        });
      }
    } catch (err) {
      console.warn(`[Firebase] 곡 '${s.name}' 악보 다운로드 대기:`, err);
    }
  }

  if (hasChanges) {
    await saveCurrentConti();
  }
  return hasChanges;
}

/* ==================================================
   [1단계] 콘티 목록 화면 (Conti List View)
   - 인도자: 로그인한 계정이 만든 콘티만 노출 및 수정/삭제/공유 가능!
   - 사용자: 내가 만든 콘티 + 나에게 공유된 콘티 노출
   ================================================== */
let editingContiId = null;
let sharingContiId = null;
const expandedContiGroups = new Set();

function getContiSongsPreview(conti, isLeader) {
  if (!conti || !Array.isArray(conti.songs) || conti.songs.length === 0) return '';
  const previewItems = [];
  let songSeq = 0;

  conti.songs.forEach(s => {
    if (s.isLeadSheet) {
      if (isLeader) {
        previewItems.push(`📝 ${s.name || '리드 시트'}`);
      }
    } else {
      songSeq++;
      previewItems.push(`${songSeq}. ${s.name || '제목 없음'}`);
    }
  });

  return previewItems.join(' | ');
}

function formatContiCardSummary(conti, isLeader) {
  const preview = getContiSongsPreview(conti, isLeader);
  const memo = (conti.memo || '').trim();

  // 1. 등록된 곡 목록이 있는 경우: 스마트 곡 순서 요약 적용 (리드 시트는 번호 제외, 곡만 1부터 번호)
  if (preview) {
    // 메모가 없거나, 메모 자체가 수동 곡 번호 텍스트('1. ...')인 경우 스마트 요약으로 정제 대체
    if (!memo || /^\s*\d+\.\s*/.test(memo)) {
      return `<p class="text-xs sm:text-sm mt-0.5 line-clamp-1" style="color:var(--text-dim)">${escapeHtml(preview)}</p>`;
    }
    // 별도의 전달사항 메모가 있는 경우 함께 깔끔하게 표시
    return `<p class="text-xs sm:text-sm mt-0.5 line-clamp-1" style="color:var(--text-dim)"><span class="font-medium text-amber-600 dark:text-amber-400">📝 ${escapeHtml(memo)}</span> <span class="opacity-40 mx-1">|</span> ${escapeHtml(preview)}</p>`;
  }

  // 2. 곡이 아직 없고 메모만 있는 경우
  if (memo) {
    return `<p class="text-xs sm:text-sm mt-0.5 line-clamp-1" style="color:var(--text-dim)">${escapeHtml(memo)}</p>`;
  }

  return '';
}

function createContiCardElement(conti, isLeader, myEmail) {
  const card = document.createElement('div');
  card.className = 'conti-card p-3 sm:p-3.5 rounded-2xl border transition-all active:scale-[0.99] cursor-pointer flex flex-col gap-1.5 shadow-sm hover:shadow-md';
  card.style.borderColor = 'var(--border)';
  card.style.backgroundColor = 'var(--surface)';

  const songCount = getContiSongCount(conti);
  const author = (conti.authorEmail || conti.leaderEmail || 'leader@continote.com').toLowerCase().trim();
  const isMine = author === myEmail;
  // 인도자 메뉴에서 내가 직접 등록한 콘티만 수정/공유/삭제 가능 (사용자 메뉴는 일체 관리 버튼 없음)
  const canManage = isLeader && isMine;

  // 등록자 표시 이름 계산 (가상 명칭 '찬양인도자' 배제 및 실제 구글 프로필 이름 반영)
  let authorDisplayName = conti.authorName;
  if (!authorDisplayName || authorDisplayName === '찬양인도자' || authorDisplayName === '인도자') {
    if (isMine && state.currentUser && state.currentUser.name && state.currentUser.name !== '찬양인도자') {
      authorDisplayName = state.currentUser.name;
    } else if (conti.authorEmail && conti.authorEmail.includes('@') && conti.authorEmail !== 'leader@continote.com') {
      authorDisplayName = conti.authorEmail.split('@')[0];
    } else {
      authorDisplayName = '인도자';
    }
  }

  card.innerHTML = `
    <!-- 상단 영역: 모바일에서는 2줄 (날짜 상단, 제목/버튼 하단), 태블릿 이상(sm:)에서는 1줄 인라인 ([날짜] [제목] ... [등록자] [버튼들]) -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 min-w-0">
      <!-- 좌측: 날짜칩 + 제목 (태블릿 이상에서 가로 나란히) -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
        ${conti.date ? `<span class="self-start sm:self-auto px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0 conti-date-chip select-none">${escapeHtml(conti.date)}</span>` : ''}
        <div class="min-w-0 flex-1">
          <h3 class="font-bold text-base sm:text-lg truncate">${escapeHtml(conti.title)}</h3>
          ${formatContiCardSummary(conti, isLeader)}
        </div>
      </div>

      <!-- 우측: 등록자 칩 및 기능 버튼들 -->
      <div class="flex items-center justify-between sm:justify-end gap-2 shrink-0">
        ${(!isLeader || !isMine) ? `
          <!-- 등록자: [이름] 칩 -->
          <span class="px-2.5 py-0.5 rounded-md text-xs font-semibold border shrink-0 flex items-center gap-1.5 shadow-2xs conti-date-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5 text-blue-500"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span style="color:var(--text-dim)">등록자:</span>
            <strong class="font-bold text-neutral-800 dark:text-neutral-100">${escapeHtml(authorDisplayName)}</strong>
          </span>
        ` : ''}
        ${canManage ? `
          <div class="shrink-0 flex items-center gap-1.5">
            <button data-edit-conti="${conti.id}" class="p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-bold border flex items-center gap-1 shrink-0 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all shadow-sm" style="border-color:var(--border);background:var(--surface-2);color:var(--text)" title="콘티 제목/날짜/메모 수정">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="w-3.5 h-3.5"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              <span class="hidden sm:inline">수정</span>
            </button>
            <button data-share-conti="${conti.id}" class="p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-bold border flex items-center gap-1 shrink-0 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all shadow-sm" style="border-color:var(--border);background:var(--surface-2);color:var(--text)" title="찬양팀원에게 공유">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="w-3.5 h-3.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
              <span class="hidden sm:inline">공유</span>
            </button>
            <button data-delete-conti="${conti.id}" class="p-1.5 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-95 transition-all shrink-0" title="콘티 삭제">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- 하단 줄: n곡 배지 (좌측) & 곡 목록 보기 (우측) -->
    <div class="pt-2 border-t flex items-center justify-between text-xs" style="border-color:var(--border)">
      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 high-contrast-chip">
        ${songCount}곡
      </span>
      <span class="font-bold shrink-0 flex items-center gap-1" style="color:var(--accent)">
        곡 목록 보기
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="w-3.5 h-3.5"><path d="m9 18 6-6-6-6"/></svg>
      </span>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.closest('[data-share-conti]') || e.target.closest('[data-edit-conti]') || e.target.closest('[data-delete-conti]')) {
      return;
    }
    openSongList(conti.id);
  });

  return card;
}

function createContiGroupCard(groupKey, titleText, countText, items, isLeader, myEmail) {
  const isExpanded = expandedContiGroups.has(groupKey);
  const container = document.createElement('div');
  container.className = 'conti-group-container flex flex-col gap-2 transition-all';

  const groupHeader = document.createElement('div');
  groupHeader.className = 'conti-group-header p-3 sm:p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-all active:scale-[0.99] select-none';
  groupHeader.style.borderColor = 'var(--border)';
  groupHeader.style.backgroundColor = 'var(--surface-2)';

  groupHeader.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0 flex-1">
      <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-xs" style="border-color:var(--border);background:var(--surface);color:var(--accent)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H8v20H6.5A2.5 2.5 0 0 1 4 19.5Z"/><path d="M8 2h4v20H8"/><path d="M12 2h3.5a2.5 2.5 0 0 1 2.5 2.5v15a2.5 2.5 0 0 1-2.5 2.5H12"/></svg>
      </div>
      <div class="min-w-0 flex items-center gap-2">
        <h4 class="font-bold text-sm sm:text-base truncate">${escapeHtml(titleText)}</h4>
        ${countText ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0" style="border-color:var(--border);background:var(--surface);color:var(--text-dim)">${escapeHtml(countText)}</span>` : ''}
      </div>
    </div>
    <button type="button" class="group-toggle-btn p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-bold border flex items-center gap-1 shrink-0 transition-all shadow-xs" style="border-color:var(--border);background:var(--surface);color:var(--accent)">
      <span class="btn-text hidden sm:inline">${isExpanded ? '접기' : '펼쳐보기'}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}"><path d="m6 9 6 6 6-6"/></svg>
    </button>
  `;

  const groupContent = document.createElement('div');
  groupContent.className = `conti-group-content flex-col gap-2 pl-2 sm:pl-3 border-l-2 ml-2 sm:ml-3 ${isExpanded ? 'flex' : 'hidden'}`;
  groupContent.style.borderColor = 'var(--border)';

  items.forEach(conti => {
    const cardEl = createContiCardElement(conti, isLeader, myEmail);
    groupContent.appendChild(cardEl);
  });

  groupHeader.addEventListener('click', () => {
    const btnText = groupHeader.querySelector('.btn-text');
    const btnSvg = groupHeader.querySelector('.group-toggle-btn svg');
    if (expandedContiGroups.has(groupKey)) {
      expandedContiGroups.delete(groupKey);
      groupContent.classList.remove('flex');
      groupContent.classList.add('hidden');
      if (btnText) btnText.textContent = '펼쳐보기';
      if (btnSvg) btnSvg.classList.remove('rotate-180');
    } else {
      expandedContiGroups.add(groupKey);
      groupContent.classList.remove('hidden');
      groupContent.classList.add('flex');
      if (btnText) btnText.textContent = '접기';
      if (btnSvg) btnSvg.classList.add('rotate-180');
    }
  });

  container.appendChild(groupHeader);
  container.appendChild(groupContent);
  return container;
}

export function renderContiListView() {
  if (state.viewLevel === 'contiList') {
    saveCurrentMenuSession();
  }
  if (!els.contiListContainer) return;
  els.contiListContainer.innerHTML = '';

  const isLoggedIn = Boolean(state.currentUser && state.currentUser.orgId && state.currentUser.status === 'approved');
  const isLeader = state.activeMenu === 'leader';
  const myEmail = (state.currentUser?.email || '').toLowerCase().trim();
  const myOrgId = state.currentUser?.orgId || '';
  const isAdmin = state.currentUser?.role === 'admin';

  // [Local-First UX] 비로그인 상태이면서 로컬 콘티도 전혀 없을 때만 로그인 안내 표시
  if (!isLoggedIn && (!state.contis || state.contis.length === 0)) {
    els.contiListContainer.innerHTML = `
      <div class="p-8 text-center rounded-2xl border flex flex-col items-center justify-center gap-2.5 my-4"
        style="border-color:var(--border);background:var(--surface)">
        <div class="w-12 h-12 rounded-full flex items-center justify-center" style="background:var(--surface-2);color:var(--accent)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-6 h-6">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M19 8v6M22 11h-6"/>
          </svg>
        </div>
        <p class="text-sm font-bold" style="color:var(--text)">로그인이 필요합니다</p>
        <p class="text-xs max-w-xs leading-relaxed" style="color:var(--text-dim)">
          우측 상단의 구글 로그인을 진행하시면 소속 교회의 찬양 콘티와 공유 악보를 확인하실 수 있습니다.
        </p>
      </div>
    `;
    hide(els.contiEmptyState);
    return;
  }

  // 계정 및 소속 교회별 콘티 필터링
  let contis = (state.contis || []).filter(c => {
    const author = (c.authorEmail || c.leaderEmail || '').toLowerCase().trim();
    // 비로그인 상태일 때는 게스트 콘티도 내 콘티로 취급하여 데이터 유실 체감 방지
    const isMine = myEmail ? (author === myEmail) : (!author || author === 'leader@continote.com' || author === 'guest');

    // [1] 인도자 메뉴: 내가 직접 작성/등록한 내 콘티 표시 (관리자는 소속 교회 전체 콘티 관리 지원)
    if (isLeader) {
      if (isAdmin && myOrgId && c.orgId === myOrgId) return true;
      return isMine;
    }

    // [2] 사용자(팀원) 메뉴: 소속 교회 전체 콘티 + 나에게 공유/배정된 콘티 + 내가 작성한 개인 콘티
    if (myOrgId && c.orgId === myOrgId) return true;
    if (isMine) return true;

    const isShared = (Array.isArray(c.sharedWith) && c.sharedWith.some(e => (e || '').toLowerCase().trim() === myEmail)) ||
      (Array.isArray(c.sessions) && c.sessions.some(s => (s.email || '').toLowerCase().trim() === myEmail));
    return isShared;
  });

  if (!contis.length) {
    if (els.contiEmptyState) {
      show(els.contiEmptyState, 'block');
      const titleEl = els.contiEmptyState.querySelector('p.font-bold');
      const descEl = els.contiEmptyState.querySelector('p.text-xs, p.text-sm');
      if (isLeader) {
        if (titleEl) titleEl.textContent = '내가 등록한 예배 콘티가 없습니다';
        if (descEl) descEl.textContent = '우측 상단 또는 아래 버튼을 눌러 새 콘티를 만들어보세요.';
        if (els.emptyContiCreateBtn) show(els.emptyContiCreateBtn, 'inline-flex');
      } else {
        if (titleEl) titleEl.textContent = '공유받은 예배 콘티가 없습니다';
        if (descEl) descEl.textContent = '인도자가 등록한 콘티 또는 나에게 공유된 콘티가 이곳에 표시됩니다.';
        if (els.emptyContiCreateBtn) hide(els.emptyContiCreateBtn);
      }
    }
    return;
  }
  hide(els.contiEmptyState);

  // 날짜 내림차순 정렬 (최신 날짜가 위로)
  const getContiTime = (c) => {
    if (c.date) {
      const t = new Date(c.date).getTime();
      if (!isNaN(t)) return t;
    }
    if (c.createdAt) {
      const t = new Date(c.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };
  const sortedContis = [...contis].sort((a, b) => getContiTime(b) - getContiTime(a));

  const now = new Date();
  const currentYear = now.getFullYear();

  // 최근 3개 달(Calendar Month: YYYY-MM) 계산
  const recentMonths = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    recentMonths.push(`${yyyy}-${mm}`);
  }

  // 그룹 분할
  // 1순위: 최근 3개월에 속하거나 당해 연도(올해)인 콘티 (묶지 않고 개별 카드로 항상 펼침)
  const recentList = [];
  // 2순위: 이전 3개년도별 (currentYear - 1, currentYear - 2, currentYear - 3)
  const yearGroupMap = new Map();
  // 3순위: 그 이전 (currentYear - 4 이하)
  const ancientList = [];

  sortedContis.forEach(c => {
    let year = null;
    let monthKey = null;

    if (c.date && /^\d{4}-\d{2}/.test(c.date)) {
      year = parseInt(c.date.slice(0, 4), 10);
      monthKey = c.date.slice(0, 7);
    } else if (c.createdAt && /^\d{4}-\d{2}/.test(c.createdAt)) {
      year = parseInt(c.createdAt.slice(0, 4), 10);
      monthKey = c.createdAt.slice(0, 7);
    }

    // 최근 3개 역월에 포함되거나, 당해 연도이거나, 날짜가 없는 경우 -> 최근 목록으로 항상 펼침
    if ((monthKey && recentMonths.includes(monthKey)) || year === currentYear || year === null) {
      recentList.push(c);
      return;
    }

    const diff = currentYear - year;
    if (diff >= 1 && diff <= 3) {
      if (!yearGroupMap.has(year)) {
        yearGroupMap.set(year, []);
      }
      yearGroupMap.get(year).push(c);
      return;
    }

    ancientList.push(c);
  });

  // 1. 최근 콘티 카드 렌더링
  recentList.forEach(conti => {
    const card = createContiCardElement(conti, isLeader, myEmail);
    els.contiListContainer.appendChild(card);
  });

  // 2. 전년도 이전 3개년도별 묶음 카드 (YYYY년도 (N개))
  for (let i = 1; i <= 3; i++) {
    const yr = currentYear - i;
    const items = yearGroupMap.get(yr);
    if (items && items.length > 0) {
      const groupCard = createContiGroupCard(
        `year-${yr}`,
        `${yr}년도`,
        `${items.length}개`,
        items,
        isLeader,
        myEmail
      );
      els.contiListContainer.appendChild(groupCard);
    }
  }

  // 3. 4개년 이전 콘티 묶음 카드 ('이전', 개수 파악 불필요)
  if (ancientList.length > 0) {
    const ancientCard = createContiGroupCard(
      'ancient',
      '이전',
      '',
      ancientList,
      isLeader,
      myEmail
    );
    els.contiListContainer.appendChild(ancientCard);
  }

  // 버튼 이벤트 연결 (전체 컨테이너 내의 수정/공유/삭제 버튼)
  els.contiListContainer.querySelectorAll('[data-share-conti]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openShareModal(btn.dataset.shareConti);
    });
  });

  els.contiListContainer.querySelectorAll('[data-edit-conti]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openContiModal(btn.dataset.editConti);
    });
  });

  els.contiListContainer.querySelectorAll('[data-delete-conti]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.deleteConti;
      const target = state.contis.find(c => c.id === id);
      if (!confirm(`'${target?.title || '콘티'}'를 완전히 삭제하시겠습니까?`)) return;
      await deleteConti(id);
      if (state.currentUser?.orgId) {
        deleteContiSet(id);
      }
      if (hasDriveAuth()) {
        await deleteContiFileFromDrive(id);
        await syncContisIndexToDrive(state.contis, true);
      }
      if (state.currentContiId === id) {
        state.currentContiId = null;
        state.songs = [];
      }
      if (menuSessions.user.currentContiId === id) {
        menuSessions.user.viewLevel = 'contiList';
        menuSessions.user.currentContiId = null;
      }
      if (menuSessions.leader.currentContiId === id) {
        menuSessions.leader.viewLevel = 'contiList';
        menuSessions.leader.currentContiId = null;
      }
      renderContiListView();
    });
  });
}

const DEFAULT_SESSION_ROLES = ['건반', '일렉기타', '기타', '베이스', '드럼', '싱어'];
const SESSION_ICONS = {
  '건반': '🎹',
  '일렉기타': '🎸',
  '기타': '🎸',
  '베이스': '🎸',
  '드럼': '🥁',
  '싱어': '🎤'
};

function renderContiSessionRow(session = {}) {
  if (!els.contiSessionList) return;
  const row = document.createElement('div');
  row.className = 'flex items-center gap-1.5 p-1.5 rounded-xl border transition-all';
  row.style.borderColor = 'var(--border)';
  row.style.background = 'var(--surface-2)';

  // 1. 세션 역할 선택 (드롭다운)
  const roleSelect = document.createElement('select');
  roleSelect.className = 'px-2 py-1.5 rounded-lg border text-xs font-semibold outline-none shrink-0 cursor-pointer';
  roleSelect.style.borderColor = 'var(--border)';
  roleSelect.style.background = 'var(--surface)';
  roleSelect.style.color = 'var(--text)';

  DEFAULT_SESSION_ROLES.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = `${SESSION_ICONS[r] || '🎵'} ${r}`;
    if (session.role === r) opt.selected = true;
    roleSelect.appendChild(opt);
  });
  if (session.role && !DEFAULT_SESSION_ROLES.includes(session.role)) {
    const customOpt = document.createElement('option');
    customOpt.value = session.role;
    customOpt.textContent = `🎵 ${session.role}`;
    customOpt.selected = true;
    roleSelect.appendChild(customOpt);
  }

  // 2. 팀원 선택 (드롭다운)
  const memberSelect = document.createElement('select');
  memberSelect.className = 'flex-1 px-2 py-1.5 rounded-lg border text-xs font-semibold outline-none min-w-0 cursor-pointer';
  memberSelect.style.borderColor = 'var(--border)';
  memberSelect.style.background = 'var(--surface)';
  memberSelect.style.color = 'var(--text)';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = '팀원 선택...';
  memberSelect.appendChild(defaultOpt);

  const members = [...(state.teamMembers || [])];
  if (state.currentUser && state.currentUser.email && state.currentUser.email !== 'leader@continote.com') {
    const curEmail = state.currentUser.email.toLowerCase();
    if (!members.some(m => m.email && m.email.toLowerCase() === curEmail)) {
      members.unshift({
        name: state.currentUser.name || curEmail.split('@')[0],
        email: state.currentUser.email,
        picture: state.currentUser.picture || ''
      });
    }
  }

  let foundSelected = false;

  members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.email;
    opt.dataset.name = m.name;
    const shortId = m.email ? m.email.split('@')[0] : '';
    opt.textContent = `${m.name}${shortId ? ` (${shortId})` : ''}`;
    if (session.email && m.email && session.email.toLowerCase() === m.email.toLowerCase()) {
      opt.selected = true;
      foundSelected = true;
    }
    memberSelect.appendChild(opt);
  });

  // 콘티에 이미 고정(FIX)된 팀원인데 현재 DB에 없는 경우에도 보존
  if (session.name && (!foundSelected || !session.email)) {
    const fixOpt = document.createElement('option');
    fixOpt.value = session.email || '';
    fixOpt.dataset.name = session.name;
    const shortId = session.email ? session.email.split('@')[0] : '';
    fixOpt.textContent = `${session.name}${shortId ? ` (${shortId})` : ''}`;
    fixOpt.selected = true;
    memberSelect.appendChild(fixOpt);
  }

  // 3. 행 삭제 버튼
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'p-1.5 rounded-lg hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/5 font-bold text-xs shrink-0 transition-colors';
  delBtn.style.color = 'var(--text-dim)';
  delBtn.title = '세션 삭제';
  delBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="w-4 h-4">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  `;
  delBtn.addEventListener('click', () => row.remove());

  row.appendChild(roleSelect);
  row.appendChild(memberSelect);
  row.appendChild(delBtn);

  row.dataset.sessionRow = 'true';
  els.contiSessionList.appendChild(row);
}

async function openContiModal(contiId = null) {
  editingContiId = contiId;
  if (els.contiSessionList) els.contiSessionList.innerHTML = '';

  // 소속 조직(교회)의 승인된 팀원 명단을 불러와서 세션 드롭다운에 자동 반영
  if (state.currentUser?.orgId) {
    try {
      const approved = await getApprovedMembers(state.currentUser.orgId);
      if (Array.isArray(approved) && approved.length > 0) {
        const existingMap = new Map((state.teamMembers || []).map(m => [(m.email || '').toLowerCase(), m]));
        approved.forEach(u => {
          const emailKey = (u.email || '').toLowerCase();
          if (emailKey && !existingMap.has(emailKey)) {
            existingMap.set(emailKey, {
              name: u.name || emailKey.split('@')[0],
              email: u.email,
              picture: u.picture || ''
            });
          }
        });
        state.teamMembers = Array.from(existingMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      }
    } catch (err) {
      console.warn('[Session] 조직 팀원 명단 조회 대기:', err);
    }
  }

  if (contiId) {
    const c = state.contis.find(item => item.id === contiId);
    els.contiModalTitle.textContent = '예배 콘티 수정';
    els.contiTitleInput.value = c?.title || '';
    els.contiDateInput.value = c?.date || '';
    els.contiMemoInput.value = c?.memo || '';
    if (Array.isArray(c?.sessions) && c.sessions.length > 0) {
      c.sessions.forEach(s => renderContiSessionRow(s));
    }
  } else {
    els.contiModalTitle.textContent = '새 예배 콘티';
    els.contiTitleInput.value = '';
    els.contiDateInput.value = new Date().toISOString().slice(0, 10);
    els.contiMemoInput.value = '';
  }
  show(els.contiModal, 'flex');
  setTimeout(() => els.contiTitleInput.focus(), 100);
}

/* ==================================================
   콘티 공유 모달 관리
   ================================================== */
let orgApprovedMembers = [];

async function openShareModal(contiId) {
  sharingContiId = contiId;
  const conti = state.contis.find(c => c.id === contiId);
  if (!conti) return;

  if (els.shareContiTitle) els.shareContiTitle.textContent = conti.title;
  if (els.shareEmailInput) els.shareEmailInput.value = '';
  if (els.shareMemberSearchInput) els.shareMemberSearchInput.value = '';

  renderShareEmailList();
  show(els.shareModal, 'flex');

  // 팀원 검색창 이벤트 (1회 바인딩)
  if (els.shareMemberSearchInput && !els.shareMemberSearchInput.dataset.bound) {
    els.shareMemberSearchInput.dataset.bound = 'true';
    els.shareMemberSearchInput.addEventListener('input', (e) => {
      renderShareOrgMemberList(e.target.value);
    });
  }

  // 소속 교회 팀원 목록 조회
  if (state.currentUser?.orgId) {
    if (els.shareOrgMemberList) {
      els.shareOrgMemberList.innerHTML = '<div class="text-center py-4 text-xs" style="color:var(--text-dim)">팀원 목록을 불러오는 중...</div>';
    }
    try {
      orgApprovedMembers = await getApprovedMembers(state.currentUser.orgId);
      renderShareOrgMemberList();
    } catch (err) {
      console.warn('팀원 목록 불러오기 실패:', err);
      if (els.shareOrgMemberList) {
        els.shareOrgMemberList.innerHTML = '<div class="text-center py-4 text-xs text-red-500">팀원 목록을 불러오지 못했습니다</div>';
      }
    }
  } else {
    if (els.shareOrgMemberList) {
      els.shareOrgMemberList.innerHTML = '<div class="text-center py-4 text-xs" style="color:var(--text-dim)">소속 교회에 등록된 팀원이 없습니다</div>';
    }
  }
}

function renderShareOrgMemberList(filterText = '') {
  if (!els.shareOrgMemberList) return;
  const conti = state.contis.find(c => c.id === sharingContiId);
  if (!conti) return;

  const currentShared = (conti.sharedWith || []).map(e => (e || '').toLowerCase().trim());
  const query = filterText.toLowerCase().trim();
  const myEmail = (state.currentUser?.email || '').toLowerCase().trim();

  // 본인(인도자/작성자)을 제외한 소속 찬양팀원 목록
  const otherMembers = orgApprovedMembers.filter(m => {
    const mEmail = (m.email || '').toLowerCase().trim();
    return !myEmail || mEmail !== myEmail;
  });

  // 검색어 필터링
  const filtered = otherMembers.filter(m => {
    if (!query) return true;
    const nameMatch = (m.displayName || '').toLowerCase().includes(query);
    const emailMatch = (m.email || '').toLowerCase().includes(query);
    return nameMatch || emailMatch;
  });

  if (els.shareOrgMemberCount) {
    els.shareOrgMemberCount.textContent = `${otherMembers.length}명 중 ${filtered.length}명`;
  }

  if (filtered.length === 0) {
    els.shareOrgMemberList.innerHTML = `<div class="text-center py-4 text-xs" style="color:var(--text-dim)">${query ? '검색된 팀원이 없습니다' : '승인된 찬양팀원이 없습니다'}</div>`;
    return;
  }

  els.shareOrgMemberList.innerHTML = '';
  filtered.forEach(m => {
    const isShared = currentShared.includes((m.email || '').toLowerCase().trim());
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-2 p-1.5 px-2 rounded-xl transition-all border';
    row.style.borderColor = isShared ? 'var(--accent)' : 'var(--border)';
    row.style.background = isShared ? 'rgba(79, 70, 229, 0.08)' : 'var(--surface)';

    const defaultAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9CA3AF">
        <path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clip-rule="evenodd" />
      </svg>
    `)}`;

    row.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <img src="${escapeHtml(m.photoURL || defaultAvatar)}" class="w-6 h-6 rounded-full object-cover shrink-0 border"
          style="border-color:var(--border)" onerror="this.src='${defaultAvatar}'" />
        <div class="min-w-0">
          <p class="text-xs font-bold truncate leading-tight">${escapeHtml(m.displayName || m.email?.split('@')[0] || '팀원')}</p>
          <p class="text-[10px] truncate leading-tight" style="color:var(--text-dim)">${escapeHtml(m.email || '')}</p>
        </div>
      </div>
      <button data-toggle-member="${escapeHtml(m.email)}"
        class="px-2 py-1 rounded-lg text-xs font-bold shrink-0 transition-all active:scale-95 shadow-sm"
        style="${isShared ? 'background:var(--accent);color:#fff' : 'border:1px solid var(--border);color:var(--text);background:var(--surface)'}">
        ${isShared ? '✓ 공유됨' : '+ 공유'}
      </button>
    `;

    const toggleBtn = row.querySelector('[data-toggle-member]');
    toggleBtn.addEventListener('click', async () => {
      await toggleShareMember(m.email);
    });

    els.shareOrgMemberList.appendChild(row);
  });
}

async function toggleShareMember(email) {
  if (!email) return;
  const conti = state.contis.find(c => c.id === sharingContiId);
  if (!conti) return;

  if (!Array.isArray(conti.sharedWith)) conti.sharedWith = [];
  const targetEmail = email.toLowerCase().trim();
  const existingIdx = conti.sharedWith.findIndex(e => (e || '').toLowerCase().trim() === targetEmail);

  if (existingIdx >= 0) {
    conti.sharedWith.splice(existingIdx, 1);
  } else {
    conti.sharedWith.push(targetEmail);
  }

  await saveContis();
  syncContiToFirestore(conti);
  renderShareEmailList();
  renderShareOrgMemberList(els.shareMemberSearchInput?.value || '');
}

function renderShareEmailList() {
  const conti = state.contis.find(c => c.id === sharingContiId);
  if (!conti) return;
  els.shareEmailList.innerHTML = '';
  const list = conti.sharedWith || [];
  if (!list.length) {
    els.shareEmailList.innerHTML = `<span class="text-xs" style="color:var(--text-dim)">공유된 찬양팀원이 없습니다</span>`;
    return;
  }
  list.forEach((email, idx) => {
    const member = orgApprovedMembers.find(m => (m.email || '').toLowerCase().trim() === (email || '').toLowerCase().trim());
    const label = member ? `${member.displayName || member.email.split('@')[0]}` : email;

    const chip = document.createElement('span');
    chip.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm';
    chip.style.borderColor = 'var(--accent)';
    chip.style.backgroundColor = 'var(--surface)';
    chip.title = email;
    chip.innerHTML = `
      <span class="truncate max-w-[150px]">${escapeHtml(label)}</span>
      <button data-remove-share="${idx}" class="text-neutral-400 hover:text-red-500 font-bold ml-0.5 text-xs">×</button>
    `;
    els.shareEmailList.appendChild(chip);
  });

  els.shareEmailList.querySelectorAll('[data-remove-share]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.removeShare);
      conti.sharedWith.splice(idx, 1);
      await saveContis();
      syncContiToFirestore(conti);
      renderShareEmailList();
      renderShareOrgMemberList(els.shareMemberSearchInput?.value || '');
    });
  });
}

/* ==================================================
   [2단계] 곡 목록 화면 (Song List View)
   ================================================== */
let dragSongIndex = null;

export async function openSongList(contiId) {
  state.currentContiId = contiId;
  state.viewLevel = 'songList';
  saveCurrentMenuSession();

  // 1. [체감 대기시간 0초] 로컬 캐시로 곡 목록을 즉시 0.01초 만에 렌더링
  await loadSongs();
  renderSongListView();
  applyUIState();
  pushAppState();

  // 2. [지연 이미지 복원 (Lazy Hydration)] 악보 이미지가 누락된 곡이 있다면 state.allSongs 또는 Firestore에서 백그라운드 다운로드
  hydrateContiSongImages(state.songs).then(hasChanges => {
    if (hasChanges && state.viewLevel === 'songList' && state.currentContiId === contiId) {
      renderSongListView();
    }
  }).catch(err => console.warn('악보 지연 복원 대기:', err));

  // 3. [Firestore 최신 콘티 백그라운드 동기화] 클라우드에 업데이트된 최신 곡 목록/순서 즉시 반영
  if (state.currentUser?.orgId) {
    getContiById(contiId).then(async (cloudConti) => {
      if (!cloudConti) return;
      await handleCloudContisUpdate([cloudConti]);
    }).catch(err => console.warn('[Firebase] 콘티 상세 최신화 대기:', err));
  }

  // 4. [백그라운드 비동기 동기화] Google Drive 최신 악보/스티커 확인 후 완료 시 조용히 갱신
  if (hasDriveAuth()) {
    syncContiDetailFromDrive(contiId).then(async (updatedConti) => {
      if (updatedConti && state.viewLevel === 'songList' && state.currentContiId === contiId) {
        await loadSongs();
        renderSongListView();
      }
    }).catch(err => console.warn('백그라운드 악보 동기화:', err));
  }
}

/* ==================================================
   [인도자 전용] 리드 시트 (Lead Sheet / 멘트·노트) 관리
   ================================================== */
let editingLeadSheetId = null;

export function openLeadSheetModal(leadSheetId = null) {
  editingLeadSheetId = leadSheetId;
  if (!els.leadSheetModal) return;

  if (leadSheetId) {
    const item = state.songs.find(s => s.id === leadSheetId);
    if (els.leadSheetModalTitle) els.leadSheetModalTitle.textContent = '리드 시트 수정';
    if (els.leadSheetTitleInput) els.leadSheetTitleInput.value = item?.name || '';
    if (els.leadSheetContentInput) els.leadSheetContentInput.value = item?.content || '';
    if (els.leadSheetFontSizeSelect) els.leadSheetFontSizeSelect.value = item?.fontSize || 'large';
  } else {
    if (els.leadSheetModalTitle) els.leadSheetModalTitle.textContent = '새 리드 시트 작성';
    if (els.leadSheetTitleInput) els.leadSheetTitleInput.value = '';
    if (els.leadSheetContentInput) els.leadSheetContentInput.value = '';
    if (els.leadSheetFontSizeSelect) els.leadSheetFontSizeSelect.value = 'large';
  }
  show(els.leadSheetModal, 'flex');
  setTimeout(() => els.leadSheetTitleInput?.focus(), 100);
}

export function closeLeadSheetModal() {
  editingLeadSheetId = null;
  if (els.leadSheetModal) hide(els.leadSheetModal);
}

export async function saveLeadSheetFromModal() {
  const title = (els.leadSheetTitleInput?.value || '').trim() || '인도자 멘트/노트';
  const content = (els.leadSheetContentInput?.value || '').trim();
  const fontSize = els.leadSheetFontSizeSelect?.value || 'large';
  const myEmail = state.currentUser?.email || 'leader@continote.com';
  const myName = state.currentUser?.name || '인도자';

  if (editingLeadSheetId) {
    const item = state.songs.find(s => s.id === editingLeadSheetId);
    if (item) {
      item.name = title;
      item.content = content;
      item.fontSize = fontSize;
      item.updatedAt = Date.now();
    }
  } else {
    const newLeadSheet = {
      id: crypto.randomUUID(),
      isLeadSheet: true,
      name: title,
      content: content,
      fontSize: fontSize,
      isPrivate: true,
      authorEmail: myEmail,
      authorName: myName,
      order: state.songs.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    state.songs.push(newLeadSheet);
  }

  await saveSongs();
  const currentConti = getCurrentConti();
  if (currentConti) {
    currentConti.songs = state.songs;
    currentConti.songCount = currentConti.songs.length;
    currentConti.updatedAt = Date.now();
    await saveCurrentConti();
    syncContiToFirestore(currentConti);
    if (hasDriveAuth() && state.currentContiId) {
      syncContiDetailToDrive(state.currentContiId, true);
    }
  }

  closeLeadSheetModal();
  if (state.viewLevel === 'songList') {
    renderSongListView();
  } else if (state.viewLevel === 'viewer') {
    await renderAll();
  }
  showSyncToast('리드 시트가 저장되었습니다', 'success');
}

export async function deleteLeadSheet(leadSheetId) {
  if (!confirm('이 리드 시트를 삭제하시겠습니까?')) return;
  const idx = state.songs.findIndex(s => s.id === leadSheetId);
  if (idx !== -1) {
    state.songs.splice(idx, 1);
    await saveSongs();
    const currentConti = getCurrentConti();
    if (currentConti) {
      currentConti.songs = state.songs;
      currentConti.songCount = currentConti.songs.length;
      await saveCurrentConti();
      if (hasDriveAuth() && state.currentContiId) {
        syncContiDetailToDrive(state.currentContiId, true);
      }
    }
    if (state.viewLevel === 'songList') {
      renderSongListView();
    } else if (state.viewLevel === 'viewer') {
      if (state.currentIndex >= state.songs.length) {
        state.currentIndex = Math.max(0, state.songs.length - 1);
      }
      await renderAll();
    }
    showSyncToast('리드 시트가 삭제되었습니다', 'info');
  }
}

export function renderLeadSheetOverlay(container, song) {
  if (!container) return;
  const oldOverlay = container.querySelector('.leadsheet-text-overlay');
  if (oldOverlay) oldOverlay.remove();
  if (!song || !song.isLeadSheet) return;

  const overlay = document.createElement('div');
  overlay.className = 'leadsheet-text-overlay absolute inset-0 z-10 flex flex-col p-4 sm:p-7 overflow-y-auto no-scrollbar select-text pointer-events-auto';

  let fontClass = 'text-base sm:text-lg leading-relaxed';
  if (song.fontSize === 'normal') fontClass = 'text-sm sm:text-base leading-relaxed';
  else if (song.fontSize === 'xlarge') fontClass = 'text-lg sm:text-2xl leading-relaxed';

  overlay.innerHTML = `
    <!-- [제안 2: 노션 & 애플 클린 미니멀] 헤더 영역 -->
    <div class="flex items-start justify-between pb-3.5 mb-4 border-b shrink-0 border-zinc-200 dark:border-zinc-800">
      <div class="min-w-0 pr-2">
        <div class="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1 flex items-center gap-1.5">
          <span>CUE NOTE</span>
          <span class="text-zinc-300 dark:text-zinc-700">•</span>
          <span class="font-sans font-medium text-zinc-500 dark:text-zinc-400">인도자 전용</span>
        </div>
        <h3 class="font-extrabold text-lg sm:text-2xl tracking-tight truncate text-zinc-900 dark:text-zinc-100">${escapeHtml(song.name)}</h3>
      </div>
      <button type="button" class="leadsheet-edit-btn px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 shrink-0 bg-white dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-xs active:scale-95"
        title="리드 시트 내용 수정">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        <span>편집</span>
      </button>
    </div>

    <!-- [제안 2: 노션 & 애플 클린 미니멀] 본문 영역: 좌측 악센트 인용 라인 & 고가독성 폰트 -->
    <div class="flex-1 whitespace-pre-wrap font-normal cursor-text ${fontClass} text-zinc-800 dark:text-zinc-200 pl-4 sm:pl-6 border-l-2 border-zinc-300 dark:border-zinc-700 my-1 select-text" style="font-family:inherit">
      ${escapeHtml(song.content || '(작성된 멘트나 성경 구절이 없습니다. 우측 상단 [편집]을 눌러 내용을 작성하세요.)')}
    </div>
  `;

  overlay.querySelector('.leadsheet-edit-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openLeadSheetModal(song.id);
  });

  container.appendChild(overlay);
}

export function renderSongListView() {
  if (!els.songListContainer) return;
  els.songListContainer.innerHTML = '';

  const currentConti = getCurrentConti();
  const pureSongs = state.songs.filter(s => !s.isLeadSheet);
  if (els.songListContiTitle) els.songListContiTitle.textContent = currentConti?.title || '예배 콘티';
  if (els.songListSongCountBadge) els.songListSongCountBadge.textContent = `${pureSongs.length}곡`;
  if (els.songListContiDate) els.songListContiDate.textContent = currentConti?.date ? `📅 ${currentConti.date}` : '';
  if (els.songListContiMemo) els.songListContiMemo.textContent = currentConti?.memo ? `📝 ${currentConti.memo}` : '';

  if (!state.songs.length) {
    const isLeader = state.activeMenu === 'leader';
    if (els.emptySongTitle) {
      els.emptySongTitle.textContent = isLeader
        ? '콘티에 등록된 악보가 없습니다'
        : '인도자가 아직 악보를 등록하지 않았습니다';
    }
    if (els.emptySongDesc) {
      els.emptySongDesc.textContent = isLeader
        ? '아래 버튼을 눌러 콘티에 첫 번째 악보를 등록하세요.'
        : '인도자가 악보를 추가하면 여기에 자동으로 표시됩니다.';
    }
    if (els.emptySongAddBtnWrapper) {
      els.emptySongAddBtnWrapper.style.display = isLeader ? 'flex' : 'none';
    }
    show(els.songListEmptyState, 'block');
    renderContiSessionLineupBar();
    return;
  }
  hide(els.songListEmptyState);

  const isLeader = state.activeMenu === 'leader';
  let songSeq = 0;

  state.songs.forEach((song, idx) => {
    // [인도자 전용 리드 시트 격리] 팀원(사용자) 화면에서는 리드 시트를 완전히 숨김!
    if (song.isLeadSheet && !isLeader) return;

    if (!song.isLeadSheet) {
      songSeq++;
    }

    const row = document.createElement('div');
    row.dataset.index = idx;

    // [리드 시트 전용 카드 UI: 노션 & 애플 클린 미니멀]
    if (song.isLeadSheet) {
      row.className = 'song-card leadsheet-card p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center gap-2.5 sm:gap-3 shadow-sm hover:shadow-md border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700';
      row.style.backgroundColor = 'var(--surface)';

      row.innerHTML = `
        <div class="drag-handle-area shrink-0 p-1.5 -ml-0.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5" title="잡고 끌어서 순서 변경">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="w-5 h-5 pointer-events-none">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </div>
        <div class="flex-1 min-w-0 cursor-pointer song-content-area py-0.5">
          <div class="flex items-center gap-2 min-w-0">
            <span class="px-2 py-0.5 rounded-lg text-xs font-bold border shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700">📝 리드 시트</span>
            <span class="text-sm sm:text-base font-bold truncate whitespace-nowrap flex-1 min-w-0 text-zinc-900 dark:text-zinc-100">${escapeHtml(song.name)}</span>
          </div>
          ${song.content ? `<p class="text-xs mt-1 line-clamp-1" style="color:var(--text-dim)">${escapeHtml(song.content)}</p>` : ''}
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button data-edit-leadsheet="${song.id}" class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all" title="리드 시트 내용 수정">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          </button>
          <button data-remove-leadsheet="${song.id}" class="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-95 transition-all" title="리드 시트 삭제">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      const handleArea = row.querySelector('.drag-handle-area');
      if (handleArea) {
        handleArea.addEventListener('mousedown', () => { row.draggable = true; });
        handleArea.addEventListener('mouseup', () => { row.draggable = false; });
        handleArea.addEventListener('touchstart', () => { row.draggable = true; }, { passive: true });
        handleArea.addEventListener('touchend', () => { row.draggable = false; });
      }

      row.addEventListener('dragstart', (e) => {
        if (!row.draggable) { e.preventDefault(); return; }
        dragSongIndex = idx;
        row.classList.add('opacity-50');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('border-accent');
      });
      row.addEventListener('dragleave', () => { row.classList.remove('border-accent'); });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('border-accent');
        const fromIdx = dragSongIndex;
        const toIdx = idx;
        if (fromIdx !== null && fromIdx !== toIdx) {
          const [moved] = state.songs.splice(fromIdx, 1);
          state.songs.splice(toIdx, 0, moved);
          saveSongs().then(renderSongListView);
          const currentConti = getCurrentConti();
          if (currentConti) {
            currentConti.songs = state.songs;
            syncContiToFirestore(currentConti);
          }
        }
      });
      row.addEventListener('dragend', () => {
        row.draggable = false;
        row.classList.remove('opacity-50', 'border-accent');
      });

      row.querySelector('.song-content-area')?.addEventListener('click', () => {
        openViewerForSong(idx);
      });
      row.querySelector('[data-edit-leadsheet]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openLeadSheetModal(song.id);
      });
      row.querySelector('[data-remove-leadsheet]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteLeadSheet(song.id);
      });

      els.songListContainer.appendChild(row);
      return;
    }

    row.className = 'song-card p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center gap-2.5 sm:gap-3 shadow-sm hover:shadow-md';
    row.style.borderColor = 'var(--border)';
    row.style.backgroundColor = 'var(--surface)';

    if (isLeader) {
      row.innerHTML = `
        <div class="drag-handle-area shrink-0 p-1.5 -ml-0.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5" title="잡고 끌어서 순서 변경">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" class="w-5 h-5 pointer-events-none">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </div>
        <div class="flex-1 min-w-0 cursor-pointer song-content-area py-0.5">
          <div class="flex items-center gap-2 min-w-0">
            <span class="px-2 py-0.5 rounded-lg text-xs font-bold border shrink-0 high-contrast-chip">#${songSeq}</span>
            <span class="text-sm sm:text-base font-bold truncate whitespace-nowrap flex-1 min-w-0">${escapeHtml(song.name)}</span>
            ${song.key ? `<span class="hidden sm:inline-block text-xs sm:text-sm px-2 py-0.5 rounded-lg font-bold border shrink-0 high-contrast-chip">${escapeHtml(song.key)}</span>` : ''}
            ${song.tempo ? `<span class="hidden sm:inline-block text-xs sm:text-sm font-semibold text-neutral-500 dark:text-neutral-400 shrink-0">♩${escapeHtml(song.tempo)}</span>` : ''}
          </div>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            ${(song.key || song.tempo) ? `
              <div class="flex sm:hidden items-center gap-1.5 shrink-0">
                ${song.key ? `<span class="text-xs px-1.5 py-0.5 rounded-md font-bold border shrink-0 high-contrast-chip">${escapeHtml(song.key)}</span>` : ''}
                ${song.tempo ? `<span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 shrink-0">♩${escapeHtml(song.tempo)}</span>` : ''}
              </div>
            ` : ''}
            ${song.songform && song.songform.length ? `
              <div class="flex items-center overflow-x-auto no-scrollbar max-w-full py-0.5 select-none" title="${escapeHtml(song.songform.join(' > '))}">
                ${renderSongformChipsHtml(song.songform)}
              </div>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button data-edit-song="${song.id}" class="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all" title="곡 정보 수정 (곡명, 코드, 템포, 주제)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
          </button>
          <button data-remove-song="${song.id}" class="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-95 transition-all" title="악보 삭제">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      const handleArea = row.querySelector('.drag-handle-area');
      handleArea.addEventListener('mousedown', () => { row.draggable = true; });
      handleArea.addEventListener('mouseup', () => { row.draggable = false; });
      handleArea.addEventListener('touchstart', () => { row.draggable = true; }, { passive: true });
      handleArea.addEventListener('touchend', () => { row.draggable = false; });

      row.addEventListener('dragstart', (e) => {
        if (!row.draggable) { e.preventDefault(); return; }
        dragSongIndex = idx;
        row.classList.add('opacity-50');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('border-accent');
      });
      row.addEventListener('dragleave', () => row.classList.remove('border-accent'));
      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        row.classList.remove('border-accent');
        if (dragSongIndex !== null && dragSongIndex !== idx) {
          await moveSongTo(dragSongIndex, idx);
        }
        dragSongIndex = null;
      });
      row.addEventListener('dragend', () => {
        row.draggable = false;
        row.classList.remove('opacity-50', 'border-accent');
        dragSongIndex = null;
      });

      row.querySelector('[data-edit-song]').addEventListener('click', (e) => {
        e.stopPropagation();
        openSongMetaModalForEdit(song);
      });
      row.querySelector('[data-remove-song]').addEventListener('click', (e) => {
        e.stopPropagation();
        removeSong(song.id);
      });

      row.querySelector('.song-content-area').addEventListener('click', () => {
        openViewerForSong(idx);
      });

    } else {
      row.className += ' cursor-pointer active:scale-[0.99]';
      row.innerHTML = `
        <div class="flex-1 min-w-0 py-0.5">
          <div class="flex items-center gap-2 min-w-0">
            <span class="px-2 py-0.5 rounded-lg text-xs font-bold border shrink-0 high-contrast-chip">#${songSeq}</span>
            <h4 class="text-sm sm:text-base font-bold truncate whitespace-nowrap flex-1 min-w-0">${escapeHtml(song.name)}</h4>
            ${song.key ? `<span class="text-xs sm:text-sm px-2 py-0.5 rounded-lg font-bold border shrink-0 high-contrast-chip">${escapeHtml(song.key)}</span>` : ''}
            ${song.tempo ? `<span class="text-xs sm:text-sm font-semibold text-neutral-500 dark:text-neutral-400 shrink-0">♩${escapeHtml(song.tempo)}</span>` : ''}
          </div>
          ${song.songform && song.songform.length ? `
            <div class="flex items-center overflow-x-auto no-scrollbar max-w-full py-0.5 mt-1 select-none" title="${escapeHtml(song.songform.join(' > '))}">
              ${renderSongformChipsHtml(song.songform)}
            </div>` : ''}
        </div>
        <span class="font-bold text-xs shrink-0 flex items-center gap-1" style="color:var(--accent)">
          열기
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="w-3.5 h-3.5"><path d="m9 18 6-6-6-6"/></svg>
        </span>
      `;
      row.addEventListener('click', () => openViewerForSong(idx));
    }

    els.songListContainer.appendChild(row);
  });
  renderContiSessionLineupBar();
}

async function moveSongTo(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.songs.length || toIndex >= state.songs.length) return;
  const [moved] = state.songs.splice(fromIndex, 1);
  state.songs.splice(toIndex, 0, moved);
  await saveSongs();
  if (hasDriveAuth() && state.currentContiId) {
    syncContiDetailToDrive(state.currentContiId, false);
  }
  renderSongListView();
}

async function removeSong(songId) {
  if (!confirm('이 악보를 콘티에서 삭제하시겠습니까?')) return;
  const idx = state.songs.findIndex(s => s.id === songId);
  if (idx === -1) return;
  state.songs.splice(idx, 1);
  delete state.stickersBySong[songId];
  await saveSongs();
  await idbDelete('songs', songId);
  await idbDelete('notes', songId);
  await idbDelete('stickers', songId);
  if (hasDriveAuth() && state.currentContiId) {
    await syncContiDetailToDrive(state.currentContiId, true);
    await syncContisIndexToDrive(state.contis, false);
  }
  renderSongListView();
}

/* ==================================================
   [VIEW: 마스터 악보 보관함 (Library)]
   ================================================== */
let selectedLibraryTheme = null;
let targetAddToContiSong = null;
let targetAddToContiMode = 'sheet'; // 'sheet' | 'full'
let addToContiCandidateList = [];

export function renderSongLibraryView() {
  state.viewLevel = 'songLibrary';
  saveCurrentMenuSession();
  if (!els.librarySongListContainer) return;
  els.librarySongListContainer.innerHTML = '';

  // 주제 필터 바 렌더링
  if (els.libraryThemeFilterBar) {
    els.libraryThemeFilterBar.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = `px-3 py-1 rounded-full text-xs font-bold border shrink-0 transition-all ${!selectedLibraryTheme ? 'active-theme-chip' : ''}`;
    allBtn.style.borderColor = !selectedLibraryTheme ? 'var(--accent)' : 'var(--border)';
    allBtn.style.background = !selectedLibraryTheme ? 'var(--accent)' : 'var(--surface-2)';
    allBtn.style.color = !selectedLibraryTheme ? '#fff' : 'var(--text)';
    allBtn.textContent = '전체 주제';
    allBtn.addEventListener('click', () => {
      selectedLibraryTheme = null;
      renderSongLibraryView();
    });
    els.libraryThemeFilterBar.appendChild(allBtn);

    state.themes.forEach(theme => {
      const btn = document.createElement('button');
      const isSelected = selectedLibraryTheme === theme;
      btn.className = 'px-3 py-1 rounded-full text-xs font-bold border shrink-0 transition-all';
      btn.style.borderColor = isSelected ? 'var(--accent)' : 'var(--border)';
      btn.style.background = isSelected ? 'var(--accent)' : 'var(--surface-2)';
      btn.style.color = isSelected ? '#fff' : 'var(--text)';
      btn.textContent = theme;
      btn.addEventListener('click', () => {
        selectedLibraryTheme = isSelected ? null : theme;
        renderSongLibraryView();
      });
      els.libraryThemeFilterBar.appendChild(btn);
    });
  }

  // 검색어 및 필터 적용 (리드 시트는 마스터 악보 보관함에서 완전 격리)
  const query = (els.librarySearchInput?.value || '').trim().toLowerCase();
  let list = (state.allSongs || []).filter(s => !s.isLeadSheet);

  if (query) {
    list = list.filter(s =>
      (s.name && s.name.toLowerCase().includes(query)) ||
      (s.key && s.key.toLowerCase().includes(query)) ||
      (s.themes && s.themes.some(t => t.toLowerCase().includes(query)))
    );
  }
  if (selectedLibraryTheme) {
    list = list.filter(s => s.themes && s.themes.includes(selectedLibraryTheme));
  }

  if (!list.length) {
    show(els.libraryEmptyState, 'block');
    return;
  }
  hide(els.libraryEmptyState);

  list.forEach(song => {
    const card = document.createElement('div');
    card.className = 'p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 shadow-sm hover:shadow-md';
    card.style.borderColor = 'var(--border)';
    card.style.backgroundColor = 'var(--surface)';

    const hasSongform = Array.isArray(song.songform) && song.songform.length > 0;

    let dateStr = '';
    if (song.createdAt) {
      const d = new Date(song.createdAt);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateStr = `${yyyy}-${mm}-${dd}`;
      }
    }
    if (!dateStr) {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dateStr = `${yyyy}-${mm}-${dd}`;
    }

    const myEmail = (state.currentUser?.email || '').toLowerCase().trim();
    const songAuthorEmail = (song.authorEmail || '').toLowerCase().trim();
    const isMine = Boolean(myEmail && songAuthorEmail && songAuthorEmail !== 'leader@continote.com' && (songAuthorEmail === myEmail));
    const isAdmin = state.currentUser?.role === 'admin';
    const canManage = isAdmin || isMine;

    // 등록자 이름:
    // 1) 내가 작성자라면 내 이름으로 즉시 복구/표시
    // 2) song.authorName 이 있고 '인도자'/'찬양인도자'가 아니면 우선 표시
    // 3) 그래도 없으면 이메일 앞부분 또는 '찬양팀'
    let registrantName = '';
    if (isMine && state.currentUser?.name) {
      registrantName = state.currentUser.name;
      if (song.authorName !== state.currentUser.name) {
        song.authorName = state.currentUser.name;
        saveLibrarySong(song);
        if (state.currentUser?.orgId) {
          updateSongMaster(song.id, { authorName: state.currentUser.name });
        }
      }
    } else if (song.authorName && song.authorName !== '인도자' && song.authorName !== '찬양인도자') {
      registrantName = song.authorName.trim();
    } else if (songAuthorEmail && songAuthorEmail !== 'leader@continote.com') {
      registrantName = songAuthorEmail.split('@')[0];
    } else {
      registrantName = '찬양팀';
    }

    // 공유 여부:
    // 팀(교회) 라이브러리에 존재하는 악보는 기본적으로 찬양팀 공유 악보입니다.
    // 명시적으로 song.isShared === false 인 경우만 개인 악보로 취급.
    // 타인이 등록한 악보는 내가 보고 있다면 항상 찬양팀 공유 악보로 표시됩니다.
    const isExplicitPrivate = (song.isShared === false);
    const isShared = !isExplicitPrivate;

    const shareIconHtml = isShared ? `
      <span ${canManage ? `data-toggle-share="${song.id}" class="shrink-0 flex items-center justify-center cursor-pointer p-1 sm:p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"` : 'class="shrink-0 flex items-center justify-center p-1 sm:p-1.5"'} style="color:var(--accent)" title="${canManage ? '공유 악보 (클릭하여 개인으로 변경)' : '교회 찬양팀 공유 악보'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="w-4 h-4 sm:w-[18px] sm:h-[18px]"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
      </span>
    ` : `
      <span ${canManage ? `data-toggle-share="${song.id}" class="shrink-0 flex items-center justify-center cursor-pointer p-1 sm:p-1.5 rounded-lg text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"` : 'class="shrink-0 flex items-center justify-center p-1 sm:p-1.5 text-neutral-400"'} title="${canManage ? '개인 악보 (클릭하여 공유로 변경)' : `${escapeHtml(registrantName)} 님의 개인 악보`}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 sm:w-[18px] sm:h-[18px]"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </span>
    `;

    const themeBadges = (song.themes || []).map(t =>
      `<span class="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md font-semibold border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--text-dim)"><span class="hidden sm:inline opacity-75">주제: </span>#${escapeHtml(t)}</span>`
    ).join(' ');

    card.innerHTML = `
      <div class="song-info-area flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none active:opacity-80 transition-opacity" title="악보 및 송폼 열기">
        <div class="min-w-0 flex-1 py-0.5">
          <!-- 1번째 줄: 공유/개인 아이콘 & 곡 제목 -->
          <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
            ${shareIconHtml}
            <h4 class="font-bold text-sm sm:text-base truncate whitespace-nowrap flex-1 min-w-0">${escapeHtml(song.name)}</h4>
          </div>
          <!-- 2번째 줄: 등록일자(코드 왼편 칩), Key, 박자, 템포, 주제 태그 -->
          <div class="flex items-center gap-1.5 mt-1 flex-wrap">
            <span class="text-[11px] sm:text-xs px-1.5 py-0.5 rounded-md font-medium border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--text-dim)" title="등록일자: ${dateStr}">
              <span class="hidden sm:inline opacity-75">등록일: </span>${dateStr}
            </span>
            ${song.key ? `<span class="text-[11px] sm:text-xs px-1.5 py-0.5 rounded-md font-bold border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--accent)" title="코드: ${escapeHtml(song.key)}"><span class="hidden sm:inline opacity-75 font-normal">코드: </span>${escapeHtml(song.key)}</span>` : ''}
            ${song.timeSig ? `<span class="text-[11px] sm:text-xs px-1.5 py-0.5 rounded font-semibold text-neutral-500 shrink-0" title="박자: ${song.timeSig}"><span class="hidden sm:inline opacity-75">박자: </span>${song.timeSig}</span>` : ''}
            ${song.tempo ? `<span class="text-[11px] sm:text-xs font-semibold text-neutral-500 shrink-0" title="템포: ${escapeHtml(song.tempo)}"><span class="sm:hidden">♩</span><span class="hidden sm:inline opacity-75">템포: </span>${escapeHtml(song.tempo)}</span>` : ''}
            ${themeBadges}
          </div>
          <!-- 3번째 줄: 송폼 영역 왼편 등록자(모바일은 이름만, 태블릿 이상은 '등록자:' 라벨 표시) & 송폼 진행 순서 -->
          <div class="mt-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full py-0.5 select-none">
            <span class="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md font-medium border shrink-0 flex items-center gap-1"
              style="border-color:var(--border);background:var(--surface-2);color:var(--text-dim)"
              title="등록자: ${escapeHtml(registrantName)}">
              <span class="hidden sm:inline opacity-75">등록자:</span>
              <span class="font-semibold" style="color:var(--text)">${escapeHtml(registrantName)}</span>
            </span>
            ${hasSongform ? `
              <div class="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full py-0.5 select-none" title="${escapeHtml(song.songform.join(' > '))}">
                <span class="hidden sm:inline text-[10px] sm:text-[11px] font-medium opacity-75 shrink-0" style="color:var(--text-dim)">순서:</span>
                ${renderSongformChipsHtml(song.songform)}
              </div>` : ''}
          </div>
        </div>
      </div>
      <!-- 우측 버튼 영역: 가져오기 버튼 그룹 + 관리 아이콘 그룹(정보 수정/삭제) -->
      <div class="shrink-0 flex items-center gap-1.5 sm:gap-2">
        <div class="flex flex-col items-stretch gap-1.5">
          <button data-import-sheet="${song.id}" class="flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl border font-semibold text-xs transition-all active:scale-95"
            style="border-color:var(--border);background:var(--surface-2);color:var(--text)" title="악보 이미지만 내 콘티로 가져오기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="whitespace-nowrap hidden sm:inline">악보 가져오기</span>
          </button>
          ${hasSongform ? `
            <button data-import-full="${song.id}" class="flex items-center justify-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-white font-semibold text-xs shadow-sm active:scale-95 transition-all"
              style="background:var(--accent)" title="악보, 송폼 순서, 스티커를 모두 내 콘티로 가져오기">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M12 5v14M5 12h14"/></svg>
              <span class="whitespace-nowrap hidden sm:inline">전체 가져오기</span>
            </button>` : ''}
        </div>
        ${canManage ? `
        <div class="flex flex-col items-stretch gap-1.5">
          <button data-edit-library-song="${song.id}" class="p-2 rounded-xl text-neutral-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 active:scale-95 transition-all shrink-0 border flex items-center justify-center"
            style="border-color:var(--border);background:var(--surface-2)" title="곡 정보(곡명, Key, 박자, 템포, 태그) 수정">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button data-delete-library-song="${song.id}" class="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-95 transition-all shrink-0 border flex items-center justify-center"
            style="border-color:var(--border);background:var(--surface-2)" title="악보 보관함에서 영구 삭제">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>` : ''}
      </div>
    `;

    // 공유 / 개인 상태 클릭 토글
    const shareToggleBtn = card.querySelector('[data-toggle-share]');
    if (shareToggleBtn) {
      shareToggleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        song.isShared = !isShared;
        song.shared = song.isShared;
        await saveLibrarySong(song);
        if (state.currentUser?.orgId) {
          updateSongMaster(song.id, {
            isShared: song.isShared
          });
        }
        if (hasDriveAuth()) {
          syncLibraryToDrive(state.allSongs, false);
        }
        showSyncToast(song.isShared ? '‘공유’ 악보로 설정되었습니다' : '‘개인’ 악보로 설정되었습니다', 'info');
        renderSongLibraryView();
      });
    }

    // 악보 보관함에서 곡 선택 시 악보(송폼, 송폼스티커 포함) 즉시 뷰어로 열람
    card.querySelector('.song-info-area').addEventListener('click', () => {
      openViewerForLibrarySong(song, list);
    });

    // 악보 가져오기 버튼 클릭
    card.querySelector('[data-import-sheet]').addEventListener('click', (e) => {
      e.stopPropagation();
      openAddToContiModal(song, 'sheet');
    });

    // 전체 가져오기 버튼 클릭 (송폼이 있는 경우)
    const fullBtn = card.querySelector('[data-import-full]');
    if (fullBtn) {
      fullBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAddToContiModal(song, 'full');
      });
    }

    // 곡 정보 수정 버튼 클릭
    const editBtn = card.querySelector('[data-edit-library-song]');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSongMetaModalForEdit(song);
      });
    }

    // 악보 보관함에서 곡 영구 삭제 버튼 클릭
    const deleteBtn = card.querySelector('[data-delete-library-song]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`'${song.name}' 악보를 곡 목록(보관함)에서 완전히 삭제하시겠습니까?`)) return;
        await deleteLibrarySong(song.id);
        if (state.currentUser?.orgId) {
          deleteSongMaster(song.id).catch(() => {});
        }
        if (hasDriveAuth()) {
          syncLibraryToDrive(state.allSongs, false).catch(() => {});
        }
        showSyncToast(`'${song.name}' 악보가 보관함에서 삭제되었습니다`, 'success');
        renderSongLibraryView();
      });
    }

    els.librarySongListContainer.appendChild(card);
  });
}

export async function openViewerForLibrarySong(song, libraryList = null) {
  stopMetronome();
  const list = libraryList || state.allSongs;
  const songIdx = list.findIndex(s => s.id === song.id);
  state.currentContiId = null; // 마스터 보관함 모드 진입 시 콘티 ID 반드시 초기화
  state.activeMenu = 'library'; // [핵심] 보관함 악보 뷰어는 반드시 library 메뉴로 동기화
  state.viewerReturnView = 'songLibrary';
  state.songs = list;
  state.currentIndex = songIdx !== -1 ? songIdx : 0;
  state.viewLevel = 'viewer';
  state.locked = true;

  if (song && (!(song.id in state.stickersBySong) || !state.stickersBySong[song.id]?.length)) {
    await loadStickers(song.id);
  }
  resetZoom();
  saveCurrentMenuSession();
  applyUIState();
  await renderAll();
  pushAppState();
}

function renderAddToContiCandidateList(query = '') {
  if (!els.addToContiListContainer) return;
  const q = (query || '').trim().toLowerCase();
  const filtered = addToContiCandidateList.filter(c => {
    if (!q) return true;
    return (c.title || '').toLowerCase().includes(q) ||
           (c.date || '').toLowerCase().includes(q) ||
           (c.memo || '').toLowerCase().includes(q);
  });

  if (els.addToContiCountBadge) {
    els.addToContiCountBadge.textContent = `${filtered.length}개`;
  }

  if (!filtered.length) {
    els.addToContiListContainer.innerHTML = `
      <div class="text-xs text-center py-8" style="color:var(--text-dim)">
        ${q ? '검색된 콘티가 없습니다.' : '등록된 내 콘티가 없습니다.'}
      </div>
    `;
    return;
  }

  els.addToContiListContainer.innerHTML = '';
  filtered.forEach((c, idx) => {
    const isFirst = idx === 0;
    const songCount = getContiSongCount(c);

    const card = document.createElement('label');
    card.className = `group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
      isFirst ? 'border-[var(--accent)] bg-[var(--surface-2)] shadow-sm' : 'hover:bg-black/5 dark:hover:bg-white/5'
    }`;
    card.style.borderColor = isFirst ? 'var(--accent)' : 'var(--border)';
    card.innerHTML = `
      <div class="min-w-0 pr-2 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="font-bold text-xs sm:text-sm truncate">${escapeHtml(c.title)}</span>
          ${c.id === state.currentContiId ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0" style="background:var(--accent)">🔥 최근 콘티</span>` : ''}
        </div>
        <div class="text-[11px] mt-0.5 flex items-center gap-2" style="color:var(--text-dim)">
          <span>📅 ${escapeHtml(c.date || '날짜 미정')}</span>
          <span>·</span>
          <span>🎵 ${songCount}곡</span>
        </div>
      </div>
      <input type="radio" name="targetContiRadio" value="${c.id}" ${isFirst ? 'checked' : ''}
        class="w-4 h-4 accent-[var(--accent)] shrink-0 ml-2 pointer-events-none" />
    `;

    card.addEventListener('click', () => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      els.addToContiListContainer.querySelectorAll('label').forEach(lbl => {
        lbl.style.borderColor = 'var(--border)';
        lbl.classList.remove('border-[var(--accent)]', 'bg-[var(--surface-2)]', 'shadow-sm');
      });
      card.style.borderColor = 'var(--accent)';
      card.classList.add('border-[var(--accent)]', 'bg-[var(--surface-2)]', 'shadow-sm');
    });

    els.addToContiListContainer.appendChild(card);
  });
}

function openAddToContiModal(song, mode = 'sheet') {
  targetAddToContiSong = song;
  targetAddToContiMode = mode;
  const isFull = mode === 'full';
  const modeBadge = isFull ? ' [전체: 악보+송폼+스티커]' : ' [악보만]';
  if (els.addToContiSongTitle) {
    els.addToContiSongTitle.textContent = `${song.name} (Key ${song.key || '-'})${modeBadge}`;
  }
  if (els.addToContiSearchInput) {
    els.addToContiSearchInput.value = '';
  }

  const myEmail = state.currentUser?.email || 'leader@continote.com';
  let myContis = (state.contis || []).filter(c => (c.authorEmail || 'leader@continote.com') === myEmail);

  // 정렬: 현재 열람 중인 콘티가 최우선, 그 다음 날짜 최신순(내림차순), 생성/수정일 순
  myContis.sort((a, b) => {
    if (a.id === state.currentContiId) return -1;
    if (b.id === state.currentContiId) return 1;
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return (b.updatedAt || b.createdAt || 0) > (a.updatedAt || a.createdAt || 0) ? 1 : -1;
  });

  addToContiCandidateList = myContis;
  renderAddToContiCandidateList('');
  show(els.addToContiModal, 'flex');
  setTimeout(() => {
    if (els.addToContiSearchInput) els.addToContiSearchInput.focus();
  }, 100);
}

/* ==================================================
   [3단계] 악보 뷰어 화면 (Viewer Section)
   ================================================== */
export function isTwoPageViewActive() {
  const viewerW = (els.viewer && els.viewer.clientWidth > 0) ? els.viewer.clientWidth : window.innerWidth;
  const viewerH = (els.viewer && els.viewer.clientHeight > 0) ? els.viewer.clientHeight : window.innerHeight;
  // 해상도 비율 감지: 가로가 더 긴 경우(가로 모드)에만 2면 활성화, 세로가 더 길면(세로 모드) 1면만 표시
  const isLandscape = viewerW > viewerH;
  // 사용자 메뉴이거나, 인도자 메뉴일 때(가로 모드 + 2면 설정 + 640px 이상) 2면 뷰어 활성화 (보기/편집 모두 2면 유지!)
  const isEligibleMenu = (state.activeMenu === 'user') || (state.activeMenu === 'leader');
  return isEligibleMenu && (state.viewSheetCount === 2) && isLandscape && (viewerW >= 640) && (state.songs.length > 1);
}

/** 2면 편집 시 현재 활성화(포커스)된 슬롯의 곡 데이터 및 컨테이너 반환 */
export function getActiveTwoPageEditing() {
  const isTwo = isTwoPageViewActive();
  const slot = (isTwo && state.activeTwoPageSlot === 'right') ? 'right' : 'left';
  const songIndex = (slot === 'right') ? state.currentIndex + 1 : state.currentIndex;
  const song = state.songs[songIndex] || null;
  const container = (slot === 'right' && els.sheetContainerRight) ? els.sheetContainerRight : els.sheetContainer;
  const stickerLayer = (slot === 'right' && els.stickerLayerRight) ? els.stickerLayerRight : els.stickerLayer;
  return { isTwo, slot, songIndex, song, container, stickerLayer };
}

/** 2면 편집 시 비활성 악보 스마트 디밍 클래스 제어 */
export function applyTwoPageDimming() {
  if (!els.sheetContainer) return;
  els.sheetContainer.classList.add('sheet-container-slot');
  if (els.sheetContainerRight) els.sheetContainerRight.classList.add('sheet-container-slot');

  const isTwo = isTwoPageViewActive();
  const isEditing = !state.locked && (state.activeMenu === 'leader' || state.viewerReturnView === 'songLibrary');

  if (isTwo && isEditing) {
    if (state.activeTwoPageSlot === 'right') {
      els.sheetContainer.classList.add('sheet-slot-dimmed');
      els.sheetContainer.classList.remove('sheet-slot-active');
      if (els.sheetContainerRight) {
        els.sheetContainerRight.classList.remove('sheet-slot-dimmed');
        els.sheetContainerRight.classList.add('sheet-slot-active');
      }
    } else {
      els.sheetContainer.classList.remove('sheet-slot-dimmed');
      els.sheetContainer.classList.add('sheet-slot-active');
      if (els.sheetContainerRight) {
        els.sheetContainerRight.classList.add('sheet-slot-dimmed');
        els.sheetContainerRight.classList.remove('sheet-slot-active');
      }
    }
  } else {
    // 보기 모드이거나 1면 모드일 때는 디밍 해제
    els.sheetContainer.classList.remove('sheet-slot-dimmed', 'sheet-slot-active');
    if (els.sheetContainerRight) {
      els.sheetContainerRight.classList.remove('sheet-slot-dimmed', 'sheet-slot-active');
    }
  }
}

export async function openViewerForSong(songIndex) {
  stopMetronome();
  state.viewLevel = 'viewer';
  state.viewerReturnView = null;
  state.locked = true; // 뷰어 진입 시 기본은 보기 상태(locked)
  if (isTwoPageViewActive()) {
    // 2곡 보기 모드에서는 책 펼침 양면 페어(1-2, 3-4, 5-6...) 기준 짝수 인덱스로 정렬
    state.currentIndex = Math.floor(songIndex / 2) * 2;
  } else {
    state.currentIndex = songIndex;
  }
  isViewerDirty = false;
  saveCurrentMenuSession();
  const song = state.songs[state.currentIndex];
  if (song && (!(song.id in state.stickersBySong) || !state.stickersBySong[song.id]?.length)) {
    await loadStickers(song.id);
  }
  const nextSong = isTwoPageViewActive() ? state.songs[state.currentIndex + 1] : null;
  if (nextSong && (!(nextSong.id in state.stickersBySong) || !state.stickersBySong[nextSong.id]?.length)) {
    await loadStickers(nextSong.id);
  }
  resetZoom();
  applyUIState();
  await renderAll();
  pushAppState();

  // 백그라운드에서 Google Drive 최신 스티커 동기화 후 화면 자동 리프레시 (타 기기 변경사항 실시간 반영)
  if (hasDriveAuth() && state.currentContiId) {
    syncContiDetailFromDrive(state.currentContiId).then(() => {
      const curSong = state.songs[state.currentIndex];
      if (curSong && state.viewLevel === 'viewer') {
        renderStickerLayer(els.stickerLayer, els.sheetContainer, curSong.id);
        if (els.stickerLayerRight) {
          const nextS = state.songs[state.currentIndex + 1];
          if (nextS) renderStickerLayer(els.stickerLayerRight, els.sheetContainerRight, nextS.id);
        }
      }
    }).catch(() => {});
  }
}

export async function renderAll() {
  if (state.viewLevel === 'contiList') {
    renderContiListView();
    applyUIState();
    return;
  }
  if (state.viewLevel === 'songList') {
    renderSongListView();
    applyUIState();
    return;
  }
  if (state.viewLevel === 'songLibrary') {
    renderSongLibraryView();
    applyUIState();
    return;
  }

  const isTwoPage = isTwoPageViewActive();
  if (isTwoPage && state.currentIndex % 2 !== 0) {
    state.currentIndex = Math.floor(state.currentIndex / 2) * 2;
  }
  const songLeft = state.songs[state.currentIndex];
  const songRight = isTwoPage ? (state.songs[state.currentIndex + 1] || null) : null;

  // 뷰어 악보 이미지가 아직 다운로드되지 않은 경우 즉시 지연 복원 (리드 시트는 이미지 없으므로 제외)
  const targets = [songLeft, songRight].filter(s => s && !s.isLeadSheet);
  if (targets.some(s => !s.image)) {
    await hydrateContiSongImages(targets);
  }

  if (isTwoPage) {
    const vw = els.viewer.clientWidth;
    const vh = els.viewer.clientHeight;
    const gap = 12;
    const halfW = Math.floor((vw - gap) / 2);

    // 슬롯 0: 좌측 악보 또는 리드 시트
    if (songLeft) {
      els.sheetContainer.style.display = 'block';
      await renderBaseSheet(els.viewer, els.sheetContainer, els.baseCanvas, songLeft, { x: 0, y: 0, w: halfW, h: vh });
      await renderUserDrawing(els.sheetContainer, els.userCanvas, songLeft.id);
      if (!(songLeft.id in state.stickersBySong)) {
        await loadStickers(songLeft.id);
      }
      renderStickerLayer(els.stickerLayer, els.sheetContainer, songLeft.id);
      renderLeadSheetOverlay(els.sheetContainer, songLeft);
    } else {
      clearCanvases(els.sheetContainer, els.baseCanvas, els.userCanvas);
      renderStickerLayer(els.stickerLayer, els.sheetContainer, null);
      renderLeadSheetOverlay(els.sheetContainer, null);
    }

    // 슬롯 1: 우측 악보 또는 리드 시트 (홀수 곡일 때는 깔끔한 빈 슬롯 유지)
    if (songRight) {
      if (els.sheetContainerRight) {
        els.sheetContainerRight.style.display = 'block';
        await renderBaseSheet(els.viewer, els.sheetContainerRight, els.baseCanvasRight, songRight, { x: halfW + gap, y: 0, w: halfW, h: vh });
        await renderUserDrawing(els.sheetContainerRight, els.userCanvasRight, songRight.id);
        if (!(songRight.id in state.stickersBySong)) {
          await loadStickers(songRight.id);
        }
        renderStickerLayer(els.stickerLayerRight, els.sheetContainerRight, songRight.id);
        renderLeadSheetOverlay(els.sheetContainerRight, songRight);
      }
    } else {
      if (els.sheetContainerRight) {
        els.sheetContainerRight.style.display = 'none';
        clearCanvases(els.sheetContainerRight, els.baseCanvasRight, els.userCanvasRight);
        renderStickerLayer(els.stickerLayerRight, els.sheetContainerRight, null);
        renderLeadSheetOverlay(els.sheetContainerRight, null);
      }
    }
  } else {
    // 1곡 보기 모드 (단독 슬롯 0)
    if (els.sheetContainerRight) {
      els.sheetContainerRight.style.display = 'none';
      clearCanvases(els.sheetContainerRight, els.baseCanvasRight, els.userCanvasRight);
      renderStickerLayer(els.stickerLayerRight, els.sheetContainerRight, null);
      renderLeadSheetOverlay(els.sheetContainerRight, null);
    }
    if (songLeft) {
      els.sheetContainer.style.display = 'block';
      await renderBaseSheet(els.viewer, els.sheetContainer, els.baseCanvas, songLeft);
      await renderUserDrawing(els.sheetContainer, els.userCanvas, songLeft.id);
      if (!(songLeft.id in state.stickersBySong)) {
        await loadStickers(songLeft.id);
      }
      renderStickerLayer(els.stickerLayer, els.sheetContainer, songLeft.id);
      renderLeadSheetOverlay(els.sheetContainer, songLeft);
    } else {
      clearCanvases(els.sheetContainer, els.baseCanvas, els.userCanvas);
      renderStickerLayer(els.stickerLayer, els.sheetContainer, null);
      renderLeadSheetOverlay(els.sheetContainer, null);
    }
  }
  renderSongformStickyChips();
  applyUIState();
}

/* ==================================================
   메뉴별 독립 세션 메모리 (작업 중 화면/편집 상태 보존)
   ================================================== */
const menuSessions = {
  user: {
    viewLevel: 'contiList',
    currentContiId: null,
    currentIndex: 0,
    locked: true,
    viewerReturnView: null,
  },
  leader: {
    viewLevel: 'contiList',
    currentContiId: null,
    currentIndex: 0,
    locked: true,
    viewerReturnView: null,
  },
  library: {
    viewLevel: 'songLibrary',
    currentContiId: null,
    currentIndex: 0,
    locked: true,
    viewerReturnView: null,
  },
  settings: {
    viewLevel: 'settings',
    currentContiId: null,
    currentIndex: 0,
    locked: true,
    viewerReturnView: null,
  }
};

export function saveCurrentMenuSession() {
  // 1. 메뉴별 viewLevel 유효성 강제 가드
  if (state.activeMenu === 'settings') {
    state.viewLevel = 'settings';
    state.currentContiId = null;
  } else if (state.activeMenu === 'library') {
    if (state.viewLevel !== 'viewer') {
      state.viewLevel = 'songLibrary';
    }
  } else if (state.activeMenu === 'user' || state.activeMenu === 'leader') {
    if (state.viewLevel === 'songLibrary' || state.viewLevel === 'settings') {
      state.viewLevel = 'contiList';
      state.currentContiId = null;
    }
  }

  if (state.activeMenu && menuSessions[state.activeMenu]) {
    menuSessions[state.activeMenu] = {
      viewLevel: state.viewLevel,
      currentContiId: state.currentContiId,
      currentIndex: state.currentIndex,
      locked: state.locked,
      viewerReturnView: state.viewerReturnView,
    };
  }

  // settings 탭 세션은 항상 무결성 보장
  menuSessions.settings = {
    viewLevel: 'settings',
    currentContiId: null,
    currentIndex: 0,
    locked: true,
    viewerReturnView: null,
  };

  // user / leader 탭 세션 오염 방지
  ['user', 'leader'].forEach(m => {
    if (menuSessions[m]) {
      if (menuSessions[m].viewLevel === 'songLibrary' || menuSessions[m].viewLevel === 'settings') {
        menuSessions[m].viewLevel = 'contiList';
        menuSessions[m].currentContiId = null;
      }
      menuSessions[m].viewerReturnView = null;
    }
  });

  // 영구 localStorage에 현재 세션 저장 (새로고침 시 100% 동일 화면 복원)
  try {
    const currentNavState = {
      activeMenu: state.activeMenu || 'user',
      viewLevel: state.viewLevel || 'contiList',
      currentContiId: state.currentContiId || null,
      currentIndex: state.currentIndex || 0,
      locked: state.locked,
      viewerReturnView: state.viewerReturnView || null,
      menuSessions: menuSessions
    };
    localStorage.setItem('continote_saved_nav_session', JSON.stringify(currentNavState));
  } catch (_) {}
}

export function loadSavedNavSession() {
  try {
    const raw = localStorage.getItem('continote_saved_nav_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.menuSessions && typeof parsed.menuSessions === 'object') {
          Object.assign(menuSessions, parsed.menuSessions);
        }

        // settings 탭 세션 오염 자동 복구
        menuSessions.settings = {
          viewLevel: 'settings',
          currentContiId: null,
          currentIndex: 0,
          locked: true,
          viewerReturnView: null,
        };

        // user / leader 세션 오염 자동 치유
        ['user', 'leader'].forEach(m => {
          if (menuSessions[m] && (menuSessions[m].viewLevel === 'songLibrary' || menuSessions[m].viewLevel === 'settings')) {
            menuSessions[m].viewLevel = 'contiList';
            menuSessions[m].currentContiId = null;
          }
        });

        // 활성 메뉴별 viewLevel 정화 (과거 오염 세션 자동 치유)
        if (parsed.activeMenu === 'settings') {
          parsed.viewLevel = 'settings';
          parsed.currentContiId = null;
        } else if (parsed.activeMenu === 'library') {
          if (parsed.viewLevel !== 'viewer') {
            parsed.viewLevel = 'songLibrary';
          }
        } else if (parsed.activeMenu === 'user' || parsed.activeMenu === 'leader') {
          if (parsed.viewLevel === 'songLibrary' || parsed.viewLevel === 'settings') {
            parsed.viewLevel = 'contiList';
            parsed.currentContiId = null;
          }
        }

        // 정화된 데이터를 즉시 재저장하여 오염 영구 치유
        localStorage.setItem('continote_saved_nav_session', JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Session] 세션 복원 데이터 파싱 실패:', e);
  }
  return null;
}

/* ==================================================
   브라우저 History API 및 뒤로가기 내비게이션 관리
   ================================================== */
let appHistoryDepth = 0;
let isNavigatingHistory = false;

export function pushAppState(extra = {}) {
  if (isNavigatingHistory) return;
  appHistoryDepth++;
  const navState = {
    appDepth: appHistoryDepth,
    activeMenu: state.activeMenu,
    viewLevel: state.viewLevel,
    currentContiId: state.currentContiId,
    currentIndex: state.currentIndex,
    viewerReturnView: state.viewerReturnView,
    ...extra
  };
  try {
    window.history.pushState(navState, '');
  } catch (e) {
    console.warn('[History] pushState failed:', e);
  }
}

export function initBrowserHistory() {
  const initialState = {
    appDepth: 0,
    activeMenu: state.activeMenu || 'user',
    viewLevel: state.viewLevel || 'contiList',
    currentContiId: state.currentContiId || null,
    currentIndex: state.currentIndex || 0,
    viewerReturnView: state.viewerReturnView || null
  };
  try {
    window.history.replaceState(initialState, '');
  } catch (e) {}

  window.addEventListener('popstate', async (event) => {
    // 1. 열려있는 모달이 있다면 닫기 우선 처리
    const openModals = [
      els.cropModal, els.ratioModal, els.songformOrderModal, els.contiModal,
      els.shareModal, els.songMetaModal, els.addToContiModal, els.textMemoModal,
      els.chordStickerModal
    ].filter(m => m && m.style.display !== 'none');

    if (openModals.length > 0) {
      stopMetronome();
      openModals.forEach(m => hide(m));
      return;
    }

    // 뷰어에서 뒤로가기 시 실제 변경사항이 있을 때만 백그라운드 자동 저장 (사용자 방해 confirm 팝업 제거)
    if (state.viewLevel === 'viewer' && isViewerDirty && hasDriveAuth()) {
      if (state.viewerReturnView === 'songLibrary') {
        syncLibraryToDrive(state.allSongs, false);
      } else if (state.currentContiId) {
        syncContiDetailToDrive(state.currentContiId, false);
      }
      isViewerDirty = false;
    }

    const targetState = event.state;
    if (targetState && typeof targetState.appDepth === 'number') {
      appHistoryDepth = targetState.appDepth;
    } else {
      appHistoryDepth = 0;
    }

    isNavigatingHistory = true;
    try {
      await restoreNavigationState(targetState);
    } finally {
      isNavigatingHistory = false;
    }
  });
}

async function restoreNavigationState(targetState) {
  if (!targetState) {
    state.viewLevel = 'contiList';
    state.currentContiId = null;
    renderContiListView();
    applyUIState();
    return;
  }

  state.activeMenu = targetState.activeMenu || 'user';
  state.viewLevel = targetState.viewLevel || 'contiList';
  state.currentContiId = targetState.currentContiId || null;
  state.currentIndex = typeof targetState.currentIndex === 'number' ? targetState.currentIndex : 0;
  state.viewerReturnView = targetState.viewerReturnView || null;
  if (typeof targetState.locked === 'boolean') {
    state.locked = targetState.locked;
  }

  // 콘티 존재 여부 안전 검증 (삭제된 콘티 폴백 방어)
  if ((state.viewLevel === 'songList' || (state.viewLevel === 'viewer' && state.viewerReturnView !== 'songLibrary')) && state.currentContiId) {
    const exists = state.contis && state.contis.some(c => c.id === state.currentContiId);
    if (!exists) {
      state.viewLevel = 'contiList';
      state.currentContiId = null;
      state.viewerReturnView = null;
    }
  }

  // UI 가시성 및 뷰어 섹션을 먼저 표시하여 DOM 치수(clientWidth/clientHeight)를 활성화
  applyUIState();

  if (state.viewLevel === 'contiList') {
    renderContiListView();
  } else if (state.viewLevel === 'songList') {
    if (state.currentContiId) {
      await loadSongs();
    }
    renderSongListView();
  } else if (state.viewLevel === 'songLibrary') {
    renderSongLibraryView();
  } else if (state.viewLevel === 'settings') {
    renderSettingsView();
  } else if (state.viewLevel === 'viewer') {
    if (state.viewerReturnView === 'songLibrary') {
      state.songs = state.allSongs;
    } else if (state.currentContiId) {
      await loadSongs();
    }

    if (state.songs && state.songs.length > 0) {
      if (state.currentIndex >= state.songs.length) {
        state.currentIndex = Math.max(0, state.songs.length - 1);
      }
      const song = state.songs[state.currentIndex];
      if (song && (!(song.id in state.stickersBySong) || !state.stickersBySong[song.id]?.length)) {
        await loadStickers(song.id);
      }
      const nextSong = isTwoPageViewActive() ? state.songs[state.currentIndex + 1] : null;
      if (nextSong && (!(nextSong.id in state.stickersBySong) || !state.stickersBySong[nextSong.id]?.length)) {
        await loadStickers(nextSong.id);
      }
      resetZoom();
      requestAnimationFrame(async () => {
        await renderAll();
      });
    } else {
      // 악보가 비어있을 경우 안전하게 이전 뷰로 복귀
      if (state.viewerReturnView === 'songLibrary') {
        state.viewLevel = 'songLibrary';
        renderSongLibraryView();
      } else {
        state.viewLevel = state.currentContiId ? 'songList' : 'contiList';
        if (state.viewLevel === 'songList') renderSongListView();
        else renderContiListView();
      }
      applyUIState();
    }
  }

  saveCurrentMenuSession();

  try {
    const currentState = {
      appDepth: appHistoryDepth,
      activeMenu: state.activeMenu || 'user',
      viewLevel: state.viewLevel || 'contiList',
      currentContiId: state.currentContiId || null,
      currentIndex: state.currentIndex || 0,
      viewerReturnView: state.viewerReturnView || null
    };
    window.history.replaceState(currentState, '');
  } catch (_) {}
}

export function handleDirectBack() {
  stopMetronome();
  if (state.viewLevel === 'viewer') {
    if (isViewerDirty && hasDriveAuth()) {
      if (state.viewerReturnView === 'songLibrary') {
        syncLibraryToDrive(state.allSongs, false);
      } else if (state.currentContiId) {
        syncContiDetailToDrive(state.currentContiId, false);
      }
      isViewerDirty = false;
    }
    if (state.viewerReturnView === 'songLibrary') {
      state.viewLevel = 'songLibrary';
      state.viewerReturnView = null;
      state.locked = true;
      resetZoom();
      saveCurrentMenuSession();
      renderSongLibraryView();
      applyUIState();
      pushAppState();
      return;
    }
    state.viewLevel = 'songList';
    state.viewerReturnView = null;
    state.locked = true;
    resetZoom();
    saveCurrentMenuSession();
    renderSongListView();
    applyUIState();
    pushAppState();
  } else if (state.viewLevel === 'songList') {
    state.viewLevel = 'contiList';
    state.currentContiId = null;
    state.viewerReturnView = null;
    saveCurrentMenuSession();
    renderContiListView();
    applyUIState();
    pushAppState();
  } else if (state.viewLevel === 'settings' || state.viewLevel === 'songLibrary') {
    switchToMenu(state.previousMenu || 'user', false);
    pushAppState();
  }
}

export async function switchToMenu(targetMenu, isFromHistory = false) {
  if (state.activeMenu === targetMenu) {
    // 이미 활성화된 메뉴 탭을 다시 누른 경우 현재 화면과 편집 상태 유지
    return;
  }

  // 1. 현재 메뉴의 화면 및 편집 상태 저장
  saveCurrentMenuSession();
  state.previousMenu = state.activeMenu;

  // 2. 대상 메뉴로 활성화 전환
  state.activeMenu = targetMenu;

  // 3. 대상 메뉴의 이전 세션 복원
  const session = menuSessions[targetMenu];
  if (session) {
    if (targetMenu === 'user' || targetMenu === 'leader') {
      if (session.viewLevel === 'songLibrary' || session.viewLevel === 'settings') {
        session.viewLevel = 'contiList';
        session.currentContiId = null;
      }
      session.viewerReturnView = null; // [방어벽] 인도자/사용자 메뉴에서는 보관함 복귀 플래그 원천 차단
    }
    state.viewLevel = session.viewLevel;
    state.currentContiId = session.currentContiId;
    state.currentIndex = session.currentIndex;
    state.locked = session.locked;
    state.viewerReturnView = session.viewerReturnView;
  } else {
    state.viewLevel = (targetMenu === 'library') ? 'songLibrary' : (targetMenu === 'settings' ? 'settings' : 'contiList');
    state.currentContiId = null;
    state.currentIndex = 0;
    state.locked = true;
    state.viewerReturnView = null;
  }

  // 4. [핵심] UI 가시성(display: flex/none)을 먼저 설정하여 DOM 크기(clientWidth/clientHeight)를 활성화!
  applyUIState();

  // 5. 복원된 세션에 맞는 데이터 로드 및 렌더링
  if (state.viewLevel === 'viewer' || state.viewLevel === 'songList') {
    if (state.currentContiId) {
      await loadSongs();
    }
  }

  if (state.viewLevel === 'contiList') {
    renderContiListView();
  } else if (state.viewLevel === 'songList') {
    renderSongListView();
  } else if (state.viewLevel === 'songLibrary') {
    renderSongLibraryView();
  } else if (state.viewLevel === 'settings') {
    renderSettingsView();
  } else if (state.viewLevel === 'viewer') {
    resetZoom();
    // 브라우저 렌더 트리의 레이아웃 완료를 보장하기 위해 requestAnimationFrame 사용
    requestAnimationFrame(async () => {
      await renderAll();
    });
  }

  saveCurrentMenuSession();

  if (!isFromHistory) {
    pushAppState();
  }
}

/* ==================================================
   UI 가시성 및 상태 제어
   ================================================== */
export function applyUIState() {
  document.documentElement.removeAttribute('data-prehydrate-view');
  document.documentElement.removeAttribute('data-prehydrate-menu');
  const isDark = isDarkThemeActive();
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', !isDark);

  // 테마 컬러 모드 설정 (사용자: 보라 / 인도자: 주황 / 곡 목록: 파랑 / 설정: 보라)
  let colorMode = 'user';
  if (state.activeMenu === 'leader') {
    colorMode = 'leader';
  } else if (state.activeMenu === 'library') {
    colorMode = 'library';
  } else if (state.activeMenu === 'settings') {
    colorMode = 'settings';
  } else {
    colorMode = 'user';
  }
  document.body.dataset.colorMode = colorMode;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    if (colorMode === 'leader') themeMeta.content = '#EA580C';
    else if (colorMode === 'library') themeMeta.content = '#2563EB';
    else if (colorMode === 'settings') themeMeta.content = '#6B5B95';
    else themeMeta.content = '#6B5B95';
  }

  const currentConti = getCurrentConti();
  const currentSong = getCurrentSong();
  const hasSongs = state.songs.length > 0;
  const isLeader = state.activeMenu === 'leader';

  // [메뉴-뷰 레벨 상태 불일치 자동 치유 가드]
  // leader 또는 user 메뉴 상태에서는 절대로 songLibrary 화면으로 어긋나지 않도록 방어
  if ((state.activeMenu === 'leader' || state.activeMenu === 'user') && state.viewLevel === 'songLibrary') {
    state.viewLevel = state.currentContiId ? 'songList' : 'contiList';
    state.viewerReturnView = null;
  }

  // 뷰어 모드가 아닐 때 뷰어 메트로놈이 실행 중이면 자동 정지 및 전용 버튼 숨김
  if (state.viewLevel !== 'viewer') {
    if (metronomeActiveBtn === els.viewerBpmBtn || metronomeActiveBtn === els.viewerBpmBtnRight) stopMetronome();
    if (els.viewerLibraryShareBtn) hide(els.viewerLibraryShareBtn);
  }

  // 1. [1단계: 콘티 목록]
  if (state.viewLevel === 'contiList') {
    show(els.contiListView, 'block');
    hide(els.songListView);
    hide(els.songLibraryView);
    hide(els.settingsView);
    hide(els.viewerSection);

    hide(els.backBtn);
    show(els.headerLogoArea, 'flex');
    hide(els.viewerHeaderInfo);
    hide(els.songListAddBtn);
    hide(els.songListAddLeadSheetBtn);
    hide(els.viewerBpmBtn);
    hide(els.viewerBpmBtnRight);
    hide(els.lockToggleContainer || els.lockBtn);
    hide(els.navIndicator);

    if (isLeader) {
      show(els.addContiBtn, 'flex');
    } else {
      hide(els.addContiBtn);
    }

    hide(els.leaderToolbar);
    hide(els.userPenToolbar);
    updateZoomVisibility(true);
    updateBottomNavActiveState();
    return;
  }

  // 2. [2단계: 곡 목록]
  if (state.viewLevel === 'songList') {
    hide(els.contiListView);
    show(els.songListView, 'block');
    hide(els.songLibraryView);
    hide(els.settingsView);
    hide(els.viewerSection);

    show(els.backBtn, 'flex');
    if (els.backBtnText) els.backBtnText.textContent = '예배 콘티 목록';

    hide(els.headerLogoArea);
    show(els.viewerHeaderInfo, 'flex');
    if (els.viewerContiTitle) els.viewerContiTitle.textContent = '예배 콘티 목록';
    if (els.viewerSongTitle) {
      els.viewerSongTitle.textContent = '';
      hide(els.viewerSongTitle);
    }

    hide(els.addContiBtn);
    if (isLeader) {
      show(els.songListAddBtn, 'flex');
      show(els.songListAddLeadSheetBtn, 'flex');
    } else {
      hide(els.songListAddBtn);
      hide(els.songListAddLeadSheetBtn);
    }
    hide(els.viewerBpmBtn);
    hide(els.viewerBpmBtnRight);
    hide(els.lockToggleContainer || els.lockBtn);
    hide(els.navIndicator);

    hide(els.leaderToolbar);
    hide(els.userPenToolbar);
    updateZoomVisibility(true);
    updateBottomNavActiveState();
    return;
  }

  // 3. [마스터 악보 보관함 뷰]
  if (state.viewLevel === 'songLibrary') {
    hide(els.contiListView);
    hide(els.songListView);
    show(els.songLibraryView, 'block');
    hide(els.settingsView);
    hide(els.viewerSection);

    hide(els.backBtn);
    show(els.headerLogoArea, 'flex');
    hide(els.viewerHeaderInfo);
    hide(els.addContiBtn);
    hide(els.songListAddBtn);
    hide(els.viewerBpmBtn);
    hide(els.viewerBpmBtnRight);
    hide(els.lockToggleContainer || els.lockBtn);
    hide(els.navIndicator);

    hide(els.leaderToolbar);
    hide(els.userPenToolbar);
    updateZoomVisibility(true);
    updateBottomNavActiveState();
    return;
  }

  // 4. [환경 설정 화면]
  if (state.viewLevel === 'settings') {
    hide(els.contiListView);
    hide(els.songListView);
    hide(els.songLibraryView);
    hide(els.viewerSection);
    show(els.settingsView, 'block');

    hide(els.backBtn);
    show(els.headerLogoArea, 'flex');
    hide(els.viewerHeaderInfo);
    hide(els.addContiBtn);
    hide(els.songListAddBtn);
    hide(els.songListAddLeadSheetBtn);
    hide(els.viewerBpmBtn);
    hide(els.viewerBpmBtnRight);
    hide(els.lockToggleContainer || els.lockBtn);
    hide(els.navIndicator);

    hide(els.leaderToolbar);
    hide(els.userPenToolbar);
    updateZoomVisibility(true);
    updateBottomNavActiveState();
    return;
  }

  // 5. [3단계: 악보 뷰어]
  hide(els.contiListView);
  hide(els.songListView);
  hide(els.songLibraryView);
  hide(els.settingsView);
  show(els.viewerSection, 'flex');

  show(els.backBtn, 'flex');
  if (state.viewerReturnView === 'songLibrary') {
    if (els.backBtnText) els.backBtnText.textContent = '보관함';
  } else {
    if (els.backBtnText) els.backBtnText.textContent = '곡 목록';
  }

  hide(els.headerLogoArea);
  show(els.viewerHeaderInfo, 'flex');
  if (state.viewerReturnView === 'songLibrary') {
    if (els.viewerContiTitle) els.viewerContiTitle.textContent = '악보 보관함';
  } else {
    if (els.viewerContiTitle) els.viewerContiTitle.textContent = currentConti?.title || '예배 콘티';
  }
  const formatViewerSongTitle = (song, idx) => {
    if (!song) return '';
    if (song.isLeadSheet) return `📝 ${song.name || '리드 시트'}`;
    let pureSeq = 0;
    for (let i = 0; i <= idx; i++) {
      if (state.songs[i] && !state.songs[i].isLeadSheet) {
        pureSeq++;
      }
    }
    return `${pureSeq}. ${song.name || '제목 없음'}`;
  };

  if (els.viewerSongTitle) {
    if (isTwoPageViewActive()) {
      const nextSong = state.songs[state.currentIndex + 1];
      if (currentSong && nextSong) {
        const title1 = formatViewerSongTitle(currentSong, state.currentIndex);
        const title2 = formatViewerSongTitle(nextSong, state.currentIndex + 1);
        const isEditing = !state.locked && (state.activeMenu === 'leader' || state.viewerReturnView === 'songLibrary');
        if (isEditing) {
          if (state.activeTwoPageSlot === 'right') {
            els.viewerSongTitle.innerHTML = `<span style="opacity:0.45">${title1}</span> | <span style="color:var(--accent);font-weight:700;">[편집중] ${title2}</span>`;
          } else {
            els.viewerSongTitle.innerHTML = `<span style="color:var(--accent);font-weight:700;">[편집중] ${title1}</span> | <span style="opacity:0.45">${title2}</span>`;
          }
        } else {
          els.viewerSongTitle.textContent = `${title1} | ${title2}`;
        }
      } else if (currentSong) {
        els.viewerSongTitle.textContent = formatViewerSongTitle(currentSong, state.currentIndex);
      } else {
        els.viewerSongTitle.textContent = '악보 없음';
      }
    } else {
      els.viewerSongTitle.textContent = currentSong ? formatViewerSongTitle(currentSong, state.currentIndex) : '악보 없음';
    }
    show(els.viewerSongTitle, 'inline');
  }

  hide(els.addContiBtn);
  hide(els.songListAddBtn);
  hide(els.songListAddLeadSheetBtn);
  updateStylusUI();
  if (hasSongs) {
    show(els.navIndicator, 'inline-flex');
    const isTwo = isTwoPageViewActive();
    const songLeft = currentSong;
    const songRight = isTwo ? state.songs[state.currentIndex + 1] : null;

    // 1. 좌측 곡 템포 (단일 곡 모드이거나 2곡 보기 모드의 좌측 악보)
    if (songLeft && songLeft.tempo) {
      if (els.viewerBpmText) els.viewerBpmText.textContent = songLeft.tempo;
      if (els.viewerBpmBtn) {
        els.viewerBpmBtn.title = isTwo
          ? `[좌측 곡] ${songLeft.name}: ${songLeft.tempo} BPM (클릭하여 소리 듣기)`
          : `템포: ${songLeft.tempo} BPM (클릭하여 소리 듣기)`;
        show(els.viewerBpmBtn, 'inline-flex');
      }
    } else {
      if (els.viewerBpmText) els.viewerBpmText.textContent = '--';
      if (els.viewerBpmBtn) {
        els.viewerBpmBtn.title = isTwo ? `[좌측 곡] ${songLeft?.name || '악보'}: 설정된 템포 없음` : '설정된 템포(BPM) 없음';
        show(els.viewerBpmBtn, 'inline-flex');
      }
    }

    // 2. 우측 곡 템포 (2곡 보기 모드일 때만 활성화)
    if (isTwo && songRight) {
      if (songRight.tempo) {
        if (els.viewerBpmTextRight) els.viewerBpmTextRight.textContent = songRight.tempo;
        if (els.viewerBpmBtnRight) {
          els.viewerBpmBtnRight.title = `[우측 곡] ${songRight.name}: ${songRight.tempo} BPM (클릭하여 소리 듣기)`;
          show(els.viewerBpmBtnRight, 'inline-flex');
        }
      } else {
        if (els.viewerBpmTextRight) els.viewerBpmTextRight.textContent = '--';
        if (els.viewerBpmBtnRight) {
          els.viewerBpmBtnRight.title = `[우측 곡] ${songRight.name}: 설정된 템포 없음`;
          show(els.viewerBpmBtnRight, 'inline-flex');
        }
      }
    } else {
      hide(els.viewerBpmBtnRight);
    }
  } else {
    hide(els.navIndicator);
    hide(els.viewerBpmBtn);
    hide(els.viewerBpmBtnRight);
    stopMetronome();
  }
  const isFromLibrary = (state.viewLevel === 'viewer' && state.viewerReturnView === 'songLibrary');
  if (isFromLibrary) {
    if (els.viewerLibraryShareBtn) {
      show(els.viewerLibraryShareBtn, 'flex');
      const myEmail = state.currentUser?.email || '';
      const isSongShared = Boolean(
        currentSong && (
          currentSong.isShared === true ||
          currentSong.shared === true ||
          (Array.isArray(currentSong.sharedWith) && currentSong.sharedWith.length > 0) ||
          (currentSong.authorEmail && myEmail && currentSong.authorEmail !== myEmail)
        )
      );
      if (isSongShared) {
        els.viewerLibraryShareBtn.style.borderColor = 'var(--accent)';
        els.viewerLibraryShareBtn.style.backgroundColor = 'var(--accent-soft)';
        els.viewerLibraryShareBtn.style.color = 'var(--accent)';
        if (els.viewerLibraryShareLabel) els.viewerLibraryShareLabel.textContent = '공유중';
        els.viewerLibraryShareBtn.title = '찬양팀 공유 중 (클릭하여 개인으로 변경)';
      } else {
        els.viewerLibraryShareBtn.style.borderColor = 'var(--border)';
        els.viewerLibraryShareBtn.style.backgroundColor = 'var(--surface-2)';
        els.viewerLibraryShareBtn.style.color = 'var(--text)';
        if (els.viewerLibraryShareLabel) els.viewerLibraryShareLabel.textContent = '공유하기';
        els.viewerLibraryShareBtn.title = '개인 보관 악보 (클릭하여 찬양팀에 공유)';
      }
    }
  } else {
    if (els.viewerLibraryShareBtn) hide(els.viewerLibraryShareBtn);
  }

  show(els.lockToggleContainer || els.lockBtn, 'flex');
  if (state.locked) {
    show(els.lockClosedIcon, 'flex');
    hide(els.lockOpenIcon);
    if (els.lockBtn) {
      els.lockBtn.className = 'md:hidden h-8 px-2 sm:px-2.5 rounded-full border flex items-center justify-center gap-1.5 active:scale-95 transition-all shrink-0 select-none shadow-sm cursor-pointer lock-view-mode';
      els.lockBtn.style.borderColor = 'var(--border)';
      els.lockBtn.style.backgroundColor = 'var(--surface-2)';
      els.lockBtn.style.color = 'var(--text-dim)';
      if (els.lockBtnLabel) els.lockBtnLabel.textContent = '보기';
      els.lockBtn.title = '보기 모드 (잠김 - 클릭하여 편집 모드로 전환)';
    }
    if (els.lockSwitchViewBtn && els.lockSwitchEditBtn) {
      els.lockSwitchViewBtn.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer lock-switch-active-view';
      els.lockSwitchEditBtn.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer lock-switch-inactive';
    }
  } else {
    hide(els.lockClosedIcon);
    show(els.lockOpenIcon, 'flex');
    if (els.lockBtn) {
      els.lockBtn.className = 'md:hidden h-8 px-2 sm:px-2.5 rounded-full border flex items-center justify-center gap-1.5 active:scale-95 transition-all shrink-0 select-none shadow-sm cursor-pointer lock-edit-mode';
      els.lockBtn.style.borderColor = 'var(--accent)';
      els.lockBtn.style.backgroundColor = 'var(--accent-soft)';
      els.lockBtn.style.color = 'var(--accent)';
      if (els.lockBtnLabel) els.lockBtnLabel.textContent = '편집';
      els.lockBtn.title = '편집 모드 (열림 - 클릭하여 보기 모드로 전환)';
    }
    if (els.lockSwitchViewBtn && els.lockSwitchEditBtn) {
      els.lockSwitchViewBtn.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer lock-switch-inactive';
      els.lockSwitchEditBtn.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer lock-switch-active-edit';
    }
  }

  els.emptyState.style.display = hasSongs ? 'none' : 'flex';
  els.baseCanvas.style.visibility = hasSongs ? 'visible' : 'hidden';
  els.userCanvas.style.visibility = hasSongs ? 'visible' : 'hidden';
  if (els.baseCanvasRight) els.baseCanvasRight.style.visibility = hasSongs ? 'visible' : 'hidden';
  if (els.userCanvasRight) els.userCanvasRight.style.visibility = hasSongs ? 'visible' : 'hidden';
  applyTwoPageDimming();

  const nextSongForSf = isTwoPageViewActive() ? state.songs[state.currentIndex + 1] : null;
  const hasSongform = (currentSong && currentSong.songform && currentSong.songform.length > 0) ||
                      (nextSongForSf && nextSongForSf.songform && nextSongForSf.songform.length > 0);
  const canEditSong = !state.locked && (isLeader || isFromLibrary);
  const showStickyBar = hasSongs && (canEditSong || hasSongform);
  els.songformStickyBar.style.display = showStickyBar ? 'flex' : 'none';

  // [상단 1행] 스티커 부착 바
  if (els.stickerBarRow) {
    els.stickerBarRow.style.display = canEditSong ? 'flex' : 'none';
  }
  if (els.songformChipsList) {
    els.songformChipsList.style.display = canEditSong ? 'flex' : 'none';
  }
  if (els.openChordModalBtn) {
    els.openChordModalBtn.style.display = canEditSong ? 'inline-flex' : 'none';
  }
  if (els.stickerSizeControls) {
    els.stickerSizeControls.style.display = canEditSong ? 'flex' : 'none';
    updateStickerSizeLabel(state.stickerStep || 3);
  }

  // [하단 2행] 송폼 진행 순서 바 (편집 화면에서는 스티커 바 아래로 분리 표시)
  if (els.flowBarRow) {
    const showFlow = hasSongform || canEditSong;
    els.flowBarRow.style.display = showFlow ? 'flex' : 'none';
  }

  const showLeaderToolbar = canEditSong;
  const showUserToolbar = !state.locked && !isLeader && !isFromLibrary;

  els.leaderToolbar.style.display = showLeaderToolbar ? 'flex' : 'none';
  els.userPenToolbar.style.display = showUserToolbar ? 'flex' : 'none';

  const showNav = state.locked && hasSongs && state.songs.length > 1;
  els.navUI.style.display = showNav ? 'block' : 'none';
  els.navUI.classList.toggle('hidden', !showNav);

  const canEditStickers = canEditSong;
  els.stickerLayer.classList.toggle('locked', !canEditStickers);
  if (els.stickerLayerRight) els.stickerLayerRight.classList.toggle('locked', !canEditStickers);
  const canDraw = (!state.locked && !isLeader && hasSongs && !isFromLibrary);
  els.userCanvas.style.pointerEvents = canDraw ? 'auto' : 'none';
  if (els.userCanvasRight) els.userCanvasRight.style.pointerEvents = canDraw ? 'auto' : 'none';

  const canZoom = !state.locked && hasSongs;
  updateZoomVisibility(!canZoom);

  const defaultPenColor = isDark ? '#FFFFFF' : '#000000';
  if (!state.penColor || state.penColor === '#000000' || state.penColor === '#FFFFFF' || state.penColor === '#2B2730') {
    state.penColor = defaultPenColor;
  }

  els.penEraserBtn.style.background = state.eraseMode ? 'var(--accent)' : 'transparent';
  els.penEraserBtn.style.color = state.eraseMode ? '#ffffff' : 'var(--text)';

  const previewSize = state.eraseMode ? state.penSize * 5 : state.penSize;
  els.penSizeDotInner.style.width = Math.max(2, Math.min(36, previewSize)) + 'px';
  els.penSizeDotInner.style.height = Math.max(2, Math.min(36, previewSize)) + 'px';
  els.penSizeDotInner.style.backgroundColor = state.eraseMode ? '#888' : state.penColor;

  updateStylusUI();
  updateHotspotPositions();
  updateNavIndicator();
  renderColorSwatches();
  updateBottomNavActiveState();
}

function updateStylusUI() {
  if (!els.penStylusOnlyBtn) return;
  if (state.stylusOnly) {
    els.penStylusOnlyBtn.style.background = 'var(--accent)';
    els.penStylusOnlyBtn.style.color = '#ffffff';
    els.penStylusOnlyBtn.style.borderColor = 'var(--accent)';
    els.penStylusOnlyBtn.title = '펜 전용 모드 켜짐 ✏️ (손바닥/손가락 터치 필기 무시)';
  } else {
    els.penStylusOnlyBtn.style.background = 'var(--surface-2)';
    els.penStylusOnlyBtn.style.color = 'var(--text)';
    els.penStylusOnlyBtn.style.borderColor = 'var(--border)';
    els.penStylusOnlyBtn.title = '펜 전용 모드 꺼짐 (손가락/펜 터치 모두 허용)';
  }
}

function updateBottomNavActiveState() {
  if (els.bottomNav) {
    const isUserViewer = (state.viewLevel === 'viewer' && state.activeMenu === 'user');
    els.bottomNav.style.display = isUserViewer ? 'none' : 'flex';
  }

  const userActive = state.activeMenu === 'user';
  els.navUserBtn.classList.toggle('active', userActive);
  els.navUserBtn.style.color = userActive ? 'var(--accent)' : 'var(--text-dim)';

  const leaderActive = state.activeMenu === 'leader';
  els.navLeaderBtn.classList.toggle('active', leaderActive);
  els.navLeaderBtn.style.color = leaderActive ? 'var(--accent)' : 'var(--text-dim)';

  const libraryActive = state.activeMenu === 'library';
  els.navSongLibraryBtn.classList.toggle('active', libraryActive);
  els.navSongLibraryBtn.style.color = libraryActive ? 'var(--accent)' : 'var(--text-dim)';

  const settingsActive = state.activeMenu === 'settings';
  els.navSettingsBtn.classList.toggle('active', settingsActive);
  els.navSettingsBtn.style.color = settingsActive ? 'var(--accent)' : 'var(--text-dim)';

  renderContiSessionLineupBar();
}

export function renderContiSessionLineupBar() {
  if (!els.contiSessionLineupBar) return;
  const currentConti = getCurrentConti();
  const sessions = currentConti?.sessions;

  // 1. 하단 메뉴가 숨겨지는 사용자 뷰어 모드이거나, 콘티 화면이 아닌 경우 숨김
  const isUserViewer = (state.viewLevel === 'viewer' && state.activeMenu === 'user');
  const isContiView = (state.viewLevel === 'songList' || state.viewLevel === 'viewer') && Boolean(currentConti);
  if (isUserViewer || !isContiView || !Array.isArray(sessions) || sessions.length === 0) {
    els.contiSessionLineupBar.style.display = 'none';
    return;
  }

  els.contiSessionLineupBar.innerHTML = '';
  els.contiSessionLineupBar.style.display = 'flex';

  const myEmail = (state.currentUser?.email || '').trim().toLowerCase();
  const myName = (state.currentUser?.name || '').trim();

  // 내 파트 배정 여부 확인
  const mySession = sessions.find(s => {
    if (s.email && myEmail && s.email.toLowerCase() === myEmail && myEmail !== 'leader@continote.com') return true;
    if (s.name && myName && s.name === myName && myName !== '찬양인도자') return true;
    return false;
  });

  // 라인업 헤더 뱃지
  const headerBadge = document.createElement('div');
  headerBadge.className = 'shrink-0 flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md';
  headerBadge.style.color = 'var(--accent)';
  headerBadge.style.background = 'var(--surface)';
  headerBadge.innerHTML = `
    <span>라인업</span>
    <span class="text-[10px] opacity-70">${sessions.length}</span>
  `;
  els.contiSessionLineupBar.appendChild(headerBadge);

  // 내 파트가 배정되어 있다면 최우선 하이라이트 뱃지 표시
  if (mySession) {
    const myPartBadge = document.createElement('div');
    myPartBadge.className = 'shrink-0 flex items-center gap-1.5 text-xs font-extrabold px-2.5 py-1 rounded-lg shadow-sm';
    myPartBadge.style.background = 'var(--accent)';
    myPartBadge.style.color = '#ffffff';
    const icon = SESSION_ICONS[mySession.role] || '🎵';
    myPartBadge.innerHTML = `
      <span class="text-xs">⭐ 내 파트:</span>
      <span>${icon} ${escapeHtml(mySession.role)}</span>
    `;
    els.contiSessionLineupBar.appendChild(myPartBadge);
  }

  // 전체 팀원 배정 칩 목록
  sessions.forEach(s => {
    const isMe = mySession && (s === mySession);
    const chip = document.createElement('div');
    chip.className = 'shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-all';
    chip.style.borderColor = isMe ? 'var(--accent)' : 'var(--border)';
    chip.style.background = 'var(--surface)';
    chip.style.color = 'var(--text)';

    const icon = SESSION_ICONS[s.role] || '🎵';
    chip.innerHTML = `
      <span class="text-xs opacity-90">${icon}</span>
      <span class="font-bold text-[11px] opacity-75">${escapeHtml(s.role)}</span>
      <span class="ml-0.5">${escapeHtml(s.name || s.email?.split('@')[0] || '팀원')}</span>
    `;
    els.contiSessionLineupBar.appendChild(chip);
  });
}

function updateHotspotPositions() {
  const horizontal = state.navDirection === 'horizontal';
  if (horizontal) {
    els.hotspotPrev.className = 'absolute pointer-events-auto left-0 top-0 bottom-0 w-1/4 focus:outline-none';
    els.hotspotNext.className = 'absolute pointer-events-auto right-0 top-0 bottom-0 w-1/4 focus:outline-none';
  } else {
    els.hotspotPrev.className = 'absolute pointer-events-auto top-0 left-0 right-0 h-1/4 focus:outline-none';
    els.hotspotNext.className = 'absolute pointer-events-auto bottom-0 left-0 right-0 h-1/4 focus:outline-none';
  }
}

function updateNavIndicator() {
  if (!els.navIndicator) return;
  if (state.songs.length > 0 && state.viewLevel === 'viewer') {
    const curSong = state.songs[state.currentIndex];
    if (curSong?.isLeadSheet) {
      els.navIndicator.textContent = '📝 리드 시트';
      show(els.navIndicator, 'inline-flex');
      return;
    }

    const pureSongs = state.songs.filter(s => !s.isLeadSheet);
    const pureTotal = pureSongs.length;
    let curPureIdx = 0;
    for (let i = 0; i <= state.currentIndex; i++) {
      if (state.songs[i] && !state.songs[i].isLeadSheet) {
        curPureIdx++;
      }
    }

    if (isTwoPageViewActive()) {
      const nextSong = state.songs[state.currentIndex + 1];
      if (nextSong && !nextSong.isLeadSheet && curPureIdx < pureTotal) {
        els.navIndicator.textContent = `${curPureIdx}-${curPureIdx + 1} / ${pureTotal} 곡`;
      } else {
        els.navIndicator.textContent = `${curPureIdx} / ${pureTotal} 곡`;
      }
    } else {
      els.navIndicator.textContent = `${curPureIdx} / ${pureTotal} 곡`;
    }
    show(els.navIndicator, 'inline-flex');
  } else {
    els.navIndicator.textContent = '';
    hide(els.navIndicator);
  }
}

function renderColorSwatches() {
  els.penColorSwatches.innerHTML = '';
  const isDark = isDarkThemeActive();
  const defaultPenColor = isDark ? '#FFFFFF' : '#000000';
  const colorList = [defaultPenColor, '#E0484B', '#3A7BD5', '#2FA84F', '#E8912D', '#9D4EDD'];

  colorList.forEach(color => {
    const btn = document.createElement('button');
    const selected = !state.eraseMode && state.penColor === color;
    btn.className = 'shrink-0 w-7 h-7 rounded-full transition-transform active:scale-90 border';
    btn.style.backgroundColor = color;
    btn.style.borderColor = 'var(--border)';
    btn.style.boxShadow = selected
      ? '0 0 0 2px var(--surface), 0 0 0 4px var(--accent)'
      : '0 0 0 1px var(--border)';
    btn.addEventListener('click', () => {
      state.penColor = color;
      state.eraseMode = false;
      applyUIState();
    });
    els.penColorSwatches.appendChild(btn);
  });
}

let sheetAnimTimer = null;
function triggerSheetTransition(direction) {
  if ((state.pageAnim || 'smooth') !== 'smooth') return;
  if (!els.stageContainer) return;
  const isHorizontal = (state.navDirection || 'horizontal') === 'horizontal';
  const animClass = direction === 'next'
    ? (isHorizontal ? 'sheet-anim-next-h' : 'sheet-anim-next-v')
    : (isHorizontal ? 'sheet-anim-prev-h' : 'sheet-anim-prev-v');

  els.stageContainer.classList.remove('sheet-anim-next-h', 'sheet-anim-prev-h', 'sheet-anim-next-v', 'sheet-anim-prev-v');
  void els.stageContainer.offsetWidth; // Force reflow
  els.stageContainer.classList.add(animClass);

  clearTimeout(sheetAnimTimer);
  sheetAnimTimer = setTimeout(() => {
    if (els.stageContainer) {
      els.stageContainer.classList.remove('sheet-anim-next-h', 'sheet-anim-prev-h', 'sheet-anim-next-v', 'sheet-anim-prev-v');
    }
  }, 220);
}

function goPrev() {
  if (!state.locked) return;
  const step = isTwoPageViewActive() ? 2 : 1;
  if (state.currentIndex > 0) {
    stopMetronome();
    resetZoom();
    state.currentIndex = Math.max(0, state.currentIndex - step);
    saveCurrentMenuSession();
    renderAll();
    triggerSheetTransition('prev');
  }
}

function goNext() {
  if (!state.locked) return;
  const isTwoPage = isTwoPageViewActive();
  const step = isTwoPage ? 2 : 1;
  if (state.currentIndex < state.songs.length - 1) {
    if (isTwoPage && state.currentIndex + 1 >= state.songs.length - 1) {
      return;
    }
    stopMetronome();
    resetZoom();
    state.currentIndex = Math.min(state.songs.length - 1, state.currentIndex + step);
    saveCurrentMenuSession();
    renderAll();
    triggerSheetTransition('next');
  }
}

const STICKER_STEP_SCALES = {
  1: 0.7,
  2: 0.85,
  3: 1.0,
  4: 1.15,
  5: 1.3,
  6: 1.5,
  7: 1.75
};

const BASE_CHORD_CHIPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

function updateStickerSizeLabel(step) {
  if (els.stickerSizeLabel) {
    els.stickerSizeLabel.innerHTML = `<span>${step}</span><span class="hidden sm:inline">단계</span>`;
  }
}

function applyStickerStep(step) {
  const clamped = Math.max(1, Math.min(7, Math.round(step || 3)));
  state.stickerStep = clamped;
  state.stickerScale = STICKER_STEP_SCALES[clamped] || 1.0;
  document.documentElement.style.setProperty('--sticker-scale', state.stickerScale);
  updateStickerSizeLabel(clamped);
  savePreferences();
}

function renderSongformStickyChips() {
  if (els.songformChipsList) {
    els.songformChipsList.innerHTML = '';
    state.songformLabels.forEach(label => {
      const btn = document.createElement('button');
      const isI = (label === 'I');
      btn.className = `shrink-0 px-2 py-0.5 rounded-full border text-xs sm:text-sm font-bold transition-all active:scale-95 shadow-sm ${isI ? 'part-serif-i' : ''}`;
      btn.style.borderColor = 'var(--accent)';
      btn.style.color = 'var(--accent)';
      btn.style.backgroundColor = 'var(--surface)';
      btn.textContent = label;
      btn.title = `[${label}] 스티커 악보에 부착`;
      btn.addEventListener('click', () => placeSongformSticker(label));
      els.songformChipsList.appendChild(btn);
    });
  }

  els.songformFlowDisplayArea.innerHTML = '';
  const isTwoPage = isTwoPageViewActive();
  const songLeft = state.songs[state.currentIndex];
  const songRight = isTwoPage ? (state.songs[state.currentIndex + 1] || null) : null;
  const canEditSong = state.activeMenu === 'leader' || state.viewerReturnView === 'songLibrary';

  function createFlowElement(targetSong, isRightSlot = false) {
    const col = document.createElement('div');
    // 좌/우 50% 영역 내에서 중앙 정렬 & overflow 방지
    col.className = `w-full flex items-center justify-center min-w-0 py-0.5 overflow-x-auto no-scrollbar ${
      isTwoPage && !isRightSlot ? 'border-r border-[var(--border)] pr-2' : ''
    } ${isTwoPage && isRightSlot ? 'pl-2' : ''}`;

    if (!targetSong) {
      // 악보가 없는 빈 슬롯인 경우 최소 높이 유지
      col.innerHTML = '<div class="h-6"></div>';
      return col;
    }

    const hasSf = targetSong.songform && targetSong.songform.length > 0;

    if (hasSf) {
      const flowWrap = document.createElement('div');
      flowWrap.className = 'flex items-center justify-center gap-[1px] flex-nowrap shrink-0 overflow-x-auto no-scrollbar';

      targetSong.songform.forEach((step, idx) => {
        const isI = (step === 'I' || step.startsWith('I×') || step.startsWith('I '));
        const stepChip = document.createElement('span');
        stepChip.className = `inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-xs sm:text-sm font-bold shadow-sm shrink-0 leading-none ${isI ? 'part-serif-i' : ''}`;
        stepChip.style.backgroundColor = 'var(--accent-soft)';
        stepChip.style.color = 'var(--accent)';
        stepChip.innerHTML = formatStepTextHtml(step);
        flowWrap.appendChild(stepChip);

        if (idx < targetSong.songform.length - 1) {
          const arrow = document.createElement('span');
          arrow.className = 'text-[9px] sm:text-[11px] font-bold opacity-30 shrink-0 mx-[0.5px] select-none';
          arrow.textContent = '>';
          flowWrap.appendChild(arrow);
        }
      });

      if (canEditSong) {
        flowWrap.classList.add('cursor-pointer', 'hover:opacity-85');
        flowWrap.title = '탭하여 송폼 진행 순서(Flow) 편집';
        flowWrap.addEventListener('click', () => {
          if (isTwoPage) {
            state.activeTwoPageSlot = isRightSlot ? 'right' : 'left';
            applyUIState();
          }
          openSongformOrderModal(targetSong);
        });
      }
      col.appendChild(flowWrap);
    } else if (canEditSong && !state.locked) {
      const emptyBtn = document.createElement('button');
      emptyBtn.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-dashed text-xs font-semibold active:scale-95 transition-all';
      emptyBtn.style.borderColor = 'var(--border)';
      emptyBtn.style.color = 'var(--text-dim)';
      emptyBtn.innerHTML = `<span>+ 송폼 순서</span>`;
      emptyBtn.addEventListener('click', () => {
        if (isTwoPage) {
          state.activeTwoPageSlot = isRightSlot ? 'right' : 'left';
          applyUIState();
        }
        openSongformOrderModal(targetSong);
      });
      col.appendChild(emptyBtn);
    } else {
      // 송폼이 없는 곡: 높이만 유지하여 레이아웃이 비틀어지지 않게 깔끔한 빈 공간 유지
      col.innerHTML = '<div class="h-6"></div>';
    }
    return col;
  }

  if (isTwoPage) {
    const grid = document.createElement('div');
    grid.className = 'w-full grid grid-cols-2 items-center';
    const leftEl = createFlowElement(songLeft, false);
    const rightEl = createFlowElement(songRight, true);
    grid.appendChild(leftEl);
    grid.appendChild(rightEl);
    els.songformFlowDisplayArea.appendChild(grid);
  } else {
    const singleEl = createFlowElement(songLeft, false);
    if (singleEl) els.songformFlowDisplayArea.appendChild(singleEl);
  }
}

function getViewportCenterStickerCoord(targetContainer = els.sheetContainer, existingStickers = []) {
  if (!els.viewer || !targetContainer) {
    return { x: 50, y: 35 };
  }
  const viewerRect = els.viewer.getBoundingClientRect();
  const targetRect = targetContainer.getBoundingClientRect();

  if (targetRect.width <= 0 || targetRect.height <= 0) {
    return { x: 50, y: 35 };
  }

  // 1. 사용자가 보고 있는 화면(뷰포트) 정중앙의 스크린 픽셀 좌표
  const viewportCenterX = viewerRect.left + viewerRect.width / 2;
  const viewportCenterY = viewerRect.top + viewerRect.height / 2;

  // 2. 화면에 실제 보이는 악보의 가시 영역 (뷰포트와 악보 컨테이너의 교집합)
  const visibleLeft = Math.max(viewerRect.left, targetRect.left);
  const visibleRight = Math.min(viewerRect.right, targetRect.right);
  const visibleTop = Math.max(viewerRect.top, targetRect.top);
  const visibleBottom = Math.min(viewerRect.bottom, targetRect.bottom);

  let closestScreenX = viewportCenterX;
  let closestScreenY = viewportCenterY;

  // 3. 뷰포트 정중앙이 악보 영역 밖(여백 등)일 경우, 악보의 가시 영역 중 가장 가까운 지점으로 클램핑
  if (visibleRight > visibleLeft && visibleBottom > visibleTop) {
    closestScreenX = Math.min(visibleRight, Math.max(visibleLeft, viewportCenterX));
    closestScreenY = Math.min(visibleBottom, Math.max(visibleTop, viewportCenterY));
  } else {
    // 악보가 화면 밖으로 완전히 벗어난 극단적 상태일 경우 악보 자체의 최근접 경계 선택
    closestScreenX = Math.min(targetRect.right, Math.max(targetRect.left, viewportCenterX));
    closestScreenY = Math.min(targetRect.bottom, Math.max(targetRect.top, viewportCenterY));
  }

  // 4. 스크린 좌표를 악보 컨테이너 기준 백분율(%)로 환산
  let nx = ((closestScreenX - targetRect.left) / targetRect.width) * 100;
  let ny = ((closestScreenY - targetRect.top) / targetRect.height) * 100;

  // 스티커가 악보 테두리 밖으로 잘리지 않도록 안전 여백 (6% ~ 94%) 적용
  nx = Math.min(94, Math.max(6, Math.round(nx * 10) / 10));
  ny = Math.min(94, Math.max(6, Math.round(ny * 10) / 10));

  // 5. 연속 부착 시 이전 스티커를 완전히 가리지 않도록 미세 오프셋 적용
  if (Array.isArray(existingStickers) && existingStickers.length > 0) {
    const last = existingStickers[existingStickers.length - 1];
    if (last && Math.abs(last.x - nx) < 3 && Math.abs(last.y - ny) < 3) {
      nx = Math.min(94, nx + 2.5);
      ny = Math.min(94, ny + 2.5);
    }
  }

  return { x: nx, y: ny };
}

function placeSongformSticker(label) {
  if (state.activeMenu !== 'leader' && state.viewerReturnView !== 'songLibrary') return;
  if (state.locked) {
    state.locked = false;
    applyUIState();
  }
  const { song, container, stickerLayer } = getActiveTwoPageEditing();
  if (!song) {
    alert('먼저 악보를 등록해주세요.');
    return;
  }
  const list = state.stickersBySong[song.id] || (state.stickersBySong[song.id] = []);
  const { x, y } = getViewportCenterStickerCoord(container, list);
  list.push({
    id: crypto.randomUUID(),
    type: 'songform',
    label,
    x,
    y
  });
  saveStickers(song.id);
  markViewerDirty();
  renderStickerLayer(stickerLayer, container, song.id);
  if (hasDriveAuth()) {
    if (state.currentContiId) {
      debounceSyncContiDetail(state.currentContiId);
    } else if (state.viewerReturnView === 'songLibrary') {
      debounceSyncLibraryToDrive();
    }
  }
}

function openChordModal() {
  if (state.activeMenu !== 'leader' && state.viewerReturnView !== 'songLibrary') return;
  const { song } = getActiveTwoPageEditing();
  if (!song) {
    alert('먼저 악보를 등록해주세요.');
    return;
  }
  if (state.locked) {
    state.locked = false;
    applyUIState();
  }
  if (els.chordStickerInput) {
    if (!els.chordStickerInput.value || !els.chordStickerInput.value.trim()) {
      els.chordStickerInput.value = 'C';
    }
  }
  updateChordStickerPreview();
  show(els.chordStickerModal, 'flex');
  setTimeout(() => {
    if (els.chordStickerInput) {
      els.chordStickerInput.focus();
      els.chordStickerInput.select();
    }
  }, 50);
}

function updateChordStickerPreview() {
  const val = (els.chordStickerInput?.value || '').trim() || 'C';
  if (els.chordStickerPreview) {
    els.chordStickerPreview.textContent = val;
  }
}

function placeChordSticker(chordText) {
  if (state.activeMenu !== 'leader' && state.viewerReturnView !== 'songLibrary') return;
  const text = (chordText || '').trim();
  if (!text) {
    alert('코드 텍스트를 입력해주세요.');
    return;
  }
  const { song, container, stickerLayer } = getActiveTwoPageEditing();
  if (!song) {
    alert('먼저 악보를 등록해주세요.');
    return;
  }
  const list = state.stickersBySong[song.id] || (state.stickersBySong[song.id] = []);
  const { x, y } = getViewportCenterStickerCoord(container, list);
  list.push({
    id: crypto.randomUUID(),
    type: 'chord',
    label: text,
    x,
    y
  });
  saveStickers(song.id);
  markViewerDirty();
  renderStickerLayer(stickerLayer, container, song.id);
  if (hasDriveAuth()) {
    if (state.currentContiId) {
      debounceSyncContiDetail(state.currentContiId);
    } else if (state.viewerReturnView === 'songLibrary') {
      debounceSyncLibraryToDrive();
    }
  }
  hide(els.chordStickerModal);
}

function setupSwipeNavigation() {
  let startX = 0, startY = 0, startTime = 0, active = false;

  els.viewer.addEventListener('pointerdown', (e) => {
    if (!state.locked) return;
    active = true;
    startX = e.clientX;
    startY = e.clientY;
    startTime = Date.now();
  });

  const onPointerEnd = (e) => {
    if (!active || !state.locked) return;
    active = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const elapsed = Math.max(1, Date.now() - startTime);
    if (elapsed > 1000) return; // 1초 이내 제스처

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const speedX = absX / elapsed; // px/ms
    const speedY = absY / elapsed;

    if (state.navDirection === 'horizontal') {
      // 1) 빠른 플릭(속도 0.35 이상 & 18px) 또는 2) 일반 드래그(28px 이상 & 대각선 40% 관용성)
      const isFlick = speedX > 0.35 && absX >= 18;
      const isDrag = absX >= 28 && absX > absY * 0.6;
      if (isFlick || isDrag) {
        if (dx < 0) goNext();
        else goPrev();
      }
    } else {
      // 수직 넘김 모드
      const isFlick = speedY > 0.35 && absY >= 18;
      const isDrag = absY >= 28 && absY > absX * 0.6;
      if (isFlick || isDrag) {
        if (dy < 0) goNext();
        else goPrev();
      }
    }
  };

  els.viewer.addEventListener('pointerup', onPointerEnd);
  els.viewer.addEventListener('pointercancel', () => { active = false; });
}

/* ==================================================
   모바일/태블릿 가상 키보드 감지 및 모달 위치 보정 엔진
   ================================================== */
function setupVirtualKeyboardHandler() {
  let scrollTimeout = null;

  function updateMetrics() {
    const isMobileOrTablet = window.innerWidth <= 1024 || ('ontouchstart' in window);
    const active = document.activeElement;
    const isInputFocused = !!(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT'));
    const isInsideModal = isInputFocused && !!active.closest('.app-modal, [id$="Modal"]');

    if (window.visualViewport) {
      const vv = window.visualViewport;
      const baseHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
      const rawKeyboardHeight = baseHeight - vv.height;

      // 키보드 높이가 100px 이상 줄어들었거나 모달 내 인풋 포커스 상태인 경우
      const isKeyboardOpen = isMobileOrTablet && (rawKeyboardHeight > 100 || (isInsideModal && rawKeyboardHeight > 40));
      const keyboardHeight = isKeyboardOpen ? Math.max(0, Math.round(rawKeyboardHeight)) : 0;
      const visibleHeight = isKeyboardOpen ? Math.round(vv.height) : baseHeight;

      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      document.documentElement.style.setProperty('--visual-viewport-height', `${visibleHeight}px`);
      document.documentElement.style.setProperty('--visual-viewport-top', `${Math.round(vv.offsetTop)}px`);

      if (isKeyboardOpen) {
        document.body.classList.add('keyboard-open');
        if (isInsideModal) {
          clearTimeout(scrollTimeout);
          scrollTimeout = setTimeout(() => {
            if (document.activeElement === active) {
              active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }, 150);
        }
      } else {
        document.body.classList.remove('keyboard-open');
      }
    } else {
      // visualViewport 미지원 브라우저 폴백
      if (isInsideModal && isMobileOrTablet) {
        document.body.classList.add('keyboard-open');
        document.documentElement.style.setProperty('--keyboard-height', '260px');
        document.documentElement.style.setProperty('--visual-viewport-height', `${window.innerHeight - 260}px`);
      } else {
        document.body.classList.remove('keyboard-open');
        document.documentElement.style.setProperty('--keyboard-height', '0px');
        document.documentElement.style.setProperty('--visual-viewport-height', '100vh');
      }
    }
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateMetrics);
    window.visualViewport.addEventListener('scroll', updateMetrics);
  }
  window.addEventListener('resize', updateMetrics);

  document.addEventListener('focusin', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      setTimeout(updateMetrics, 50);
      setTimeout(updateMetrics, 250);
    }
  });

  document.addEventListener('focusout', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      setTimeout(updateMetrics, 100);
    }
  });

  updateMetrics();
}

/* ==================================================
   크롭 및 신규 악보 메타데이터 모달 파이프라인
   ================================================== */
let pendingCroppedData = null;
let songUploadTarget = 'library'; // 'conti' | 'library'

function openCropModalWithFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.cropTarget = {
        img,
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        songId: null,
        name: file.name.replace(/\.[^/.]+$/, '') || `악보 ${state.songs.length + 1}`
      };
      startCropModalSession();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function openCropModalForSong(song, preferredMode = 'auto') {
  const img = new Image();
  img.onload = () => {
    state.cropTarget = {
      img,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
      songId: song.id,
      name: song.name
    };
    startCropModalSession(preferredMode);
  };
  img.src = song.original || song.image;
}

function startCropModalSession(preferredMode = 'auto') {
  const { img, songId } = state.cropTarget;
  if (els.cropApplyBtn) {
    els.cropApplyBtn.innerHTML = '<span>다음: 비율 조정</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4"><path d="M9 18l6-6-6-6"/></svg>';
  }
  const autoBox = computeAutoCropBox(img);
  state.cropAutoBox = autoBox;
  state.cropManualBox = {
    x1: autoBox.x,
    y1: autoBox.y,
    x2: autoBox.x + autoBox.w,
    y2: autoBox.y + autoBox.h
  };
  setCropMode(preferredMode);
  show(els.cropModal, 'flex');
}

function setCropMode(mode) {
  state.cropMode = mode;
  setButtonActive(els.cropAutoTabBtn, mode === 'auto');
  setButtonActive(els.cropManualTabBtn, mode === 'manual');

  if (mode === 'auto') {
    hide(els.cropBox);
    els.cropHintText.textContent = '단색 여백을 정밀 분석하여 최적 비율로 자동 잘라냈습니다.';
    els.cropDisplayImg.onload = null;
    els.cropDisplayImg.src = renderCroppedDataURL(state.cropTarget.img, state.cropAutoBox);
  } else {
    els.cropHintText.textContent = '핸들을 드래그하여 자를 영역을 조절하세요.';
    els.cropDisplayImg.onload = () => {
      syncCropBoxDOM(els.cropBox, els.cropDisplayImg, state.cropTarget, state.cropManualBox);
      show(els.cropBox, 'block');
    };
    els.cropDisplayImg.src = state.cropTarget.img.src;
  }
}

/* ==================================================
   [2단계] 악보 비율 조정(Ratio Scaling) 모달 파이프라인
   ================================================== */
let ratioState = {
  croppedUrl: null,
  originalUrl: null,
  name: '',
  songId: null,
  cropTarget: null,
  cropMode: 'auto',
  cropAutoBox: null,
  cropManualBox: null,
  img: null,
  wScale: 1.0,
  hScale: 1.0
};

function updateRatioDisplays() {
  const wPct = Math.round(ratioState.wScale * 100);
  const hPct = Math.round(ratioState.hScale * 100);
  if (els.ratioWidthVal) els.ratioWidthVal.textContent = `${wPct}%`;
  if (els.ratioHeightVal) els.ratioHeightVal.textContent = `${hPct}%`;

  if (els.ratioAspectVal && ratioState.img) {
    const nw = ratioState.img.naturalWidth || 800;
    const nh = ratioState.img.naturalHeight || 1100;
    const effW = nw * ratioState.wScale;
    const effH = nh * ratioState.hScale;
    const ratio = (effH / effW).toFixed(2);
    els.ratioAspectVal.textContent = `1 : ${ratio}`;
  }
}

function setRatioScale(w, h) {
  ratioState.wScale = Math.max(0.6, Math.min(1.5, Math.round(w * 100) / 100));
  ratioState.hScale = Math.max(0.6, Math.min(1.5, Math.round(h * 100) / 100));
  updateRatioDisplays();

  // 언제나 원본 기준(1.0) 캔버스에 대해 GPU transform scale로 일관되게 제어 (다회 조작 시에도 왜곡 0%)
  if (els.ratioStage) {
    els.ratioStage.style.transform = `scale(${ratioState.wScale}, ${ratioState.hScale})`;
  }
}

function openRatioModal({ croppedUrl, originalUrl, name, songId = null, cropTarget = null, cropMode = 'auto', cropAutoBox = null, cropManualBox = null }) {
  ratioState = {
    croppedUrl,
    originalUrl,
    name,
    songId,
    cropTarget,
    cropMode,
    cropAutoBox,
    cropManualBox,
    img: null,
    wScale: 1.0,
    hScale: 1.0
  };

  // 모달 하단 버튼 라벨 동적 갱신
  if (els.ratioNextBtn) {
    if (songId) {
      els.ratioNextBtn.innerHTML = '<span>악보에 적용하기</span>';
    } else {
      els.ratioNextBtn.innerHTML = '<span>다음: 곡 정보 입력</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4"><path d="M9 18l6-6-6-6" /></svg>';
    }
  }
  if (els.ratioPrevBtn) {
    if (cropTarget) {
      els.ratioPrevBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4"><path d="M15 18l-6-6 6-6" /></svg><span>이전 (크롭)</span>';
    } else {
      els.ratioPrevBtn.innerHTML = '<span>취소</span>';
    }
  }

  if (els.ratioStage) {
    els.ratioStage.style.transform = 'none';
  }

  const img = new Image();
  img.onload = () => {
    ratioState.img = img;
    renderRatioPreview();
    updateRatioDisplays();
    show(els.ratioModal, 'flex');
  };
  img.src = croppedUrl;
}

function openRatioModalForSong(song) {
  if (!song) return;
  const targetUrl = song.image || song.original;
  if (!targetUrl) return;

  const img = new Image();
  img.onload = () => {
    openRatioModal({
      croppedUrl: targetUrl,
      originalUrl: song.original || targetUrl,
      name: song.name,
      songId: song.id,
      cropTarget: null
    });
  };
  img.src = targetUrl;
}

function renderRatioPreview() {
  if (!ratioState.img || !els.ratioCanvas) return;
  const nw = ratioState.img.naturalWidth || 800;
  const nh = ratioState.img.naturalHeight || 1100;

  // 캔버스 자체는 항상 원본 해상도(100%)로 유지하여 2회 이상 조절 시에도 왜곡 및 뻥튀기 원천 방지
  els.ratioCanvas.width = nw;
  els.ratioCanvas.height = nh;

  const ctx = els.ratioCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ratioState.img, 0, 0, nw, nh);
}

// 최종 저장 및 적용 시점에만 1회 고품질 확정 렌더링 (고효율 WebP/JPEG 0.85 압축)
function getFinalScaledImageUrl() {
  if (!ratioState.img) return null;
  const nw = ratioState.img.naturalWidth || 800;
  const nh = ratioState.img.naturalHeight || 1100;
  let tw = Math.max(10, Math.round(nw * ratioState.wScale));
  let th = Math.max(10, Math.round(nh * ratioState.hScale));

  const maxDim = 1800;
  if (tw > maxDim || th > maxDim) {
    if (tw > th) {
      th = Math.round((th * maxDim) / tw);
      tw = maxDim;
    } else {
      tw = Math.round((tw * maxDim) / th);
      th = maxDim;
    }
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = tw;
  offscreen.height = th;
  const ctx = offscreen.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, tw, th);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ratioState.img, 0, 0, tw, th);

  try {
    const webp = offscreen.toDataURL('image/webp', 0.85);
    if (webp.startsWith('data:image/webp')) return webp;
  } catch (_) {}
  return offscreen.toDataURL('image/jpeg', 0.85);
}

let editingSongMetaId = null;

// 기존 등록된 곡 메타데이터 수정 모달 오픈
function openSongMetaModalForEdit(song) {
  if (!song) return;
  editingSongMetaId = song.id;
  pendingCroppedData = null;

  if (els.songMetaModalTitle) els.songMetaModalTitle.textContent = '곡 정보 수정';
  if (els.songMetaSaveBtn) els.songMetaSaveBtn.textContent = '수정 완료';

  els.songMetaNameInput.value = song.name || '';
  els.songMetaKeySelect.value = song.key || '';
  els.songMetaTimeSigSelect.value = song.timeSig || '4/4';
  els.songMetaTempoInput.value = song.tempo || '';
  updateSongMetaBpmBtnState();
  renderSongMetaThemesContainer(song.themes || []);

  if (els.songMetaLibrarySyncRow) {
    show(els.songMetaLibrarySyncRow, 'block');
    const isAlreadyInLib = (state.allSongs || []).some(s => s.id === song.id);
    if (isAlreadyInLib) {
      els.songMetaAddToLibraryCheckbox.checked = true;
      els.songMetaAddToLibraryCheckbox.disabled = true;
      if (els.songMetaAddToLibraryLabel) els.songMetaAddToLibraryLabel.textContent = '마스터 악보 보관함에 등록됨 (동기화 중)';
      if (els.songMetaAddToLibraryDesc) els.songMetaAddToLibraryDesc.textContent = '이 곡은 이미 보관함에 등록되어 있어 정보가 함께 자동 동기화됩니다.';
    } else {
      els.songMetaAddToLibraryCheckbox.checked = false;
      els.songMetaAddToLibraryCheckbox.disabled = false;
      if (els.songMetaAddToLibraryLabel) els.songMetaAddToLibraryLabel.textContent = '마스터 악보 보관함(곡 목록)에도 등록하기';
      if (els.songMetaAddToLibraryDesc) els.songMetaAddToLibraryDesc.textContent = '체크 시 현재 콘티뿐 아니라 마스터 보관함에도 새로 등록하여 보존합니다.';
    }
  }

  show(els.songMetaModal, 'flex');
  setTimeout(() => els.songMetaNameInput.focus(), 100);
}

// 중복 감지 상태 임시 보관
let duplicateMatchState = null;

// 신규 곡 메타데이터 모달 오픈
function openSongMetaModal(croppedUrl, originalUrl, defaultName, pHash = null, targetSongId = null) {
  editingSongMetaId = null;
  pendingCroppedData = { croppedUrl, originalUrl, pHash, targetSongId };

  if (targetSongId) {
    if (els.songMetaModalTitle) els.songMetaModalTitle.textContent = '새로운 버전 악보 등록';
    if (els.songMetaSaveBtn) els.songMetaSaveBtn.textContent = '버전 등록 완료';
  } else {
    if (els.songMetaModalTitle) els.songMetaModalTitle.textContent = '악보 정보 입력';
    if (els.songMetaSaveBtn) els.songMetaSaveBtn.textContent = '악보 등록 완료';
  }

  els.songMetaNameInput.value = defaultName || '';
  els.songMetaKeySelect.value = '';
  els.songMetaTimeSigSelect.value = '4/4';
  els.songMetaTempoInput.value = '';
  updateSongMetaBpmBtnState();
  renderSongMetaThemesContainer([]);

  if (els.songMetaLibrarySyncRow) {
    if (songUploadTarget === 'library' || targetSongId) {
      hide(els.songMetaLibrarySyncRow);
    } else {
      show(els.songMetaLibrarySyncRow, 'block');
      els.songMetaAddToLibraryCheckbox.checked = true;
      els.songMetaAddToLibraryCheckbox.disabled = false;
      if (els.songMetaAddToLibraryLabel) els.songMetaAddToLibraryLabel.textContent = '마스터 악보 보관함(곡 목록)에도 함께 등록';
      if (els.songMetaAddToLibraryDesc) els.songMetaAddToLibraryDesc.textContent = '체크 시 보관함에 영구 보존되어 다른 콘티에서도 언제든 꺼내 쓸 수 있습니다.';
    }
  }

  show(els.songMetaModal, 'flex');
  setTimeout(() => els.songMetaNameInput.focus(), 100);
}

// 악보 이미지 pHash 유사도 검사 후 중복 모달 또는 메타데이터 모달 오픈
async function checkDuplicateAndOpenMetaModal(finalUrl, originalUrl, defaultName) {
  let pHash = null;
  try {
    pHash = await computeImageHash(finalUrl);
  } catch (err) {
    console.warn('pHash 계산 실패:', err);
  }

  // 중복 비교 대상: 로컬 보관함 곡(state.allSongs) 및 기존 곡들
  const candidateSongs = (state.allSongs && state.allSongs.length > 0) ? state.allSongs : (state.songs || []);
  
  if (pHash && candidateSongs.length > 0) {
    const match = findMatchingSong(pHash, candidateSongs, 85);
    if (match.isMatch && match.matchedSong) {
      duplicateMatchState = {
        matchedSong: match.matchedSong,
        similarity: match.similarity,
        finalUrl,
        originalUrl,
        defaultName,
        pHash
      };
      if (els.dupSongMatchedTitle) {
        els.dupSongMatchedTitle.textContent = match.matchedSong.title || match.matchedSong.name || '알 수 없는 곡';
      }
      if (els.dupSongSimilarityBadge) {
        els.dupSongSimilarityBadge.textContent = `유사도 ${match.similarity}%`;
      }
      show(els.duplicateSongModal, 'flex');
      return;
    }
  }

  // 일치하는 곡이 없으면 바로 곡 정보 입력 모달 오픈
  openSongMetaModal(finalUrl, originalUrl, defaultName, pHash, null);
}

let selectedMetaThemes = [];
function renderSongMetaThemesContainer(initialThemes = []) {
  selectedMetaThemes = [...initialThemes];
  els.songMetaThemesContainer.innerHTML = '';
  state.themes.forEach(theme => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const isSelected = selectedMetaThemes.includes(theme);
    chip.className = `px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${isSelected ? 'active-theme' : ''}`;
    chip.style.borderColor = isSelected ? 'var(--accent)' : 'var(--border)';
    chip.style.backgroundColor = isSelected ? 'var(--accent)' : 'var(--surface-2)';
    chip.style.color = isSelected ? '#ffffff' : 'var(--text)';
    chip.textContent = `# ${theme}`;
    chip.addEventListener('click', () => {
      const idx = selectedMetaThemes.indexOf(theme);
      if (idx !== -1) selectedMetaThemes.splice(idx, 1);
      else selectedMetaThemes.push(theme);
      renderSongMetaThemesContainer(selectedMetaThemes);
    });
    els.songMetaThemesContainer.appendChild(chip);
  });
}

/* ==================================================
   송폼 진행 순서(Flow) 모달
   ================================================== */
let currentOrderFlow = [];
let currentOrderSong = null;

function openSongformOrderModal(targetSong = null) {
  const song = targetSong || getActiveTwoPageEditing().song;
  if (!song) {
    alert('먼저 악보를 등록해주세요.');
    return;
  }
  currentOrderSong = song;
  els.songformOrderSongTitle.textContent = `현재 곡: ${song.name}`;
  currentOrderFlow = Array.isArray(song.songform) ? [...song.songform] : [];

  if (els.songformStepInput) els.songformStepInput.value = '';

  els.songformPickerChips.innerHTML = '';
  state.songformLabels.forEach(label => {
    const isI = (label === 'I');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `px-3.5 py-2 min-h-[38px] rounded-xl border text-sm font-bold transition-all active:scale-95 shadow-sm flex items-center justify-center ${isI ? 'part-serif-i' : ''}`;
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';
    btn.style.backgroundColor = 'var(--surface)';
    btn.textContent = `+ ${label}`;
    btn.title = `[${label}] 파트를 입력창에 채우기`;
    btn.addEventListener('click', () => {
      if (els.songformStepInput) {
        els.songformStepInput.value = label;
        els.songformStepInput.focus();
        const len = label.length;
        els.songformStepInput.setSelectionRange(len, len);
      }
    });
    els.songformPickerChips.appendChild(btn);
  });

  renderSongformOrderFlowList();
  show(els.songformOrderModal, 'flex');
  setTimeout(() => { if (els.songformStepInput) els.songformStepInput.focus(); }, 100);
}

function addSongformStep(step) {
  const trimmed = String(step || '').trim();
  if (!trimmed) return;
  currentOrderFlow.push(trimmed);
  if (els.songformStepInput) {
    els.songformStepInput.value = '';
    els.songformStepInput.focus();
  }
  renderSongformOrderFlowList();
}

function calculateSongformDropSlot(clientX, clientY, currentIdx) {
  const chipEls = Array.from(els.songformFlowList.querySelectorAll('.songform-flow-chip'));
  if (!chipEls.length) return 0;

  // 드래그 중인 자기 자신을 제외한 나머지 칩들과 비교
  const otherChips = chipEls
    .map((el, i) => ({ el, origIdx: Number(el.dataset.flowIndex ?? i), rect: el.getBoundingClientRect() }))
    .filter(c => c.origIdx !== currentIdx);

  if (!otherChips.length) return 0;

  // 같은 행(row)에 있는 칩들 필터링 (44px 높이 고려하여 수직 거리 24px 이내 허용)
  const chipsWithVDist = otherChips.map(c => {
    let vDist = 0;
    if (clientY < c.rect.top) vDist = c.rect.top - clientY;
    else if (clientY > c.rect.bottom) vDist = clientY - c.rect.bottom;
    return { ...c, vDist };
  });

  const minVDist = Math.min(...chipsWithVDist.map(c => c.vDist));
  const rowChips = chipsWithVDist.filter(c => c.vDist <= minVDist + 24);
  const targetRow = rowChips.length ? rowChips : chipsWithVDist;
  targetRow.sort((a, b) => a.rect.left - b.rect.left);

  for (let i = 0; i < targetRow.length; i++) {
    const c = targetRow[i];
    const midX = c.rect.left + c.rect.width / 2;
    if (clientX < midX) {
      return c.origIdx;
    }
  }
  const last = targetRow[targetRow.length - 1];
  return last.origIdx + 1;
}

function updateSongformDropIndicator(slot, dropIndicator) {
  if (!dropIndicator || !els.songformFlowList) return;
  const chipEls = Array.from(els.songformFlowList.querySelectorAll('.songform-flow-chip'));
  if (slot <= 0) {
    if (els.songformFlowList.firstChild !== dropIndicator) {
      els.songformFlowList.insertBefore(dropIndicator, els.songformFlowList.firstChild);
    }
  } else if (slot >= chipEls.length) {
    if (els.songformFlowList.lastChild !== dropIndicator) {
      els.songformFlowList.appendChild(dropIndicator);
    }
  } else {
    const target = chipEls[slot];
    if (target && target.previousSibling !== dropIndicator && target !== dropIndicator) {
      els.songformFlowList.insertBefore(dropIndicator, target);
    }
  }
}

function renderSongformOrderFlowList() {
  els.songformFlowList.innerHTML = '';
  if (!currentOrderFlow.length) {
    els.songformFlowList.innerHTML = `<span id="songformFlowEmptyHint" class="text-xs" style="color:var(--text-dim)">입력 후 [추가]를 누르면 순서가 연결됩니다</span>`;
    return;
  }

  currentOrderFlow.forEach((step, idx) => {
    const isI = (step === 'I' || step.startsWith('I×') || step.startsWith('I '));
    const chip = document.createElement('div');
    chip.className = `songform-flow-chip inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-2xl text-sm sm:text-base font-bold shadow-md cursor-grab active:cursor-grabbing hover:opacity-95 active:scale-95 transition-all select-none ${isI ? 'part-serif-i' : ''}`;
    chip.style.backgroundColor = 'var(--accent)';
    chip.style.color = '#ffffff';
    chip.style.touchAction = 'none';
    chip.style.userSelect = 'none';
    chip.style.webkitUserSelect = 'none';
    chip.dataset.flowIndex = idx;
    chip.title = '길게 눌러 이동 · 더블 탭 시 삭제';

    // 점 6개 및 ◀ ▶ × 없이 송폼 파트 텍스트만 깔끔하고 시원하게 표시
    chip.innerHTML = `<span class="chip-label pointer-events-none leading-none select-none">${formatStepTextHtml(step)}</span>`;

    // 더블 탭 / 더블 클릭 감지 변수
    let lastTapTime = 0;

    // 모바일/태블릿 터치 & 마우스 롱프레스 드래그 앤 드롭 엔진
    let isDragging = false;
    let hasDragged = false;
    let holdTimer = null;
    let ghostEl = null;
    let dropIndicator = null;
    let targetSlot = idx;
    let pointerId = null;
    let startX = 0, startY = 0;

    const startDrag = () => {
      if (isDragging) return;
      isDragging = true;
      hasDragged = true;
      if (navigator.vibrate) {
        try { navigator.vibrate(25); } catch (_) {}
      }

      chip.style.opacity = '0.35';
      chip.style.transform = 'scale(0.94)';

      ghostEl = document.createElement('div');
      ghostEl.className = `fixed pointer-events-none z-[99999] min-h-[44px] px-4 py-2 rounded-2xl text-sm sm:text-base font-bold shadow-2xl flex items-center justify-center select-none ${isI ? 'part-serif-i' : ''}`;
      ghostEl.style.backgroundColor = 'var(--accent)';
      ghostEl.style.color = '#ffffff';
      ghostEl.style.boxShadow = '0 12px 30px -4px rgba(0, 0, 0, 0.5), 0 0 18px var(--accent)';
      ghostEl.style.transform = (pointerId !== null && window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        ? 'translate(-50%, -125%) scale(1.12)'
        : 'translate(-50%, -50%) scale(1.08)';
      ghostEl.style.left = `${startX}px`;
      ghostEl.style.top = `${startY}px`;
      ghostEl.style.transition = 'transform 0.08s ease-out';
      ghostEl.innerHTML = `<span class="leading-none select-none">${formatStepTextHtml(step)}</span>`;
      document.body.appendChild(ghostEl);

      dropIndicator = document.createElement('div');
      dropIndicator.className = 'songform-drop-indicator shrink-0 inline-flex items-center justify-center';
      dropIndicator.innerHTML = '<span class="w-1.5 h-10 rounded-full animate-pulse shadow-md" style="background:var(--accent);box-shadow:0 0 12px var(--accent)"></span>';
      dropIndicator.style.margin = '0 6px';

      updateSongformDropIndicator(idx, dropIndicator);
    };

    const deleteThisChip = () => {
      if (navigator.vibrate) {
        try { navigator.vibrate([20, 35, 20]); } catch (_) {}
      }
      chip.style.transition = 'transform 0.15s ease-out, opacity 0.15s ease-out';
      chip.style.transform = 'scale(0.2)';
      chip.style.opacity = '0';
      setTimeout(() => {
        currentOrderFlow.splice(idx, 1);
        renderSongformOrderFlowList();
      }, 130);
    };

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
      }
      pointerId = e.pointerId;
      try {
        chip.setPointerCapture(e.pointerId);
      } catch (_) {}

      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;
      hasDragged = false;
      targetSlot = idx;

      // 180ms 동안 누르고 있으면 잡고 이동(드래그) 시작
      holdTimer = setTimeout(startDrag, 180);

      const onPointerMove = (me) => {
        if (me.pointerId !== pointerId) return;
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        if (!isDragging) {
          if (Math.hypot(dx, dy) >= 6) {
            clearTimeout(holdTimer);
            startDrag();
          } else {
            return;
          }
        }

        try { me.preventDefault(); } catch (_) {}
        if (ghostEl) {
          ghostEl.style.left = `${me.clientX}px`;
          ghostEl.style.top = `${me.clientY}px`;
        }

        targetSlot = calculateSongformDropSlot(me.clientX, me.clientY, idx);
        if (dropIndicator) {
          updateSongformDropIndicator(targetSlot, dropIndicator);
        }
      };

      const onPointerUp = (ue) => {
        if (ue.pointerId !== pointerId) return;
        clearTimeout(holdTimer);
        try {
          chip.releasePointerCapture(ue.pointerId);
        } catch (_) {}

        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        chip.removeEventListener('pointermove', onPointerMove);
        chip.removeEventListener('pointerup', onPointerUp);
        chip.removeEventListener('pointercancel', onPointerUp);

        if (ghostEl && ghostEl.parentNode) {
          ghostEl.parentNode.removeChild(ghostEl);
          ghostEl = null;
        }
        if (dropIndicator && dropIndicator.parentNode) {
          dropIndicator.parentNode.removeChild(dropIndicator);
          dropIndicator = null;
        }
        chip.style.opacity = '';
        chip.style.transform = '';

        if (isDragging) {
          // 드래그 완료 후 순서 재배치
          const newIndex = (targetSlot > idx) ? (targetSlot - 1) : targetSlot;
          if (newIndex !== idx && newIndex >= 0 && newIndex < currentOrderFlow.length) {
            const [movedItem] = currentOrderFlow.splice(idx, 1);
            currentOrderFlow.splice(newIndex, 0, movedItem);
            if (navigator.vibrate) {
              try { navigator.vibrate(15); } catch (_) {}
            }
            renderSongformOrderFlowList();
          }
        } else {
          // 드래그가 아닌 단순 터치/클릭: 더블 탭(더블 클릭) 감지
          const now = Date.now();
          if (now - lastTapTime < 320) {
            lastTapTime = 0;
            deleteThisChip();
          } else {
            lastTapTime = now;
          }
        }
      };

      chip.addEventListener('pointermove', onPointerMove, { passive: false });
      chip.addEventListener('pointerup', onPointerUp);
      chip.addEventListener('pointercancel', onPointerUp);
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    chip.addEventListener('pointerdown', onPointerDown);

    // 데스크톱 마우스 더블클릭 이벤트 안전 지원
    chip.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      e.preventDefault();
      deleteThisChip();
    });

    els.songformFlowList.appendChild(chip);

    if (idx < currentOrderFlow.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'text-sm font-black opacity-30 select-none shrink-0 mx-0.5';
      arrow.textContent = '›';
      els.songformFlowList.appendChild(arrow);
    }
  });
}

/* ==================================================
   환경 설정 화면 관리 (송폼 라벨, 주제 태그, 테마, 네비게이션)
   ================================================== */
export function renderSettingsView() {
  state.viewLevel = 'settings';
  saveCurrentMenuSession();
  renderSongformManageList();
  renderThemeManageList();
  updateSettingsUIButtons();
}

function renderSongformManageList() {
  els.songformManageList.innerHTML = '';
  state.songformLabels.forEach((label, idx) => {
    const isI = (label === 'I');
    const chip = document.createElement('span');
    chip.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${isI ? 'part-serif-i' : ''}`;
    chip.style.borderColor = 'var(--border)';
    chip.style.backgroundColor = 'var(--surface)';
    chip.innerHTML = `
      <span>${escapeHtml(label)}</span>
      <button data-remove-index="${idx}" class="text-neutral-400 hover:text-red-500 font-bold ml-0.5 text-sm leading-none" title="삭제">×</button>
    `;
    els.songformManageList.appendChild(chip);
  });
}

function renderThemeManageList() {
  if (!els.themeManageList) return;
  els.themeManageList.innerHTML = '';
  state.themes.forEach((theme, idx) => {
    const chip = document.createElement('span');
    chip.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border';
    chip.style.borderColor = 'var(--border)';
    chip.style.backgroundColor = 'var(--surface)';
    chip.innerHTML = `
      <span># ${escapeHtml(theme)}</span>
      <button data-remove-theme="${idx}" class="text-neutral-400 hover:text-red-500 font-bold ml-1 text-xs">×</button>
    `;
    els.themeManageList.appendChild(chip);
  });

  els.themeManageList.querySelectorAll('[data-remove-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeTheme);
      state.themes.splice(idx, 1);
      savePreferences();
      renderThemeManageList();
    });
  });
}

function updateSettingsUIButtons() {
  setButtonActive(els.themeSystemBtn, state.theme === 'system');
  setButtonActive(els.themeLightBtn, state.theme === 'light');
  setButtonActive(els.themeDarkBtn, state.theme === 'dark');
  setButtonActive(els.navHBtn, state.navDirection === 'horizontal');
  setButtonActive(els.navVBtn, state.navDirection === 'vertical');
  if (els.pageAnimSmoothBtn) setButtonActive(els.pageAnimSmoothBtn, (state.pageAnim || 'smooth') === 'smooth');
  if (els.pageAnimInstantBtn) setButtonActive(els.pageAnimInstantBtn, state.pageAnim === 'instant');
  if (els.viewCount1Btn) setButtonActive(els.viewCount1Btn, state.viewSheetCount === 1);
  if (els.viewCount2Btn) setButtonActive(els.viewCount2Btn, (state.viewSheetCount || 2) === 2);
}

/* ==================================================
   이벤트 리스너 연결
   ================================================== */
function wireEventListeners() {
  // 클라우드 동기화 완료 시 실시간 스티커 리프레시 이벤트 등록
  window.addEventListener('continote:stickers-synced', () => {
    if (state.viewLevel === 'viewer' && state.songs && state.songs.length) {
      const curSong = state.songs[state.currentIndex];
      if (curSong) {
        renderStickerLayer(els.stickerLayer, els.sheetContainer, curSong.id);
      }
      if (isTwoPageViewActive() && els.stickerLayerRight) {
        const nextSong = state.songs[state.currentIndex + 1];
        if (nextSong) {
          renderStickerLayer(els.stickerLayerRight, els.sheetContainerRight, nextSong.id);
        }
      }
    }
  });

  // 악보 보관함 클라우드 동기화 완료 시 실시간 곡 목록 리프레시 이벤트 등록
  window.addEventListener('continote:library-synced', () => {
    if (state.viewLevel === 'songLibrary') {
      renderSongLibraryView();
    }
    if (state.viewLevel === 'viewer' && state.viewerReturnView === 'songLibrary') {
      renderSongformStickyChips();
    }
  });

  // 뷰어 DOM 크기 변경 시(다른 메뉴 전환 후 복귀, 창 크기 변경, 가로/세로 회전 등) 100% 화면 맞춤 렌더링 보장
  if (typeof ResizeObserver !== 'undefined' && els.viewer) {
    let lastViewerW = 0;
    let lastViewerH = 0;
    let resizeTimer = null;

    const viewerObserver = new ResizeObserver((entries) => {
      if (state.viewLevel !== 'viewer' || !state.songs || !state.songs.length) return;
      for (const entry of entries) {
        const cr = entry.contentRect;
        const nw = Math.floor(cr.width);
        const nh = Math.floor(cr.height);
        if (nw > 0 && nh > 0 && (Math.abs(nw - lastViewerW) > 2 || Math.abs(nh - lastViewerH) > 2)) {
          lastViewerW = nw;
          lastViewerH = nh;
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            if (state.viewLevel === 'viewer') {
              renderAll();
            }
          }, 80);
        }
      }
    });
    viewerObserver.observe(els.viewer);
  }

  // 인증 관련
  els.headerGoogleLoginBtn.addEventListener('click', handleLoginClick);
  els.headerProfileChip.addEventListener('click', handleProfileClick);

  // 헤더 상위 메뉴 이동 버튼 (계층적 Up Navigation: 악보 뷰어 -> 곡 목록 -> 콘티 목록)
  els.backBtn.addEventListener('click', () => {
    handleDirectBack();
  });

  // 콘티 추가
  els.addContiBtn.addEventListener('click', () => openContiModal(null));
  if (els.emptyContiCreateBtn) {
    els.emptyContiCreateBtn.addEventListener('click', () => openContiModal(null));
  }

  // 콘티 저장
  els.contiSaveBtn.addEventListener('click', async () => {
    const title = els.contiTitleInput.value.trim();
    if (!title) {
      alert('콘티 제목을 입력해주세요.');
      els.contiTitleInput.focus();
      return;
    }
    const date = els.contiDateInput.value;
    if (!date) {
      alert('예배 일자를 입력해주세요.');
      els.contiDateInput.focus();
      return;
    }
    const memo = els.contiMemoInput.value.trim();

    // 찬양팀 세션 배정 데이터 추출 (완전 독립 FIX 스냅샷)
    const sessionRows = els.contiSessionList ? els.contiSessionList.querySelectorAll('[data-session-row]') : [];
    const sessions = [];
    sessionRows.forEach(row => {
      const selects = row.querySelectorAll('select');
      const role = selects[0]?.value || '';
      const memberSelect = selects[1];
      const email = memberSelect?.value || '';
      const selectedOpt = memberSelect?.selectedOptions?.[0];
      const name = (selectedOpt?.dataset?.name || selectedOpt?.textContent?.split(' (')[0] || '').trim();
      if (role && (name || email)) {
        sessions.push({ role, name, email });
      }
    });
    const sessionEmails = sessions.map(s => s.email).filter(Boolean);

    let savedConti = null;
    if (editingContiId) {
      const target = state.contis.find(c => c.id === editingContiId);
      if (target) {
        target.title = title;
        target.date = date;
        target.memo = memo;
        target.sessions = sessions; // FIX 스냅샷 저장
        target.orgId = state.currentUser?.orgId || target.orgId || '';
        // 세션 팀원들의 이메일도 sharedWith에 자동 포함하여 열람 권한 부여
        const mergedShared = Array.from(new Set([...(target.sharedWith || []), ...sessionEmails]));
        target.sharedWith = mergedShared;
        target.updatedAt = Date.now();
        savedConti = target;
      }
    } else {
      const authorName = (state.currentUser && state.currentUser.name && state.currentUser.name !== '찬양인도자')
        ? state.currentUser.name
        : (state.currentUser?.email?.includes('@') && state.currentUser.email !== 'leader@continote.com' ? state.currentUser.email.split('@')[0] : '인도자');
      const newConti = {
        id: crypto.randomUUID(),
        orgId: state.currentUser?.orgId || '',
        title,
        date,
        memo,
        authorEmail: state.currentUser?.email || 'leader@continote.com',
        authorName: authorName,
        sharedWith: sessionEmails,
        sessions: sessions, // FIX 스냅샷 저장
        songs: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      state.contis.unshift(newConti);
      savedConti = newConti;
    }
    await saveContis();
    if (savedConti) {
      syncContiToFirestore(savedConti);
    }
    if (hasDriveAuth()) {
      syncContisIndexToDrive(state.contis, true);
    }
    hide(els.contiModal);
    renderContiListView();
    applyUIState();
  });
  if (els.addContiSessionRowBtn) {
    els.addContiSessionRowBtn.addEventListener('click', () => {
      renderContiSessionRow();
    });
  }
  document.querySelectorAll('[data-close-conti-modal]').forEach(el => el.addEventListener('click', () => hide(els.contiModal)));

  // 공유 모달: 이메일 추가 및 링크 복사
  els.addShareEmailBtn.addEventListener('click', async () => {
    const email = els.shareEmailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      alert('올바른 Google 이메일을 입력해주세요.');
      els.shareEmailInput.focus();
      return;
    }
    const conti = state.contis.find(c => c.id === sharingContiId);
    if (conti) {
      if (!conti.sharedWith) conti.sharedWith = [];
      if (!conti.sharedWith.includes(email)) {
        conti.sharedWith.push(email);
        await saveContis();
        syncContiToFirestore(conti);
        els.shareEmailInput.value = '';
        renderShareEmailList();
        renderShareOrgMemberList(els.shareMemberSearchInput?.value || '');
      } else {
        alert('이미 공유 목록에 포함되어 있는 이메일입니다.');
      }
    }
  });

  els.copyShareLinkBtn.addEventListener('click', () => {
    const url = `${window.location.origin}${window.location.pathname}#share=${sharingContiId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('콘티 공유 링크가 클립보드에 복사되었습니다!\n찬양팀원에게 링크를 전달하세요.');
    }).catch(() => {
      prompt('콘티 공유 링크입니다. 복사하세요:', url);
    });
  });
  document.querySelectorAll('[data-close-share-modal]').forEach(el => el.addEventListener('click', () => hide(els.shareModal)));



  // 헤더 악보 뷰어 템포(BPM) 메트로놈 재생/정지 버튼 (좌측 곡 / 단일 곡)
  if (els.viewerBpmBtn) {
    els.viewerBpmBtn.addEventListener('click', () => {
      const song = getCurrentSong();
      const tempo = song?.tempo ? parseInt(song.tempo, 10) : 0;
      if (!tempo || tempo < 20 || tempo > 300) {
        showSyncToast('설정된 템포(BPM)가 없습니다. 악보 정보에서 템포를 등록해주세요.', 'error');
        return;
      }
      const timeSig = song?.timeSig || '4/4';
      toggleMetronome(tempo, els.viewerBpmBtn, timeSig);
    });
  }

  // 2곡 보기 모드 시 우측 곡 템포(BPM) 메트로놈 재생/정지 버튼
  if (els.viewerBpmBtnRight) {
    els.viewerBpmBtnRight.addEventListener('click', () => {
      const songRight = isTwoPageViewActive() ? state.songs[state.currentIndex + 1] : null;
      const tempo = songRight?.tempo ? parseInt(songRight.tempo, 10) : 0;
      if (!tempo || tempo < 20 || tempo > 300) {
        showSyncToast('우측 악보에 설정된 템포(BPM)가 없습니다. 악보 정보에서 템포를 등록해주세요.', 'error');
        return;
      }
      const timeSig = songRight?.timeSig || '4/4';
      toggleMetronome(tempo, els.viewerBpmBtnRight, timeSig);
    });
  }

  // 2면 편집 시 악보 터치/클릭으로 활성 편집 슬롯 전환 (디밍 토글)
  if (els.sheetContainer) {
    els.sheetContainer.addEventListener('click', (e) => {
      if (!state.locked && isTwoPageViewActive() && state.activeTwoPageSlot === 'right') {
        if (!e.target.closest('.sticker-item') && !e.target.closest('button')) {
          state.activeTwoPageSlot = 'left';
          applyUIState();
          renderSongformStickyChips();
        }
      }
    });
  }
  if (els.sheetContainerRight) {
    els.sheetContainerRight.addEventListener('click', (e) => {
      if (!state.locked && isTwoPageViewActive() && state.activeTwoPageSlot === 'left') {
        if (!e.target.closest('.sticker-item') && !e.target.closest('button')) {
          state.activeTwoPageSlot = 'right';
          applyUIState();
          renderSongformStickyChips();
        }
      }
    });
  }

  // 콘티 내 곡 추가 버튼들 (현재 콘티에만 추가)
  if (els.songListAddBtn) {
    els.songListAddBtn.addEventListener('click', () => {
      if (state.activeMenu !== 'leader') return;
      songUploadTarget = 'conti';
      els.fileInput.click();
    });
  }
  if (els.songListAddLeadSheetBtn) {
    els.songListAddLeadSheetBtn.addEventListener('click', () => {
      if (state.activeMenu !== 'leader') return;
      openLeadSheetModal(null);
    });
  }
  if (els.leadSheetSaveBtn) {
    els.leadSheetSaveBtn.addEventListener('click', saveLeadSheetFromModal);
  }
  document.querySelectorAll('[data-close-lead-sheet-modal]').forEach(el => {
    el.addEventListener('click', closeLeadSheetModal);
  });
  if (els.emptySongAddBtn) {
    els.emptySongAddBtn.addEventListener('click', () => {
      if (state.activeMenu !== 'leader') return;
      songUploadTarget = 'conti';
      els.fileInput.click();
    });
  }

  // 보기/편집 모드 전환 공통 처리
  async function toggleLockMode(targetLocked = null) {
    const nextLocked = targetLocked !== null ? targetLocked : !state.locked;
    if (state.locked === nextLocked) return;
    const wasEditing = !state.locked;
    state.locked = nextLocked;
    if (state.locked) {
      resetZoom();
      if (isTwoPageViewActive() && state.currentIndex % 2 !== 0) {
        state.currentIndex = Math.floor(state.currentIndex / 2) * 2;
      }
    }
    saveCurrentMenuSession();
    applyUIState();
    await renderAll();

    // 편집 상태에서 보기 상태로 자물쇠를 닫을 때 실제 변경사항(isViewerDirty)이 있을 때만 저장 수행
    if (wasEditing && state.locked && isViewerDirty) {
      if (hasDriveAuth()) {
        if (state.viewerReturnView === 'songLibrary') {
          syncLibraryToDrive(state.allSongs, true);
        } else if (state.currentContiId) {
          syncContiDetailToDrive(state.currentContiId, true);
        }
      }
      isViewerDirty = false;
    }
  }

  // 모바일 전용 토글 버튼 클릭
  if (els.lockBtn) {
    els.lockBtn.addEventListener('click', () => toggleLockMode());
  }
  // 태블릿 이상 좌우 스위치 토글 버튼 클릭
  if (els.lockSwitchViewBtn) {
    els.lockSwitchViewBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLockMode(true);
    });
  }
  if (els.lockSwitchEditBtn) {
    els.lockSwitchEditBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLockMode(false);
    });
  }

  // 악보 보관함 뷰어 전용 공유 토글 버튼
  if (els.viewerLibraryShareBtn) {
    els.viewerLibraryShareBtn.addEventListener('click', async () => {
      const currentSong = getCurrentSong();
      if (!currentSong) return;
      const myEmail = state.currentUser?.email || '';
      const isSongShared = Boolean(
        currentSong.isShared === true ||
        currentSong.shared === true ||
        (Array.isArray(currentSong.sharedWith) && currentSong.sharedWith.length > 0) ||
        (currentSong.authorEmail && myEmail && currentSong.authorEmail !== myEmail)
      );

      currentSong.isShared = !isSongShared;
      currentSong.shared = currentSong.isShared;
      await saveLibrarySong(currentSong);
      if (hasDriveAuth()) {
        syncLibraryToDrive(state.allSongs, false);
      }
      showSyncToast(currentSong.isShared ? '‘공유’ 악보로 설정되었습니다' : '‘개인’ 악보로 설정되었습니다', 'info');
      applyUIState();
    });
  }

  // 하단 4대 메뉴 네비게이션: 메뉴별 독립 세션으로 이전 작업/편집 상태 보존!
  els.navUserBtn.addEventListener('click', () => switchToMenu('user'));
  els.navLeaderBtn.addEventListener('click', () => switchToMenu('leader'));
  els.navSongLibraryBtn.addEventListener('click', () => switchToMenu('library'));

  els.navSettingsBtn.addEventListener('click', () => switchToMenu('settings'));

  // 마스터 악보 보관함 검색 & 업로드
  if (els.libraryUploadBtn) {
    els.libraryUploadBtn.addEventListener('click', () => {
      songUploadTarget = 'library';
      els.fileInput.click();
    });
  }
  if (els.librarySearchInput) {
    els.librarySearchInput.addEventListener('input', debounce(renderSongLibraryView, 200));
  }

  if (els.addToContiSearchInput) {
    els.addToContiSearchInput.addEventListener('input', (e) => {
      renderAddToContiCandidateList(e.target.value);
    });
  }

  // 내 콘티에 악보 추가 확인
  if (els.confirmAddToContiBtn) {
    els.confirmAddToContiBtn.addEventListener('click', async () => {
      const selected = document.querySelector('input[name="targetContiRadio"]:checked');
      if (!selected || !targetAddToContiSong) return;
      const targetConti = state.contis.find(c => c.id === selected.value);
      if (targetConti) {
        // [핵심 데이터 보호] 2단계 지연 로딩(Lazy-loading)으로 인해 아직 songs가 메모리에 로드되지 않은 콘티인 경우,
        // 기존 상세 곡 목록을 먼저 로드해와야 기존 곡들이 유실(덮어쓰기)되지 않음!
        if ((!targetConti.songs || targetConti.songs.length === 0) && (targetConti.songCount > 0 || targetConti._needDetailSync)) {
          showSyncToast('콘티 상세 데이터 불러오는 중...', 'loading');
          if (hasDriveAuth()) {
            await syncContiDetailFromDrive(targetConti.id, true);
          }
        }
        if (!targetConti.songs) targetConti.songs = [];

        const newSongId = crypto.randomUUID();
        const isFull = targetAddToContiMode === 'full';

        const cloned = {
          ...targetAddToContiSong,
          id: newSongId,
          songId: targetAddToContiSong.id,
          masterSongId: targetAddToContiSong.masterSongId || targetAddToContiSong.id,
          authorName: targetAddToContiSong.authorName || state.currentUser?.name || '인도자',
          authorEmail: targetAddToContiSong.authorEmail || state.currentUser?.email || '',
          isShared: targetAddToContiSong.isShared !== undefined ? targetAddToContiSong.isShared : true,
          songform: (isFull && Array.isArray(targetAddToContiSong.songform)) ? [...targetAddToContiSong.songform] : [],
          order: targetConti.songs.length
        };
        targetConti.songs.push(cloned);
        targetConti.songCount = targetConti.songs.length;
        targetConti.updatedAt = new Date().toISOString();

        // 전체 가져오기일 때만 스티커 복사
        if (isFull) {
          const origStickers = state.stickersBySong[targetAddToContiSong.id] || (await loadStickers(targetAddToContiSong.id));
          if (origStickers && origStickers.length) {
            state.stickersBySong[newSongId] = origStickers.map(st => ({ ...st, id: crypto.randomUUID() }));
            await saveStickers(newSongId);
          }
        }

        await saveContis();
        syncContiToFirestore(targetConti);
        if (state.currentContiId === targetConti.id) {
          state.songs = targetConti.songs;
          if (state.viewLevel === 'songList') renderSongListView();
        }
        if (hasDriveAuth() && targetConti.id) {
          syncContiDetailToDrive(targetConti.id, true);
          syncContisIndexToDrive(state.contis, false);
        }
        hide(els.addToContiModal);
        const modeDesc = isFull ? '전체(악보+송폼+스티커)' : '악보';
        showSyncToast(`'${targetConti.title}' 콘티에 '${targetAddToContiSong.name}' ${modeDesc}를 담았습니다!`, 'success');
      }
    });
  }
  document.querySelectorAll('[data-close-add-to-conti]').forEach(el => el.addEventListener('click', () => hide(els.addToContiModal)));

  // 파일 업로드
  els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) openCropModalWithFile(file);
    e.target.value = '';
  });

  // 크롭 적용 -> 신규 악보 메타데이터 모달 오픈
  els.cropAutoTabBtn.addEventListener('click', () => setCropMode('auto'));
  els.cropManualTabBtn.addEventListener('click', () => setCropMode('manual'));
  els.cropCancelBtn.addEventListener('click', () => {
    hide(els.cropModal);
    state.cropTarget = null;
  });

  els.cropApplyBtn.addEventListener('click', () => {
    const { img, songId, name } = state.cropTarget;
    let box;
    if (state.cropMode === 'auto') {
      box = state.cropAutoBox;
    } else {
      const b = state.cropManualBox;
      box = {
        x: b.x1,
        y: b.y1,
        w: Math.max(10, b.x2 - b.x1),
        h: Math.max(10, b.y2 - b.y1)
      };
    }
    const croppedUrl = renderCroppedDataURL(img, box);
    hide(els.cropModal);

    // 신규 곡이든 기존 곡이든 2단계 비율 조정 모달로 연속 이동
    openRatioModal({
      croppedUrl,
      originalUrl: img.src,
      name,
      songId: songId || null,
      cropTarget: state.cropTarget,
      cropMode: state.cropMode,
      cropAutoBox: state.cropAutoBox,
      cropManualBox: state.cropManualBox
    });
    state.cropTarget = null;
  });

  // 2단계 악보 비율 조정 모달 이벤트
  if (els.ratioResetBtn) {
    els.ratioResetBtn.addEventListener('click', () => {
      setRatioScale(1.0, 1.0);
    });
  }

  document.querySelectorAll('.ratio-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pw = parseFloat(btn.dataset.w) || 100;
      const ph = parseFloat(btn.dataset.h) || 100;
      setRatioScale(pw / 100, ph / 100);
    });
  });

  // 악보 4개 변 중앙 핸들 드래그 (떨림 없는 부드러운 스케일링)
  if (els.ratioStage) {
    els.ratioStage.querySelectorAll('.ratio-handle').forEach(handle => {
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
        const edge = handle.dataset.edge;

        const startPointerX = e.clientX;
        const startPointerY = e.clientY;
        const startWScale = ratioState.wScale;
        const startHScale = ratioState.hScale;

        // 기준 치수(스케일 적용 전 실제 화면 픽셀 크기) 계산
        const rect = els.ratioStage.getBoundingClientRect();
        const baseW = Math.max(50, rect.width / startWScale);
        const baseH = Math.max(50, rect.height / startHScale);

        const onMove = (ev) => {
          const dx = ev.clientX - startPointerX;
          const dy = ev.clientY - startPointerY;

          let curW = ratioState.wScale;
          let curH = ratioState.hScale;

          // 중앙 기준 양방향 확장이므로 델타 * 2
          if (edge === 'right') {
            curW = startWScale + (dx / (baseW / 2));
          } else if (edge === 'left') {
            curW = startWScale - (dx / (baseW / 2));
          } else if (edge === 'bottom') {
            curH = startHScale + (dy / (baseH / 2));
          } else if (edge === 'top') {
            curH = startHScale - (dy / (baseH / 2));
          }

          // GPU transform으로 1.0 원본 기준 부드러운 스케일링
          setRatioScale(curW, curH);
        };

        const onUp = () => {
          try { handle.releasePointerCapture(e.pointerId); } catch (_) { }
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
        };

        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
      });
    });
  }

  // 비율 모달 -> 1단계 크롭 모달로 이전 (복귀) 또는 닫기
  if (els.ratioPrevBtn) {
    els.ratioPrevBtn.addEventListener('click', () => {
      hide(els.ratioModal);
      if (ratioState.cropTarget) {
        state.cropTarget = ratioState.cropTarget;
        state.cropAutoBox = ratioState.cropAutoBox;
        state.cropManualBox = ratioState.cropManualBox;
        setCropMode(ratioState.cropMode || 'auto');
        show(els.cropModal, 'flex');
      }
    });
  }

  // 비율 모달 -> 3단계 곡 정보 입력 모달 (신규) 또는 기존 곡 저장
  if (els.ratioNextBtn) {
    els.ratioNextBtn.addEventListener('click', async () => {
      const finalUrl = getFinalScaledImageUrl();
      if (!finalUrl) return;
      hide(els.ratioModal);

      // 기존 곡 재편집 모드: 바로 악보 업데이트 및 동기화 저장
      if (ratioState.songId) {
        const song = state.songs.find(s => s.id === ratioState.songId);
        if (song) {
          song.image = finalUrl;
          await saveSongs();
          await saveLibrarySong(song);
          await renderAll();
          if (hasDriveAuth()) {
            if (state.currentContiId) {
              syncContiDetailToDrive(state.currentContiId, true);
            } else if (state.viewerReturnView === 'songLibrary') {
              syncLibraryToDrive(state.allSongs, true);
            }
          }
        }
        return;
      }

      // 신규 곡 등록: pHash 중복 검사 후 적절한 모달(중복 감지 or 정보 입력)로 이동
      await checkDuplicateAndOpenMetaModal(finalUrl, ratioState.originalUrl, ratioState.name);
    });
  }

  // [중복 감지 모달]: '새로운 버전으로 등록' 버튼 클릭
  if (els.dupSongAddVersionBtn) {
    els.dupSongAddVersionBtn.addEventListener('click', () => {
      if (!duplicateMatchState) return;
      hide(els.duplicateSongModal);
      const matched = duplicateMatchState.matchedSong;
      openSongMetaModal(
        duplicateMatchState.finalUrl,
        duplicateMatchState.originalUrl,
        matched.title || matched.name,
        duplicateMatchState.pHash,
        matched.id
      );
    });
  }

  // [중복 감지 모달]: '별도 새로운 독립 곡으로 등록' 버튼 클릭
  if (els.dupSongCreateNewBtn) {
    els.dupSongCreateNewBtn.addEventListener('click', () => {
      if (!duplicateMatchState) return;
      hide(els.duplicateSongModal);
      openSongMetaModal(
        duplicateMatchState.finalUrl,
        duplicateMatchState.originalUrl,
        duplicateMatchState.defaultName,
        duplicateMatchState.pHash,
        null
      );
    });
  }

  // [중복 감지 모달]: 닫기/취소
  document.querySelectorAll('[data-close-duplicate-modal]').forEach(el => {
    el.addEventListener('click', () => hide(els.duplicateSongModal));
  });

  // 곡 메타데이터 저장 핸들러 (신규 등록 및 기존 곡 수정 통합)
  els.songMetaSaveBtn.addEventListener('click', async () => {
    const name = els.songMetaNameInput.value.trim();
    if (!name) {
      alert('곡명을 입력해주세요.');
      els.songMetaNameInput.focus();
      return;
    }
    const key = els.songMetaKeySelect.value;
    const timeSig = els.songMetaTimeSigSelect.value;
    const tempo = els.songMetaTempoInput.value.trim();
    const themes = [...selectedMetaThemes];

    // [기존 곡 수정 모드]
    if (editingSongMetaId) {
      const targetSong = state.songs.find(s => s.id === editingSongMetaId);
      const targetSongKey = targetSong ? generateSongKey(targetSong.name, targetSong.key) : '';
      const libSong = state.allSongs.find(s => 
        s.id === editingSongMetaId ||
        (targetSong?.masterSongId && s.id === targetSong.masterSongId) ||
        (targetSong?.songId && s.id === targetSong.songId) ||
        (targetSongKey && generateSongKey(s.name, s.key) === targetSongKey)
      );
      const baseSong = targetSong || libSong;

      if (baseSong) {
        const prevThemes = baseSong.themes || [];
        const isThemesSame = prevThemes.length === themes.length &&
          prevThemes.every((t, i) => t === themes[i]);
        const isSame = (
          baseSong.name === name &&
          (baseSong.key || '') === key &&
          (baseSong.timeSig || '4/4') === timeSig &&
          (baseSong.tempo || '') === tempo &&
          isThemesSame
        );
        const shouldSyncToLib = els.songMetaAddToLibraryCheckbox ? els.songMetaAddToLibraryCheckbox.checked : false;
        const isNewLibAddition = !libSong && shouldSyncToLib;

        if (isSame && !isNewLibAddition) {
          // 변경사항 전혀 없음: 불필요한 클라우드 업로드/DB 저장 생략
          stopMetronome();
          hide(els.songMetaModal);
          editingSongMetaId = null;
          return;
        }
      }

      // 1. 현재 콘티 목록에서 업데이트
      if (targetSong) {
        targetSong.name = name;
        targetSong.key = key;
        targetSong.timeSig = timeSig;
        targetSong.tempo = tempo;
        targetSong.themes = themes;
        targetSong.songKey = generateSongKey(name, key);
        targetSong.updatedAt = Date.now();
        await saveSongs();
        if (state.currentContiId) {
          const currentConti = state.contis.find(c => c.id === state.currentContiId);
          if (currentConti) {
            currentConti.songs = state.songs;
            currentConti.updatedAt = Date.now();
            syncContiToFirestore(currentConti);
          }
        }
        if (hasDriveAuth() && state.currentContiId) {
          syncContiDetailToDrive(state.currentContiId, true);
        }
      }

      // 2. 마스터 악보 보관함(라이브러리)에서도 일괄 업데이트 또는 사후 신규 등록
      const shouldSyncToLib = els.songMetaAddToLibraryCheckbox ? els.songMetaAddToLibraryCheckbox.checked : false;

      if (libSong) {
        libSong.name = name;
        libSong.key = key;
        libSong.songKey = generateSongKey(name, key);
        libSong.timeSig = timeSig;
        libSong.tempo = tempo;
        libSong.themes = themes;
        libSong.updatedAt = Date.now();
        await saveLibrarySong(libSong);
        if (targetSong) {
          targetSong.masterSongId = libSong.id;
        }
        if (state.currentUser?.orgId) {
          updateSongMaster(libSong.id, {
            title: name,
            initialKey: key,
            timeSig,
            tempo,
            themes,
            authorName: libSong.authorName || state.currentUser?.name || '',
            authorEmail: libSong.authorEmail || state.currentUser?.email || '',
            isShared: libSong.isShared !== undefined ? libSong.isShared : true
          });
        }
        if (hasDriveAuth()) {
          syncLibraryToDrive(state.allSongs, true);
        }
      } else if (targetSong && shouldSyncToLib) {
        await saveLibrarySong(targetSong);
        if (state.currentUser?.orgId) {
          addSongMaster({
            id: targetSong.id,
            orgId: state.currentUser.orgId,
            title: name,
            pHash: targetSong.pHash || '',
            imageSource: targetSong.image,
            initialKey: key,
            tempo,
            timeSig,
            themes,
            authorName: targetSong.authorName || state.currentUser?.name || '인도자',
            authorEmail: targetSong.authorEmail || state.currentUser?.email || '',
            isShared: true,
            createdByUid: state.currentUser?.uid || ''
          });
        }
        if (hasDriveAuth()) {
          syncLibraryToDrive(state.allSongs, true);
        }
        showSyncToast('마스터 악보 보관함에 등록되었습니다', 'success');
      } else if (targetSong && state.currentUser?.orgId) {
        const masterId = targetSong.masterSongId || targetSong.id;
        updateSongMaster(masterId, {
          title: name,
          initialKey: key,
          timeSig,
          tempo,
          themes
        });
      }

      stopMetronome();
      hide(els.songMetaModal);
      editingSongMetaId = null;
      renderSongListView();
      if (state.viewLevel === 'songLibrary') renderSongLibraryView();
      applyUIState();
      return;
    }

    // [신규 곡 또는 버전 등록 모드]
    const masterSongId = pendingCroppedData?.targetSongId || null;
    const pHash = pendingCroppedData?.pHash || null;
    const songKey = generateSongKey(name, key);

    // 이미 보관함에 동일한 고유키(곡명+코드)의 마스터 악보가 존재하는지 검사!
    const existingLibSong = state.allSongs.find(s => 
      (masterSongId && s.id === masterSongId) ||
      generateSongKey(s.name, s.key) === songKey
    );

    const targetMasterId = existingLibSong ? existingLibSong.id : (masterSongId || crypto.randomUUID());

    const newSong = {
      id: (target === 'library' && existingLibSong) ? existingLibSong.id : crypto.randomUUID(),
      masterSongId: targetMasterId,
      songKey,
      pHash: pHash || existingLibSong?.pHash || null,
      name,
      key,
      timeSig,
      tempo: tempo || existingLibSong?.tempo || '',
      themes: themes.length > 0 ? themes : (existingLibSong?.themes || []),
      image: pendingCroppedData.croppedUrl || existingLibSong?.image || '',
      original: pendingCroppedData.originalUrl || existingLibSong?.original || '',
      order: state.songs.length,
      songform: (existingLibSong && Array.isArray(existingLibSong.songform) && existingLibSong.songform.length > 0)
        ? [...existingLibSong.songform]
        : [],
      createdAt: existingLibSong?.createdAt || Date.now(),
      authorEmail: existingLibSong?.authorEmail || state.currentUser?.email || 'leader@continote.com',
      authorName: existingLibSong?.authorName || state.currentUser?.name || '인도자',
      isShared: true
    };

    // Firebase 클라우드 백엔드 연동 (로그인 및 조직 소속 시 자동 백그라운드 등록)
    const currentOrgId = state.currentUser?.orgId || null;
    if (currentOrgId) {
      if (masterSongId && !existingLibSong) {
        saveSongVersion(masterSongId, {
          orgId: currentOrgId,
          createdByUid: state.currentUser?.uid || '',
          createdByName: state.currentUser?.name || '인도자',
          versionName: `${name} (인도자 버전)`,
          songForm: [],
          stickers: [],
          bpm: Number(tempo) || 0
        }).catch(err => console.warn('클라우드 버전 저장 실패(오프라인 유지):', err));
      } else {
        addSongMaster({
          id: targetMasterId,
          orgId: currentOrgId,
          title: name,
          pHash: pHash || '',
          imageSource: pendingCroppedData.croppedUrl,
          initialKey: key,
          tempo: tempo,
          timeSig: timeSig,
          themes: themes,
          songForm: newSong.songform || [],
          authorEmail: newSong.authorEmail,
          authorName: newSong.authorName,
          isShared: true,
          createdByUid: state.currentUser?.uid || ''
        }).catch(err => console.warn('클라우드 마스터 곡 저장 실패(오프라인 유지):', err));
      }
    }

    // 업로드 대상에 따른 분기 저장 (콘티에 추가 vs 곡 목록에 추가)
    const target = songUploadTarget || (state.viewLevel === 'songList' ? 'conti' : 'library');
    const shouldAlsoAddToLib = els.songMetaAddToLibraryCheckbox ? els.songMetaAddToLibraryCheckbox.checked : true;

    if (target === 'library') {
      // 1. [곡 목록(보관함)에 추가]: 마스터 악보 라이브러리에 저장
      await saveLibrarySong(newSong);
      if (hasDriveAuth()) {
        syncLibraryToDrive(state.allSongs, true);
      }
      if (state.viewLevel === 'songLibrary') {
        renderSongLibraryView();
      }
    } else {
      // 2. [콘티에 악보 추가]: 현재 콘티에 추가
      if (state.currentContiId) {
        state.songs.push(newSong);
        await saveSongs();
        const currentConti = state.contis.find(c => c.id === state.currentContiId);
        if (currentConti) {
          currentConti.songs = state.songs;
          currentConti.updatedAt = Date.now();
          syncContiToFirestore(currentConti);
        }
        if (hasDriveAuth() && state.currentContiId) {
          syncContiDetailToDrive(state.currentContiId, true);
        }
        renderSongListView();
      }
      // 마스터 보관함 함께 등록 옵션이 체크되어 있다면 라이브러리에도 동시 저장!
      if (shouldAlsoAddToLib) {
        await saveLibrarySong(newSong);
        if (hasDriveAuth()) {
          syncLibraryToDrive(state.allSongs, true);
        }
        if (state.viewLevel === 'songLibrary') {
          renderSongLibraryView();
        }
      }
    }

    stopMetronome();
    hide(els.songMetaModal);
    pendingCroppedData = null;
    applyUIState();
  });
  document.querySelectorAll('[data-close-songmeta]').forEach(el => el.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    stopMetronome();
    hide(els.songMetaModal);
  }));

  // 곡 정보 모달 내 템포/박자 입력 시 BPM 버튼 활성화 및 실시간 미리듣기
  if (els.songMetaTempoInput) {
    els.songMetaTempoInput.addEventListener('input', updateSongMetaBpmBtnState);
  }
  if (els.songMetaTimeSigSelect) {
    els.songMetaTimeSigSelect.addEventListener('change', updateSongMetaBpmBtnState);
  }
  if (els.songMetaBpmBtn) {
    els.songMetaBpmBtn.addEventListener('click', () => {
      const bpm = parseInt(els.songMetaTempoInput.value.trim(), 10);
      const timeSig = els.songMetaTimeSigSelect?.value || '4/4';
      if (bpm && bpm >= 20 && bpm <= 300) {
        toggleMetronome(bpm, els.songMetaBpmBtn, timeSig);
      }
    });
  }

  // 수동 크롭 핸들 드래그 (4개 모서리 + 4개 변 중앙)
  els.cropBox.querySelectorAll('.crop-handle').forEach(handle => {
    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      const corner = handle.dataset.corner;
      const edge = handle.dataset.edge;

      const onMove = (ev) => {
        const stageRect = els.cropStage.getBoundingClientRect();
        const scale = els.cropDisplayImg.clientWidth / state.cropTarget.naturalW;
        let nx = (ev.clientX - stageRect.left) / scale;
        let ny = (ev.clientY - stageRect.top) / scale;
        nx = Math.min(Math.max(nx, 0), state.cropTarget.naturalW);
        ny = Math.min(Math.max(ny, 0), state.cropTarget.naturalH);

        const b = state.cropManualBox;
        const minW = 20 / scale;
        // 4개 모서리 조절
        if (corner === 'tl') { b.x1 = Math.min(nx, b.x2 - minW); b.y1 = Math.min(ny, b.y2 - minW); }
        if (corner === 'tr') { b.x2 = Math.max(nx, b.x1 + minW); b.y1 = Math.min(ny, b.y2 - minW); }
        if (corner === 'bl') { b.x1 = Math.min(nx, b.x2 - minW); b.y2 = Math.max(ny, b.y1 + minW); }
        if (corner === 'br') { b.x2 = Math.max(nx, b.x1 + minW); b.y2 = Math.max(ny, b.y1 + minW); }

        // 4개 변 중앙 조절
        if (edge === 'top') { b.y1 = Math.min(ny, b.y2 - minW); }
        if (edge === 'bottom') { b.y2 = Math.max(ny, b.y1 + minW); }
        if (edge === 'left') { b.x1 = Math.min(nx, b.x2 - minW); }
        if (edge === 'right') { b.x2 = Math.max(nx, b.x1 + minW); }

        syncCropBoxDOM(els.cropBox, els.cropDisplayImg, state.cropTarget, state.cropManualBox);
      };

      const onUp = () => {
        try { handle.releasePointerCapture(e.pointerId); } catch (_) { }
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    });
  });

  // 인도자 도구 버튼들
  els.leaderCropBtn.addEventListener('click', () => {
    const song = state.songs[state.currentIndex];
    if (!song) return;
    openCropModalForSong(song, 'manual');
  });

  if (els.leaderRatioBtn) {
    els.leaderRatioBtn.addEventListener('click', () => {
      const song = state.songs[state.currentIndex];
      if (!song) return;
      openRatioModalForSong(song);
    });
  }

  els.leaderSongformBtn.addEventListener('click', () => openSongformOrderModal());

  els.leaderClearStickersBtn.addEventListener('click', () => {
    const song = state.songs[state.currentIndex];
    if (!song) return;
    if (!confirm('현재 악보의 모든 송폼 스티커와 메모를 삭제하시겠습니까?')) return;
    state.stickersBySong[song.id] = [];
    saveStickers(song.id);
    markViewerDirty();
    if (hasDriveAuth()) {
      if (state.viewerReturnView === 'songLibrary') {
        syncLibraryToDrive(state.allSongs, true);
      } else if (state.currentContiId) {
        syncContiDetailToDrive(state.currentContiId, true);
      }
    }
    renderStickerLayer(els.stickerLayer, els.sheetContainer, song.id);
  });

  els.leaderSaveDoneBtn.addEventListener('click', async () => {
    state.locked = true;
    resetZoom();
    applyUIState();
    await renderAll();
    if (isViewerDirty && hasDriveAuth()) {
      if (state.viewerReturnView === 'songLibrary') {
        syncLibraryToDrive(state.allSongs, true);
      } else if (state.currentContiId) {
        syncContiDetailToDrive(state.currentContiId, true);
      }
      isViewerDirty = false;
    }
  });

  // 송폼 순서 단계별 입력 제어
  if (els.songformMultiplyBtn && els.songformStepInput) {
    els.songformMultiplyBtn.addEventListener('click', () => {
      const input = els.songformStepInput;
      const val = input.value || '';
      const start = input.selectionStart ?? val.length;
      const end = input.selectionEnd ?? val.length;

      // 공백 없이 정확히 × 기호 삽입 (예: C -> C×)
      input.value = val.slice(0, start) + '×' + val.slice(end);
      const newPos = start + 1;
      input.setSelectionRange(newPos, newPos);
      input.focus();
    });
  }
  if (els.songformStepNextBtn) {
    els.songformStepNextBtn.addEventListener('click', () => addSongformStep(els.songformStepInput.value));
  }
  if (els.songformStepInput) {
    els.songformStepInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addSongformStep(els.songformStepInput.value);
      }
    });
  }

  els.songformClearFlowBtn.addEventListener('click', () => {
    currentOrderFlow = [];
    renderSongformOrderFlowList();
  });

  els.songformOrderApplyBtn.addEventListener('click', async () => {
    if (els.songformStepInput && els.songformStepInput.value.trim()) {
      addSongformStep(els.songformStepInput.value);
    }
    const song = currentOrderSong || state.songs[state.currentIndex];
    if (song) {
      const prevSf = song.songform || [];
      const isSame = (prevSf.length === currentOrderFlow.length) &&
        prevSf.every((step, i) => step === currentOrderFlow[i]);

      if (isSame) {
        // 송폼 순서 변경 없음: 불필요한 백업 및 UI 리렌더링 생략
        hide(els.songformOrderModal);
        return;
      }

      const now = Date.now();
      song.songform = [...currentOrderFlow];
      song.updatedAt = now;

      const isFromLibrary = (state.activeMenu === 'library' || state.viewerReturnView === 'songLibrary') && !state.currentContiId;

      if (isFromLibrary) {
        // [1. 마스터 악보 보관함(곡 목록) 모드]
        await saveLibrarySong(song);
        if (state.currentUser?.orgId) {
          updateSongMaster(song.id, {
            songForm: song.songform || []
          });
        }
        if (hasDriveAuth()) {
          syncLibraryToDrive(state.allSongs, true);
        }
      } else {
        // [2. 콘티 모드]
        await saveSongs();
        const currentConti = state.contis.find(c => c.id === state.currentContiId);
        if (currentConti) {
          currentConti.songs = state.songs;
          currentConti.updatedAt = now;
          syncContiToFirestore(currentConti);
        }

        // 마스터 보관함에 동일 악보가 연결되어 있다면 보관함 곡의 송폼 순서도 함께 동기화
        const masterId = song.masterSongId || song.songId || song.id;
        const libMatch = (state.allSongs || []).find(s => s.id === masterId || s.id === song.id || (s.name === song.name && s.key === song.key));
        if (libMatch) {
          libMatch.songform = [...currentOrderFlow];
          libMatch.updatedAt = now;
          await saveLibrarySong(libMatch);
          if (state.currentUser?.orgId) {
            updateSongMaster(libMatch.id, {
              songForm: libMatch.songform || []
            });
          }
          if (hasDriveAuth()) {
            syncLibraryToDrive(state.allSongs, false);
          }
        } else if (state.currentUser?.orgId) {
          updateSongMaster(masterId, {
            songForm: song.songform || []
          });
        }

        if (hasDriveAuth() && state.currentContiId) {
          syncContiDetailToDrive(state.currentContiId, true);
        }
      }
    }
    currentOrderSong = null;
    hide(els.songformOrderModal);

    // 현재 화면 상태에 맞게 안전하게 리렌더링 및 세션 보존 (뷰어 화면 유지 보장)
    saveCurrentMenuSession();
    if (state.viewLevel === 'viewer') {
      await renderAll();
    } else if (state.viewLevel === 'songList') {
      renderSongListView();
      applyUIState();
    } else if (state.viewLevel === 'songLibrary') {
      renderSongLibraryView();
      applyUIState();
    } else {
      applyUIState();
    }
  });
  document.querySelectorAll('[data-close-songform-order]').forEach(el => el.addEventListener('click', () => hide(els.songformOrderModal)));

  // 사용자 도구 버튼들
  if (els.penStylusOnlyBtn) {
    els.penStylusOnlyBtn.addEventListener('click', () => {
      state.stylusOnly = !state.stylusOnly;
      savePreferences();
      applyUIState();
      if (state.stylusOnly) {
        showSyncToast('펜 전용 모드 켜짐 ✏️ (손바닥/손가락 터치 무시)', 'success');
      } else {
        showSyncToast('일반 모드 (손가락/펜 터치 모두 허용)', 'info');
      }
    });
  }
  els.penEraserBtn.addEventListener('click', () => {
    state.eraseMode = !state.eraseMode;
    applyUIState();
  });
  els.penSizeSlider.addEventListener('input', (e) => {
    state.penSize = Number(e.target.value);
    applyUIState();
  });
  let activeTextMemoTarget = 'left';

  function updateTextMemoSongSelectUI() {
    if (!els.textMemoSongLeftBtn || !els.textMemoSongRightBtn) return;
    if (activeTextMemoTarget === 'left') {
      els.textMemoSongLeftBtn.style.background = 'var(--accent)';
      els.textMemoSongLeftBtn.style.color = '#ffffff';
      els.textMemoSongRightBtn.style.background = 'transparent';
      els.textMemoSongRightBtn.style.color = 'var(--text-dim)';
    } else {
      els.textMemoSongRightBtn.style.background = 'var(--accent)';
      els.textMemoSongRightBtn.style.color = '#ffffff';
      els.textMemoSongLeftBtn.style.background = 'transparent';
      els.textMemoSongLeftBtn.style.color = 'var(--text-dim)';
    }
  }

  if (els.textMemoSongLeftBtn) {
    els.textMemoSongLeftBtn.addEventListener('click', () => {
      activeTextMemoTarget = 'left';
      updateTextMemoSongSelectUI();
    });
  }
  if (els.textMemoSongRightBtn) {
    els.textMemoSongRightBtn.addEventListener('click', () => {
      activeTextMemoTarget = 'right';
      updateTextMemoSongSelectUI();
    });
  }

  els.penClearBtn.addEventListener('click', async () => {
    const isTwoPage = isTwoPageViewActive();
    const songLeft = state.songs[state.currentIndex];
    const songRight = isTwoPage ? state.songs[state.currentIndex + 1] : null;
    if (!songLeft) return;
    if (!confirm('현재 화면에 작성한 개인 필기를 모두 지우시겠습니까?')) return;

    if (els.sheetContainer && els.userCanvas) {
      els.userCanvas.getContext('2d').clearRect(0, 0, els.sheetContainer.clientWidth, els.sheetContainer.clientHeight);
      await saveUserDrawing(songLeft.id, els.userCanvas);
    }
    if (isTwoPage && songRight && els.sheetContainerRight && els.userCanvasRight) {
      els.userCanvasRight.getContext('2d').clearRect(0, 0, els.sheetContainerRight.clientWidth, els.sheetContainerRight.clientHeight);
      await saveUserDrawing(songRight.id, els.userCanvasRight);
    }
  });

  els.userTextMemoBtn.addEventListener('click', () => {
    els.textMemoInput.value = '';
    const isTwoPage = isTwoPageViewActive();
    const songRight = isTwoPage ? state.songs[state.currentIndex + 1] : null;
    if (isTwoPage && songRight && els.textMemoSongSelectBar) {
      els.textMemoSongSelectBar.style.display = 'flex';
      els.textMemoSongLeftBtn.textContent = `1. ${state.songs[state.currentIndex].name}`;
      els.textMemoSongRightBtn.textContent = `2. ${songRight.name}`;
      activeTextMemoTarget = 'left';
      updateTextMemoSongSelectUI();
    } else if (els.textMemoSongSelectBar) {
      els.textMemoSongSelectBar.style.display = 'none';
      activeTextMemoTarget = 'left';
    }
    show(els.textMemoModal, 'flex');
    setTimeout(() => els.textMemoInput?.focus(), 50);
  });

  els.textMemoAddBtn.addEventListener('click', () => {
    const text = els.textMemoInput.value.trim();
    if (!text) return;
    const isTwoPage = isTwoPageViewActive();
    const isTargetRight = (isTwoPage && activeTextMemoTarget === 'right' && state.songs[state.currentIndex + 1]);
    const targetSong = isTargetRight ? state.songs[state.currentIndex + 1] : state.songs[state.currentIndex];
    const targetContainer = isTargetRight ? els.sheetContainerRight : els.sheetContainer;
    const targetLayer = isTargetRight ? els.stickerLayerRight : els.stickerLayer;

    if (!targetSong) {
      alert('먼저 악보를 등록해주세요.');
      return;
    }
    const list = state.stickersBySong[targetSong.id] || (state.stickersBySong[targetSong.id] = []);
    const { x, y } = getViewportCenterStickerCoord(targetContainer, list);
    list.push({
      id: crypto.randomUUID(),
      type: 'text',
      label: text,
      x,
      y
    });
    saveStickers(targetSong.id);
    markViewerDirty();
    renderStickerLayer(targetLayer, targetContainer, targetSong.id);
    if (hasDriveAuth()) {
      if (state.viewerReturnView === 'songLibrary') {
        debounceSyncLibraryToDrive();
      } else if (state.currentContiId) {
        debounceSyncContiDetail(state.currentContiId);
      }
    }
    hide(els.textMemoModal);
  });

  // 모달 닫기
  if (els.settingsModal) {
    document.querySelectorAll('[data-close-settings]').forEach(el => el.addEventListener('click', () => hide(els.settingsModal)));
  }
  document.querySelectorAll('[data-close-textmemo]').forEach(el => el.addEventListener('click', () => hide(els.textMemoModal)));

  // 코드 스티커 모달 열기 및 부착
  if (els.openChordModalBtn) {
    els.openChordModalBtn.addEventListener('click', openChordModal);
  }
  document.querySelectorAll('[data-close-chord-modal]').forEach(el => {
    el.addEventListener('click', () => hide(els.chordStickerModal));
  });

  document.querySelectorAll('.chord-key-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const char = btn.dataset.chordChar;
      if (!char || !els.chordStickerInput) return;
      els.chordStickerInput.value += char;
      updateChordStickerPreview();
      els.chordStickerInput.focus();
    });
  });

  if (els.chordStickerBackspaceBtn) {
    els.chordStickerBackspaceBtn.addEventListener('click', () => {
      if (!els.chordStickerInput) return;
      els.chordStickerInput.value = els.chordStickerInput.value.slice(0, -1);
      updateChordStickerPreview();
      els.chordStickerInput.focus();
    });
  }

  if (els.chordStickerClearBtn) {
    els.chordStickerClearBtn.addEventListener('click', () => {
      if (!els.chordStickerInput) return;
      els.chordStickerInput.value = '';
      updateChordStickerPreview();
      els.chordStickerInput.focus();
    });
  }

  if (els.chordStickerInput) {
    els.chordStickerInput.addEventListener('input', updateChordStickerPreview);
    els.chordStickerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = (els.chordStickerInput.value || '').trim();
        if (val) placeChordSticker(val);
      }
    });
  }

  if (els.chordStickerAddBtn) {
    els.chordStickerAddBtn.addEventListener('click', () => {
      const val = (els.chordStickerInput?.value || '').trim();
      if (val) placeChordSticker(val);
      else alert('코드 텍스트를 입력해주세요.');
    });
  }

  // 설정 테마 & 네비게이션
  els.themeSystemBtn.addEventListener('click', () => {
    state.theme = 'system';
    savePreferences();
    applyUIState();
    updateSettingsUIButtons();
  });
  els.themeLightBtn.addEventListener('click', () => {
    state.theme = 'light';
    savePreferences();
    applyUIState();
    updateSettingsUIButtons();
  });
  els.themeDarkBtn.addEventListener('click', () => {
    state.theme = 'dark';
    savePreferences();
    applyUIState();
    updateSettingsUIButtons();
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.theme === 'system') applyUIState();
    });
  }

  els.navHBtn.addEventListener('click', () => {
    state.navDirection = 'horizontal';
    savePreferences();
    applyUIState();
    updateSettingsUIButtons();
  });
  els.navVBtn.addEventListener('click', () => {
    state.navDirection = 'vertical';
    savePreferences();
    applyUIState();
    updateSettingsUIButtons();
  });

  if (els.pageAnimSmoothBtn) {
    els.pageAnimSmoothBtn.addEventListener('click', () => {
      state.pageAnim = 'smooth';
      savePreferences();
      updateSettingsUIButtons();
    });
  }
  if (els.pageAnimInstantBtn) {
    els.pageAnimInstantBtn.addEventListener('click', () => {
      state.pageAnim = 'instant';
      savePreferences();
      updateSettingsUIButtons();
    });
  }

  if (els.viewCount1Btn) {
    els.viewCount1Btn.addEventListener('click', () => {
      state.viewSheetCount = 1;
      savePreferences();
      applyUIState();
      updateSettingsUIButtons();
      renderAll();
    });
  }
  if (els.viewCount2Btn) {
    els.viewCount2Btn.addEventListener('click', () => {
      state.viewSheetCount = 2;
      savePreferences();
      applyUIState();
      updateSettingsUIButtons();
      renderAll();
    });
  }


  // 스티커 크기 조절 [- / +] (1~7단계, 기본 3단계)
  if (els.stickerSizeDecBtn) {
    els.stickerSizeDecBtn.addEventListener('click', () => {
      applyStickerStep((state.stickerStep || 3) - 1);
    });
  }
  if (els.stickerSizeIncBtn) {
    els.stickerSizeIncBtn.addEventListener('click', () => {
      applyStickerStep((state.stickerStep || 3) + 1);
    });
  }

  // 송폼 라벨 추가/삭제
  els.addLabelBtn.addEventListener('click', () => {
    const val = els.newLabelInput.value.trim();
    if (!val || state.songformLabels.includes(val)) {
      els.newLabelInput.value = '';
      return;
    }
    state.songformLabels.push(val);
    savePreferences();
    renderSongformManageList();
    renderSongformStickyChips();
    els.newLabelInput.value = '';
  });
  els.songformManageList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove-index]');
    if (!btn) return;
    const idx = Number(btn.dataset.removeIndex);
    state.songformLabels.splice(idx, 1);
    savePreferences();
    renderSongformManageList();
    renderSongformStickyChips();
  });

  // 주제 태그 추가
  if (els.addThemeBtn) {
    els.addThemeBtn.addEventListener('click', () => {
      const val = els.newThemeInput.value.trim();
      if (!val || state.themes.includes(val)) {
        els.newThemeInput.value = '';
        return;
      }
      state.themes.push(val);
      savePreferences();
      renderThemeManageList();
      els.newThemeInput.value = '';
    });
  }


  // 곡 넘김 핫스팟
  els.hotspotPrev.addEventListener('click', goPrev);
  els.hotspotNext.addEventListener('click', goNext);

  // 드로잉 시스템 (좌측/단독 악보 & 우측 2곡보기 악보)
  setupDrawingSystem(els.userCanvas, () => {
    const song = state.songs[state.currentIndex];
    if (song) saveUserDrawing(song.id, els.userCanvas);
    markViewerDirty();
  });
  if (els.userCanvasRight) {
    setupDrawingSystem(els.userCanvasRight, () => {
      const songRight = state.songs[state.currentIndex + 1];
      if (songRight) saveUserDrawing(songRight.id, els.userCanvasRight);
      markViewerDirty();
    });
  }
  window.addEventListener('continote:viewer-dirty', markViewerDirty);

  // 스와이프 내비게이션
  setupSwipeNavigation();

  // 모바일/태블릿 가상 키보드 감지 및 모달 위치 자동 보정
  setupVirtualKeyboardHandler();

  // 편집 모드 줌/팬
  setupZoomAndPan({
    viewer: els.viewer,
    stage: els.stageContainer,
    zoomControls: els.zoomControls,
    zoomInBtn: els.zoomInBtn,
    zoomOutBtn: els.zoomOutBtn,
    zoomResetBtn: els.zoomResetBtn,
    zoomLevelText: els.zoomLevelText,
    checkIsLocked: () => state.locked || state.songs.length === 0
  });

  // [조직 온보딩] 탭 전환
  if (els.orgTabJoinBtn) {
    els.orgTabJoinBtn.addEventListener('click', () => switchOrgTab('join'));
  }
  if (els.orgTabCreateBtn) {
    els.orgTabCreateBtn.addEventListener('click', () => switchOrgTab('create'));
  }

  // [조직 온보딩] 기존 교회 가입 신청
  if (els.orgSubmitJoinBtn) {
    els.orgSubmitJoinBtn.addEventListener('click', async () => {
      const orgId = els.orgJoinSelect ? els.orgJoinSelect.value : '';
      if (!orgId) {
        alert('가입할 교회를 선택해주세요.');
        return;
      }
      const selectedOpt = els.orgJoinSelect.options[els.orgJoinSelect.selectedIndex];
      const orgName = selectedOpt ? selectedOpt.getAttribute('data-name') : '';

      els.orgSubmitJoinBtn.disabled = true;
      els.orgSubmitJoinBtn.textContent = '신청 처리 중...';
      try {
        await requestJoinOrganization({ orgId, orgName, user: currentAuthUser });
        hide(els.orgOnboardingModal);
        if (els.pendingOrgNameDisplay) els.pendingOrgNameDisplay.textContent = orgName;
        show(els.pendingApprovalScreen, 'flex');
      } catch (err) {
        alert('가입 신청 실패: ' + err.message);
      } finally {
        els.orgSubmitJoinBtn.disabled = false;
        els.orgSubmitJoinBtn.textContent = '가입 신청하기';
      }
    });
  }

  // [조직 온보딩] 새 교회 만들기
  if (els.orgSubmitCreateBtn) {
    els.orgSubmitCreateBtn.addEventListener('click', async () => {
      const orgName = (els.orgCreateNameInput ? els.orgCreateNameInput.value : '').trim();
      if (!orgName) {
        alert('교회 / 단체 이름을 입력해주세요.');
        if (els.orgCreateNameInput) els.orgCreateNameInput.focus();
        return;
      }

      els.orgSubmitCreateBtn.disabled = true;
      els.orgSubmitCreateBtn.textContent = '교회 생성 중...';
      try {
        const { orgId } = await createOrganization({ orgName, user: currentAuthUser });
        hide(els.orgOnboardingModal);
        state.currentUser = {
          uid: currentAuthUser.uid,
          email: currentAuthUser.email,
          name: currentAuthUser.displayName || currentAuthUser.email.split('@')[0],
          orgId,
          orgName,
          role: 'admin',
          status: 'approved',
          picture: currentAuthUser.photoURL || ''
        };
        saveUserSession(state.currentUser);
        updateAuthUI();
        if (els.orgAdminSection) show(els.orgAdminSection, 'block');
        if (els.orgAdminSectionDivider) show(els.orgAdminSectionDivider, 'block');
        renderContiListView();
        applyUIState();
      } catch (err) {
        alert('교회 생성 실패: ' + err.message);
      } finally {
        els.orgSubmitCreateBtn.disabled = false;
        els.orgSubmitCreateBtn.textContent = '새 교회 생성하고 시작하기';
      }
    });
  }

  // [승인 대기 화면] 새로고침
  if (els.pendingRefreshBtn) {
    els.pendingRefreshBtn.addEventListener('click', async () => {
      if (!currentAuthUser) return;
      els.pendingRefreshBtn.disabled = true;
      const originalText = els.pendingRefreshBtn.innerHTML;
      els.pendingRefreshBtn.innerHTML = '<span>확인 중...</span>';
      try {
        const profile = await getUserProfile(currentAuthUser.uid, currentAuthUser.email);
        if (profile && profile.status === 'approved') {
          hide(els.pendingApprovalScreen);
          state.currentUser = {
            uid: currentAuthUser.uid,
            email: currentAuthUser.email,
            name: profile.displayName || currentAuthUser.displayName,
            orgId: profile.orgId,
            orgName: profile.orgName,
            role: profile.role || 'member',
            status: profile.status,
            picture: currentAuthUser.photoURL || ''
          };
          saveUserSession(state.currentUser);
          updateAuthUI();
          renderContiListView();
          applyUIState();
          alert('승인이 완료되었습니다! 환영합니다.');
        } else {
          alert('아직 승인 대기 중입니다. 관리자에게 승인을 요청해주세요.');
        }
      } catch (err) {
        alert('승인 확인 오류: ' + err.message);
      } finally {
        els.pendingRefreshBtn.disabled = false;
        els.pendingRefreshBtn.innerHTML = originalText;
      }
    });
  }

  // [승인 대기 화면] 로그아웃
  if (els.pendingLogoutBtn) {
    els.pendingLogoutBtn.addEventListener('click', handleProfileClick);
  }

  // [관리자 전용] 승인 모달 열기
  if (els.openOrgAdminBtn) {
    els.openOrgAdminBtn.addEventListener('click', openOrgAdminModal);
  }

  // [관리자 전용] 승인 모달 닫기
  document.querySelectorAll('[data-close-org-admin]').forEach(el => {
    el.addEventListener('click', () => hide(els.orgAdminModal));
  });

  // [클라우드 실시간 동기화] 콘티 상세(곡 목록, 송폼, 순서) 변경 시 Firestore 자동 백그라운드 동기화
  window.addEventListener('continote:conti-updated', (e) => {
    const targetContiId = e.detail?.contiId || state.currentContiId;
    const target = state.contis.find(c => c.id === targetContiId);
    if (target) {
      syncContiToFirestore(target);
    }
  });

  window.addEventListener('resize', debounce(renderAll, 150));
  window.addEventListener('orientationchange', () => {
    setTimeout(renderAll, 100);
  });
}

/* ==================================================
   초기화
   ================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  const prefs = loadPreferences();
  state.theme = prefs.theme || 'system';
  state.navDirection = prefs.navDirection || 'horizontal';
  state.songformLabels = prefs.songformLabels || ['A', 'B', 'C', 'D', 'bis', 'I', 'O'];
  state.themes = prefs.themes || ['은혜', '찬양', '감사', '회개', '결단', '십자가', '부흥', '승리'];
  state.viewSheetCount = (prefs.viewSheetCount !== undefined && prefs.viewSheetCount !== null) ? prefs.viewSheetCount : 2;
  state.pageAnim = prefs.pageAnim || 'smooth';
  applyStickerStep(prefs.stickerStep || 3);

  // [Local-First SWR: 체감 대기시간 0초 세션 및 UI 즉시 복원]
  const cachedUser = loadUserSession();
  if (cachedUser) {
    state.currentUser = cachedUser;
    updateAuthUI();
    if (cachedUser.role === 'admin' && cachedUser.orgId) {
      if (els.orgAdminSection) show(els.orgAdminSection, 'block');
      if (els.orgAdminSectionDivider) show(els.orgAdminSectionDivider, 'block');
      refreshAdminPendingBadge(cachedUser.orgId);
    }
  }

  // [FOUC 방지 0ms 선행 레이아웃] 비동기 IndexedDB 로딩 대기 전, 보던 화면 프레임을 동기적으로 즉시 표시!
  const isShareLink = window.location.hash.startsWith('#share=');
  const savedNav = !isShareLink ? loadSavedNavSession() : null;
  if (savedNav) {
    state.activeMenu = savedNav.activeMenu || 'user';
    state.viewLevel = savedNav.viewLevel || 'contiList';
    state.currentContiId = savedNav.currentContiId || null;
    state.currentIndex = typeof savedNav.currentIndex === 'number' ? savedNav.currentIndex : 0;
    state.viewerReturnView = savedNav.viewerReturnView || null;
    if (typeof savedNav.locked === 'boolean') {
      state.locked = savedNav.locked;
    }
  } else {
    state.viewLevel = 'contiList';
  }
  applyUIState(); // 비동기 대기 전 화면 컨테이너(songListView 등) 즉시 가시화!

  // 데이터 로드 (로컬 IndexedDB로부터 0.01초 만에 화면 즉시 렌더링)
  await loadContis();
  await loadLibrarySongs();

  // 비동기 백그라운드 Firebase 인증 및 동기화 초기화
  initFirebaseAuth();
  loadTeamMembersFromCache();
  if (hasDriveAuth()) {
    syncTeamMembersFromDrive().catch(e => console.warn('팀원 목록 백그라운드 동기화:', e));
  }

  // 공유 링크로 진입했을 경우 자동 열람 처리
  if (isShareLink) {
    const shareId = window.location.hash.replace('#share=', '').trim();
    const sharedConti = state.contis.find(c => c.id === shareId);
    if (sharedConti) {
      const myEmail = state.currentUser?.email || 'leader@continote.com';
      if (!sharedConti.sharedWith.includes(myEmail)) {
        sharedConti.sharedWith.push(myEmail);
        await saveContis();
      }
      if (state.currentUser && state.currentUser.email !== 'leader@continote.com') {
        upsertTeamMember(state.currentUser).catch(() => {});
      }
      openSongList(shareId);
      return;
    }
  }

  wireEventListeners();
  initBrowserHistory();
  setupPWAInstall();
  registerServiceWorker();

  // [화면 상태 데이터 주입 및 최종 렌더링]
  if (savedNav) {
    await restoreNavigationState(savedNav);
  } else {
    renderContiListView();
    applyUIState();
  }
});

/* ==================================================
   PWA (Progressive Web App) 오프라인 및 설치 관리
   ================================================== */
let deferredInstallPrompt = null;

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker 등록 성공:', reg.scope);

          // 1. 이미 새 버전이 대기 중(waiting)인 경우 즉시 업데이트 토스트 표시
          if (reg.waiting) {
            showPWAUpdateToast(reg.waiting);
            return;
          }

          // 2. 새 버전 다운로드 감지 (updatefound -> installed)
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showPWAUpdateToast(newWorker);
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker 등록 실패 (로컬/비HTTPS 환경 가능):', err);
        });

      // 3. 새 서비스 워커가 활성화(controllerchange)되었을 때 자동 새로고침 방지 플래그 관리
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      // 4. 태블릿/모바일에서 앱으로 복귀 시(visibilitychange) 백그라운드 업데이트 확인
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          navigator.serviceWorker.getRegistration().then((reg) => {
            reg?.update().catch(() => {});
          });
        }
      });
    });
  }
}

/**
 * PWA 새로운 배포 버전 감지 시 상단 플로팅 업데이트 알림 토스트 표시
 */
function showPWAUpdateToast(worker) {
  if (document.getElementById('pwaUpdateToast')) return;

  const toast = document.createElement('div');
  toast.id = 'pwaUpdateToast';
  toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[100000] max-w-[92vw] sm:max-w-md w-full px-4 py-3 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 select-none backdrop-blur-md transition-all animate-bounce-in';
  toast.style.background = 'var(--surface)';
  toast.style.borderColor = 'var(--accent)';
  toast.style.boxShadow = '0 12px 36px -4px rgba(0,0,0,0.35), 0 0 16px var(--accent-soft)';

  toast.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0">
      <span class="text-xl shrink-0">🚀</span>
      <div class="min-w-0">
        <div class="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">새로운 버전이 준비되었습니다!</div>
        <div class="text-[11px] text-zinc-500 dark:text-zinc-400">탭하여 최신 업데이트를 적용하세요</div>
      </div>
    </div>
    <div class="flex items-center gap-1.5 shrink-0">
      <button id="pwaUpdateApplyBtn" type="button" class="px-3 py-1.5 rounded-xl text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1"
              style="background:var(--accent)">
        <span>지금 업데이트</span>
      </button>
      <button id="pwaUpdateDismissBtn" type="button" class="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 active:scale-90 transition-all text-sm leading-none" title="나중에">
        ×
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  // [지금 업데이트] 클릭 이벤트
  const applyBtn = toast.querySelector('#pwaUpdateApplyBtn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      applyBtn.disabled = true;
      applyBtn.innerHTML = `<span>적용 중...</span>`;
      if (worker) {
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
      setTimeout(() => {
        window.location.reload();
      }, 350);
    });
  }

  // [×] 닫기 클릭 이벤트
  const dismissBtn = toast.querySelector('#pwaUpdateDismissBtn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -20px)';
      setTimeout(() => toast.remove(), 200);
    });
  }
}

function setupPWAInstall() {
  const installBtn = els.pwaInstallBtn;
  const installHint = els.pwaInstallHint;
  const installBtnText = els.pwaInstallBtnText;

  // 1. 이미 PWA 독립 실행형 앱으로 실행 중인지 감지
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    if (installBtn) {
      installBtn.disabled = true;
      installBtn.classList.add('opacity-60', 'cursor-default');
      installBtn.style.background = 'var(--surface-2)';
      installBtn.style.color = 'var(--text-dim)';
      if (installBtnText) installBtnText.textContent = '이미 앱으로 실행 중입니다';
    }
    if (installHint) installHint.textContent = '현재 ContiNote 독립 실행형 웹앱 모드로 사용 중입니다.';
    return;
  }

  // 2. iOS Safari 감지 (beforeinstallprompt 미지원 플랫폼 가이드)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    if (installBtn) {
      installBtn.addEventListener('click', () => {
        alert('iOS(아이폰/아이패드)에서는 브라우저 하단의 [공유] 아이콘을 누른 후 [홈 화면에 추가]를 선택하시면 앱으로 설치됩니다.');
      });
    }
    if (installHint) {
      installHint.textContent = '* iOS(Safari) 안내: 하단 공유 아이콘(⎋) > [홈 화면에 추가]를 눌러 앱으로 설치할 수 있습니다.';
    }
    return;
  }

  // 3. Chromium 기반 브라우저 설치 이벤트 가로채기
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) {
        alert('브라우저 우측 상단 메뉴(⋮)에서 [앱 설치] 또는 [홈 화면에 추가]를 눌러 설치할 수 있습니다.');
        return;
      }
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        installBtn.disabled = true;
        installBtn.classList.add('opacity-60');
        if (installBtnText) installBtnText.textContent = '앱 설치 완료됨';
      }
      deferredInstallPrompt = null;
    });
  }

  window.addEventListener('appinstalled', () => {
    if (installBtn) {
      installBtn.disabled = true;
      installBtn.classList.add('opacity-60');
      if (installBtnText) installBtnText.textContent = '앱 설치 완료됨';
    }
    deferredInstallPrompt = null;
  });
}
