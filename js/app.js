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
  loadLibrarySongs, saveLibrarySong, deleteLibrarySong
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
  syncContiDetailFromDrive, syncContiDetailToDrive,
  syncAllContisDetailToDrive, syncLibraryFromDrive, syncLibraryToDrive, runFullDriveSync,
  showSyncToast
} from './drive.js';

// DOM Elements Cache
const els = {};
const DOM_IDS = [
  // 1. 헤더 및 네비게이션
  'backBtn', 'backBtnText', 'headerLogoArea', 'viewerHeaderInfo', 'viewerContiTitle', 'viewerSongTitle',
  'addContiBtn', 'songListAddBtn', 'viewerBpmBtn', 'viewerBpmText', 'lockBtn', 'lockClosedIcon', 'lockOpenIcon', 'lockBtnLabel',
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
  'userPenToolbar', 'penColorSwatches', 'penSizeSlider', 'penSizePreviewDot', 'penSizeDotInner', 'penEraserBtn', 'penClearBtn', 'userTextMemoBtn',
  'bottomNav', 'navLeaderBtn', 'navUserBtn', 'navSongLibraryBtn', 'navSettingsBtn',
  'fileInput',
  // 6. 모달들
  'cropModal', 'cropAutoTabBtn', 'cropManualTabBtn', 'cropStage', 'cropDisplayImg', 'cropBox', 'cropHintText', 'cropCancelBtn', 'cropApplyBtn',
  'ratioModal', 'ratioResetBtn', 'ratioStage', 'ratioCanvas', 'ratioWidthVal', 'ratioHeightVal', 'ratioAspectVal', 'ratioPrevBtn', 'ratioNextBtn',
  'songformOrderModal', 'songformOrderSongTitle', 'songformStepInput', 'songformMultiplyBtn', 'songformStepNextBtn', 'songformPickerChips', 'songformClearFlowBtn', 'songformFlowList', 'songformFlowEmptyHint', 'songformOrderApplyBtn',
  'contiModal', 'contiModalTitle', 'contiTitleInput', 'contiDateInput', 'contiMemoInput', 'contiSaveBtn',
  'settingsView', 'themeSystemBtn', 'themeLightBtn', 'themeDarkBtn', 'navHBtn', 'navVBtn', 'viewCount1Btn', 'viewCount2Btn', 'songformManageList', 'newLabelInput', 'addLabelBtn', 'driveConnectBtn', 'driveStatusText', 'driveManualSyncBtn',
  'themeManageList', 'newThemeInput', 'addThemeBtn',
  'textMemoModal', 'textMemoSongSelectBar', 'textMemoSongLeftBtn', 'textMemoSongRightBtn', 'textMemoInput', 'textMemoAddBtn',
  'chordStickerModal', 'chordStickerInput', 'chordStickerBackspaceBtn', 'chordStickerClearBtn', 'chordStickerPreview', 'chordStickerAddBtn',
  'shareModal', 'shareContiTitle', 'shareEmailInput', 'addShareEmailBtn', 'shareEmailList', 'copyShareLinkBtn',
  'songMetaModal', 'songMetaModalTitle', 'songMetaNameInput', 'songMetaKeySelect', 'songMetaTimeSigSelect', 'songMetaTempoInput', 'songMetaBpmBtn', 'songMetaThemesContainer', 'songMetaSaveBtn',
  'songMetaLibrarySyncRow', 'songMetaAddToLibraryCheckbox', 'songMetaAddToLibraryLabel', 'songMetaAddToLibraryDesc',
  'addToContiModal', 'addToContiSongTitle', 'addToContiListContainer', 'confirmAddToContiBtn',
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
let audioCtx = null;
let metronomeTimer = null;
let metronomeActiveBtn = null;
let metronomeBpm = 0;
let metronomeBeatIndex = 0;
let metronomeBeatsPerMeasure = 4;

function getBeatsPerMeasure(timeSig) {
  if (!timeSig) return 4;
  const match = String(timeSig).trim().match(/^(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num > 0 && num <= 32) return num;
  }
  return 4;
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

function playClickSound(isFirstBeat = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';

    if (isFirstBeat) {
      // 마디 첫 클릭 (강박): 고음 및 선명하고 또렷한 하이 피치 틱 사운드 (1600Hz -> 600Hz)
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);

      gain.gain.setValueAtTime(0.95, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else {
      // 마디 일반 클릭 (약박): 차분하고 안정적인 중저음 우드블록 틱 사운드 (900Hz -> 300Hz)
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);

      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch (err) {
    console.warn('Metronome audio error:', err);
  }
}

function triggerBeatVisual(btn, isFirstBeat = false) {
  if (!btn) return;
  btn.classList.remove('metronome-tick', 'metronome-tick-downbeat');
  void btn.offsetWidth; // reflow trigger
  if (isFirstBeat) {
    btn.classList.add('metronome-tick-downbeat');
  } else {
    btn.classList.add('metronome-tick');
  }
}

export function startMetronome(bpm, triggerBtn, beatsPerMeasure = 4) {
  stopMetronome();
  const tempo = parseInt(bpm, 10);
  if (!tempo || tempo < 20 || tempo > 300 || isNaN(tempo)) return;

  metronomeBpm = tempo;
  metronomeActiveBtn = triggerBtn;
  metronomeBeatsPerMeasure = beatsPerMeasure > 0 ? beatsPerMeasure : 4;
  metronomeBeatIndex = 0;

  getAudioContext();
  // 첫 박 (강박) 재생
  playClickSound(true);

  if (triggerBtn) {
    triggerBtn.classList.add('metronome-playing');
    triggerBeatVisual(triggerBtn, true);
  }

  metronomeBeatIndex = 1 % metronomeBeatsPerMeasure;

  const intervalMs = (60 / tempo) * 1000;
  metronomeTimer = setInterval(() => {
    const isFirst = (metronomeBeatIndex === 0);
    playClickSound(isFirst);
    if (triggerBtn) {
      triggerBeatVisual(triggerBtn, isFirst);
    }
    metronomeBeatIndex = (metronomeBeatIndex + 1) % metronomeBeatsPerMeasure;
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
  if (els.songMetaBpmBtn) {
    els.songMetaBpmBtn.classList.remove('metronome-playing', 'metronome-tick', 'metronome-tick-downbeat');
  }
  metronomeBpm = 0;
  metronomeBeatIndex = 0;
}

export function isMetronomePlaying() {
  return metronomeTimer !== null;
}

export function toggleMetronome(bpm, triggerBtn, beatsPerMeasure = 4) {
  if (isMetronomePlaying()) {
    const wasSameBtn = (metronomeActiveBtn === triggerBtn);
    stopMetronome();
    if (!wasSameBtn && bpm) {
      startMetronome(bpm, triggerBtn, beatsPerMeasure);
    }
  } else {
    startMetronome(bpm, triggerBtn, beatsPerMeasure);
  }
}

function updateSongMetaBpmBtnState() {
  if (!els.songMetaBpmBtn || !els.songMetaTempoInput) return;
  const tempoVal = parseInt(els.songMetaTempoInput.value.trim(), 10);
  const timeSigVal = els.songMetaTimeSigSelect?.value || '4/4';
  const beats = getBeatsPerMeasure(timeSigVal);

  if (tempoVal && tempoVal >= 20 && tempoVal <= 300) {
    els.songMetaBpmBtn.disabled = false;
    els.songMetaBpmBtn.classList.remove('opacity-40', 'cursor-not-allowed');
    els.songMetaBpmBtn.classList.add('cursor-pointer');
    els.songMetaBpmBtn.style.pointerEvents = 'auto';
    els.songMetaBpmBtn.title = `템포: ${tempoVal} BPM (${beats}박자, 클릭하여 소리 듣기)`;
    // 재생 중 템포 또는 박자가 변경되면 실시간으로 새 설정 반영
    if (isMetronomePlaying() && metronomeActiveBtn === els.songMetaBpmBtn && (metronomeBpm !== tempoVal || metronomeBeatsPerMeasure !== beats)) {
      startMetronome(tempoVal, els.songMetaBpmBtn, beats);
    }
  } else {
    if (isMetronomePlaying() && metronomeActiveBtn === els.songMetaBpmBtn) {
      stopMetronome();
    }
    els.songMetaBpmBtn.disabled = true;
    els.songMetaBpmBtn.classList.add('opacity-40', 'cursor-not-allowed');
    els.songMetaBpmBtn.classList.remove('cursor-pointer');
    els.songMetaBpmBtn.style.pointerEvents = 'none';
    els.songMetaBpmBtn.title = '템포를 입력하면 소리를 들어볼 수 있습니다';
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
    if (hasValidToken) {
      state.currentUser = savedUser;
      migrateLocalContisToUser(savedUser);
    } else {
      // [세션 일치화] Drive 토큰이 이미 만료되어 있다면 불일치 세션을 정리하여 로그인 버튼으로 일치화
      state.currentUser = {
        email: 'leader@continote.com',
        name: '찬양인도자',
        picture: 'https://api.dicebear.com/7.x/bottts/svg?seed=continote'
      };
      saveUserSession(null);
    }
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

            // 로그인 전 기본 계정으로 로컬에 생성된 콘티들을 내 계정으로 자동 이전
            await migrateLocalContisToUser(state.currentUser);

            // [1단계] Google Drive에서 콘티 목록 선행 동기화 (가벼움)
            await syncContisIndexFromDrive();
            // [2단계] 마스터 악보 보관함 동기화
            await syncLibraryFromDrive();
            // [3단계] 로컬에 존재하는 콘티 악보들 드라이브로 자동 백업
            syncAllContisDetailToDrive().catch(err => console.warn('콘티 상세 백업 대기:', err));
            renderContiListView();
            if (state.viewLevel === 'songLibrary') renderSongLibraryView();
            applyUIState();
          } catch (err) {
            console.warn('사용자 프로필 불러오기 실패:', err);
          }
        }
      });
    } catch (e) {
      console.warn('GIS 초기화 대기:', e);
    }
  }

  window.addEventListener('continote:drive-auth-changed', (e) => {
    if (e.detail && !e.detail.authorized && state.currentUser && state.currentUser.email !== 'leader@continote.com') {
      clearUserSession();
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

// 로그인 전 기본 계정(leader@continote.com)으로 작성된 로컬 콘티를 현재 로그인 사용자로 안전하게 이전
async function migrateLocalContisToUser(user) {
  if (!user || !user.email || user.email === 'leader@continote.com') return;
  let changed = false;
  (state.contis || []).forEach(c => {
    if (!c.authorEmail || c.authorEmail === 'leader@continote.com') {
      c.authorEmail = user.email;
      c.authorName = user.name || user.email.split('@')[0];
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

    // Google Drive 토큰 만료 여부에 따른 시각적 배지 및 툴팁
    if (els.headerProfileChip) {
      if (!isDriveAuthed) {
        els.headerProfileChip.style.borderColor = '#E0484B';
        els.headerProfileChip.title = `${state.currentUser.name} (Google Drive 만료 - 클릭 시 재연결)`;
      } else {
        els.headerProfileChip.style.borderColor = 'var(--border)';
        els.headerProfileChip.title = `${state.currentUser.name} (${state.currentUser.email})`;
      }
    }
  } else {
    show(els.headerGoogleLoginBtn, 'flex');
    hide(els.headerProfileChip);
  }

  updateDriveStatusUI();
}

function updateDriveStatusUI() {
  if (!els.driveStatusText) return;
  const isDriveAuthed = hasDriveAuth();
  const isLoggedIn = Boolean(state.currentUser && state.currentUser.email !== 'leader@continote.com');

  if (isDriveAuthed) {
    els.driveStatusText.textContent = `Google 드라이브 연결됨 (${state.currentUser?.email || '활성'})`;
    if (els.driveConnectBtn) {
      els.driveConnectBtn.style.borderColor = 'var(--accent)';
      els.driveConnectBtn.title = 'Google Drive 연결 상태 (클릭 시 재연동)';
    }
    if (els.driveManualSyncBtn) show(els.driveManualSyncBtn, 'flex');
  } else if (isLoggedIn) {
    els.driveStatusText.textContent = 'Google 드라이브 재연결 필요 (클릭)';
    if (els.driveConnectBtn) {
      els.driveConnectBtn.style.borderColor = '#E0484B';
      els.driveConnectBtn.title = '토큰이 만료되었습니다. 클릭하여 다시 연결하세요.';
    }
    if (els.driveManualSyncBtn) hide(els.driveManualSyncBtn);
  } else {
    els.driveStatusText.textContent = 'Google 드라이브 연결';
    if (els.driveConnectBtn) {
      els.driveConnectBtn.style.borderColor = 'var(--border)';
      els.driveConnectBtn.title = 'Google Drive 연결';
    }
    if (els.driveManualSyncBtn) hide(els.driveManualSyncBtn);
  }
}

async function handleLoginClick(forceConsent = false) {
  if (gisClient) {
    const isReturningUser = Boolean(state.currentUser && state.currentUser.email && state.currentUser.email !== 'leader@continote.com');
    const options = {};
    if (forceConsent || !isReturningUser) {
      options.prompt = 'consent';
    } else {
      // 이미 로그인했던 사용자: 동의 화면 생략 + 이메일 힌트로 1초 무동의 초고속 갱신
      options.prompt = '';
      options.hint = state.currentUser.email;
    }
    gisClient.requestAccessToken(options);
  } else {
    // GIS 미로드 환경 (로컬 오프라인 등)을 위한 직접 이메일/계정 입력 모달 지원
    const email = prompt('Google 계정 이메일을 입력하세요 (예: myworship@gmail.com):', state.currentUser?.email || '');
    if (email && email.includes('@')) {
      const name = email.split('@')[0];
      state.currentUser = {
        email,
        name,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
      };
      saveUserSession(state.currentUser);
      updateAuthUI();
      await migrateLocalContisToUser(state.currentUser);
      renderContiListView();
      applyUIState();
    }
  }
}

function handleProfileClick() {
  const isDriveAuthed = hasDriveAuth();
  // 1. 드라이브 토큰이 만료/미연결 상태라면 번거로운 confirm 창 없이 즉시 1클릭 자동 무동의 갱신 시도!
  if (!isDriveAuthed && state.currentUser && state.currentUser.email !== 'leader@continote.com') {
    handleLoginClick(false);
    return;
  }

  // 2. 이미 드라이브가 잘 연결되어 있을 때 클릭하면 로그아웃 확인
  if (!confirm(`'${state.currentUser.name} (${state.currentUser.email})' 계정에서 로그아웃하시겠습니까?`)) return;
  clearUserSession();
}

/* ==================================================
   [1단계] 콘티 목록 화면 (Conti List View)
   - 인도자: 로그인한 계정이 만든 콘티만 노출 및 수정/삭제/공유 가능!
   - 사용자: 내가 만든 콘티 + 나에게 공유된 콘티 노출
   ================================================== */
let editingContiId = null;
let sharingContiId = null;
const expandedContiGroups = new Set();

function createContiCardElement(conti, isLeader, myEmail) {
  const card = document.createElement('div');
  card.className = 'conti-card p-3 sm:p-3.5 rounded-2xl border transition-all active:scale-[0.99] cursor-pointer flex flex-col gap-1.5 shadow-sm hover:shadow-md';
  card.style.borderColor = 'var(--border)';
  card.style.backgroundColor = 'var(--surface)';

  const songCount = (conti.songs && conti.songs.length) || 0;
  const isShared = (conti.authorEmail || 'leader@continote.com') !== myEmail;
  const canEdit = isLeader || !isShared;

  card.innerHTML = `
    <!-- 1줄: 날짜 및 공유 상태 -->
    <div class="flex items-center gap-1.5 flex-wrap min-w-0">
      ${conti.date ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--text-dim)">${escapeHtml(conti.date)}</span>` : ''}
      ${isShared ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0" style="background:var(--accent-soft);color:var(--accent)">공유받음 (${escapeHtml(conti.authorName || '인도자')})</span>` : ''}
    </div>

    <!-- 2줄: 콘티 제목 (좌측) & 슬림 액션 버튼들 (우측) -->
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <h3 class="font-bold text-base sm:text-lg truncate">${escapeHtml(conti.title)}</h3>
        ${conti.memo ? `<p class="text-xs sm:text-sm mt-0.5 line-clamp-1" style="color:var(--text-dim)">${escapeHtml(conti.memo)}</p>` : ''}
      </div>
      <div class="shrink-0 flex items-center gap-1.5">
        ${canEdit ? `
          <button data-edit-conti="${conti.id}" class="p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-bold border flex items-center gap-1 shrink-0 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all shadow-sm" style="border-color:var(--border);background:var(--surface-2);color:var(--text)" title="콘티 제목/날짜/메모 수정">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="w-3.5 h-3.5"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            <span class="hidden sm:inline">수정</span>
          </button>
        ` : ''}
        ${isLeader ? `
          <button data-share-conti="${conti.id}" class="p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-bold border flex items-center gap-1 shrink-0 hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all shadow-sm" style="border-color:var(--border);background:var(--surface-2);color:var(--text)" title="찬양팀원에게 공유">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="w-3.5 h-3.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
            <span class="hidden sm:inline">공유</span>
          </button>
          <button data-delete-conti="${conti.id}" class="p-1.5 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 active:scale-95 transition-all shrink-0" title="콘티 삭제">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        ` : ''}
      </div>
    </div>

    <!-- 3줄: n곡 배지 (좌측) & 곡 목록 보기 (우측) -->
    <div class="pt-2 border-t flex items-center justify-between text-xs" style="border-color:var(--border)">
      <span class="px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0" style="background:var(--accent-soft);color:var(--accent)">
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
  if (!els.contiListContainer) return;
  els.contiListContainer.innerHTML = '';

  const isLeader = state.activeMenu === 'leader';
  const myEmail = state.currentUser?.email || 'leader@continote.com';

  // 계정별 콘티 필터링
  let contis = state.contis || [];
  const isDefaultGuest = myEmail === 'leader@continote.com';

  if (isLeader) {
    // 인도자 메뉴: 로그인한 계정의 콘티 + 로그인 전 기본 계정으로 로컬에 생성된 콘티도 안전하게 포함
    contis = contis.filter(c => {
      const author = c.authorEmail || 'leader@continote.com';
      return author === myEmail || (!isDefaultGuest && author === 'leader@continote.com');
    });
  } else {
    // 사용자 메뉴: 내가 만들었거나(기본 콘티 포함), 나에게 공유된 콘티 노출
    contis = contis.filter(c => {
      const author = c.authorEmail || 'leader@continote.com';
      const isMine = author === myEmail || (!isDefaultGuest && author === 'leader@continote.com');
      const isSharedToMe = Array.isArray(c.sharedWith) && c.sharedWith.includes(myEmail);
      return isMine || isSharedToMe;
    });
  }

  if (!contis.length) {
    show(els.contiEmptyState, 'block');
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
      if (hasDriveAuth()) {
        syncContisIndexToDrive(state.contis, true);
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

function openContiModal(contiId = null) {
  editingContiId = contiId;
  if (contiId) {
    const c = state.contis.find(item => item.id === contiId);
    els.contiModalTitle.textContent = '예배 콘티 수정';
    els.contiTitleInput.value = c?.title || '';
    els.contiDateInput.value = c?.date || '';
    els.contiMemoInput.value = c?.memo || '';
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
function openShareModal(contiId) {
  sharingContiId = contiId;
  const conti = state.contis.find(c => c.id === contiId);
  if (!conti) return;

  els.shareContiTitle.textContent = conti.title;
  els.shareEmailInput.value = '';
  renderShareEmailList();
  show(els.shareModal, 'flex');
  setTimeout(() => els.shareEmailInput.focus(), 100);
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
    const chip = document.createElement('span');
    chip.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border';
    chip.style.borderColor = 'var(--border)';
    chip.style.backgroundColor = 'var(--surface)';
    chip.innerHTML = `
      <span>${escapeHtml(email)}</span>
      <button data-remove-share="${idx}" class="text-neutral-400 hover:text-red-500 font-bold ml-0.5 text-xs">×</button>
    `;
    els.shareEmailList.appendChild(chip);
  });

  els.shareEmailList.querySelectorAll('[data-remove-share]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.removeShare);
      conti.sharedWith.splice(idx, 1);
      await saveContis();
      renderShareEmailList();
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

  // [2단계 지연 동기화] 선택한 콘티에 해당하는 악보 및 상세 데이터만 Drive에서 동기화
  if (hasDriveAuth()) {
    await syncContiDetailFromDrive(contiId);
  }

  await loadSongs();
  renderSongListView();
  applyUIState();
  pushAppState();
}

export function renderSongListView() {
  if (!els.songListContainer) return;
  els.songListContainer.innerHTML = '';

  const currentConti = getCurrentConti();
  if (els.songListContiTitle) els.songListContiTitle.textContent = currentConti?.title || '예배 콘티';
  if (els.songListSongCountBadge) els.songListSongCountBadge.textContent = `${state.songs.length}곡`;
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
    return;
  }
  hide(els.songListEmptyState);

  const isLeader = state.activeMenu === 'leader';

  state.songs.forEach((song, idx) => {
    const row = document.createElement('div');
    row.className = 'song-card p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center gap-2.5 sm:gap-3 shadow-sm hover:shadow-md';
    row.style.borderColor = 'var(--border)';
    row.style.backgroundColor = 'var(--surface)';
    row.dataset.index = idx;

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
            <span class="px-2 py-0.5 rounded-lg text-xs font-bold border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--accent)">#${idx + 1}</span>
            <span class="text-sm sm:text-base font-bold truncate whitespace-nowrap flex-1 min-w-0">${escapeHtml(song.name)}</span>
            ${song.key ? `<span class="hidden sm:inline-block text-xs sm:text-sm px-2 py-0.5 rounded-lg font-bold border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--accent)">${escapeHtml(song.key)}</span>` : ''}
            ${song.tempo ? `<span class="hidden sm:inline-block text-xs sm:text-sm font-semibold text-neutral-500 shrink-0">♩${escapeHtml(song.tempo)}</span>` : ''}
          </div>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            ${(song.key || song.tempo) ? `
              <div class="flex sm:hidden items-center gap-1.5 shrink-0">
                ${song.key ? `<span class="text-xs px-1.5 py-0.5 rounded-md font-bold border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--accent)">${escapeHtml(song.key)}</span>` : ''}
                ${song.tempo ? `<span class="text-xs font-semibold text-neutral-500 shrink-0">♩${escapeHtml(song.tempo)}</span>` : ''}
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
            <span class="px-2 py-0.5 rounded-lg text-xs font-bold border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--accent)">#${idx + 1}</span>
            <h4 class="text-sm sm:text-base font-bold truncate whitespace-nowrap flex-1 min-w-0">${escapeHtml(song.name)}</h4>
            ${song.key ? `<span class="text-xs sm:text-sm px-2 py-0.5 rounded-lg font-bold border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--accent)">${escapeHtml(song.key)}</span>` : ''}
            ${song.tempo ? `<span class="text-xs sm:text-sm font-semibold text-neutral-500 shrink-0">♩${escapeHtml(song.tempo)}</span>` : ''}
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
    syncContiDetailToDrive(state.currentContiId, true);
  }
  renderSongListView();
}

/* ==================================================
   [VIEW: 마스터 악보 보관함 (Library)]
   ================================================== */
let selectedLibraryTheme = null;
let targetAddToContiSong = null;
let targetAddToContiMode = 'sheet'; // 'sheet' | 'full'

export function renderSongLibraryView() {
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

  // 검색어 및 필터 적용
  const query = (els.librarySearchInput?.value || '').trim().toLowerCase();
  let list = state.allSongs || [];

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

    const registrantName = song.authorName || state.currentUser?.name || '인도자';

    const themeBadges = (song.themes || []).map(t =>
      `<span class="text-[10px] px-1.5 py-0.2 rounded-md font-semibold border" style="border-color:var(--border);background:var(--surface-2);color:var(--text-dim)">#${escapeHtml(t)}</span>`
    ).join(' ');

    card.innerHTML = `
      <div class="song-info-area flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none active:opacity-80 transition-opacity" title="악보 및 송폼 열기">
        <div class="min-w-0 flex-1 py-0.5">
          <!-- 1번째 줄: 곡 제목 -->
          <div class="flex items-center min-w-0">
            <h4 class="font-bold text-sm sm:text-base truncate whitespace-nowrap flex-1 min-w-0">${escapeHtml(song.name)}</h4>
          </div>
          <!-- 2번째 줄: 등록일자(코드 왼편 칩), Key, 박자, 템포, 주제 태그 -->
          <div class="flex items-center gap-1.5 mt-1 flex-wrap">
            <span class="text-[11px] sm:text-xs px-1.5 py-0.5 rounded-md font-medium border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--text-dim)" title="등록일자: ${dateStr}">${dateStr}</span>
            ${song.key ? `<span class="text-[11px] sm:text-xs px-1.5 py-0.5 rounded-md font-bold border shrink-0" style="border-color:var(--border);background:var(--surface-2);color:var(--accent)">${escapeHtml(song.key)}</span>` : ''}
            ${song.timeSig ? `<span class="text-[11px] sm:text-xs px-1.5 py-0.5 rounded font-semibold text-neutral-500 shrink-0">${song.timeSig}</span>` : ''}
            ${song.tempo ? `<span class="text-[11px] sm:text-xs font-semibold text-neutral-500 shrink-0">♩${escapeHtml(song.tempo)}</span>` : ''}
            ${themeBadges}
          </div>
          <!-- 3번째 줄: 송폼 영역 왼편 등록자(모바일은 이름만, 태블릿 이상은 '등록자' 라벨 표시) & 송폼 진행 순서 -->
          <div class="mt-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full py-0.5 select-none">
            <span class="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md font-medium border shrink-0 flex items-center gap-1"
              style="border-color:var(--border);background:var(--surface-2);color:var(--text-dim)"
              title="등록자: ${escapeHtml(registrantName)}">
              <span class="hidden sm:inline opacity-75">등록자</span>
              <span class="font-semibold" style="color:var(--text)">${escapeHtml(registrantName)}</span>
            </span>
            ${hasSongform ? `
              <div class="flex items-center overflow-x-auto no-scrollbar max-w-full py-0.5 select-none" title="${escapeHtml(song.songform.join(' > '))}">
                ${renderSongformChipsHtml(song.songform)}
              </div>` : ''}
          </div>
        </div>
      </div>
      <!-- 우측 버튼 영역: 송폼 유무에 따라 1단 또는 위아래 2단 배치 -->
      <div class="shrink-0 flex flex-col items-stretch gap-1.5">
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
    `;

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

    els.librarySongListContainer.appendChild(card);
  });
}

export async function openViewerForLibrarySong(song, libraryList = null) {
  stopMetronome();
  const list = libraryList || state.allSongs;
  const songIdx = list.findIndex(s => s.id === song.id);
  state.viewerReturnView = 'songLibrary';
  state.songs = list;
  state.currentIndex = songIdx !== -1 ? songIdx : 0;
  state.viewLevel = 'viewer';
  state.locked = true;

  if (song && !(song.id in state.stickersBySong)) {
    await loadStickers(song.id);
  }
  resetZoom();
  applyUIState();
  await renderAll();
  pushAppState();
}

function openAddToContiModal(song, mode = 'sheet') {
  targetAddToContiSong = song;
  targetAddToContiMode = mode;
  const isFull = mode === 'full';
  const modeBadge = isFull ? ' [전체: 악보+송폼+스티커]' : ' [악보만]';
  els.addToContiSongTitle.textContent = `${song.name} (Key ${song.key || '-'})${modeBadge}`;
  els.addToContiListContainer.innerHTML = '';

  const myEmail = state.currentUser?.email || 'leader@continote.com';
  const myContis = (state.contis || []).filter(c => (c.authorEmail || 'leader@continote.com') === myEmail);

  if (!myContis.length) {
    els.addToContiListContainer.innerHTML = `<p class="text-xs text-center py-4" style="color:var(--text-dim)">등록된 내 콘티가 없습니다. 먼저 새 콘티를 만들어주세요.</p>`;
    show(els.addToContiModal, 'flex');
    return;
  }

  myContis.forEach((c, idx) => {
    const label = document.createElement('label');
    label.className = 'flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all';
    label.style.borderColor = 'var(--border)';
    label.innerHTML = `
      <div class="min-w-0 pr-2">
        <div class="font-bold text-xs sm:text-sm truncate">${escapeHtml(c.title)}</div>
        <div class="text-[11px] mt-0.5" style="color:var(--text-dim)">${c.date || '날짜 미정'} · ${c.songs?.length || 0}곡</div>
      </div>
      <input type="radio" name="targetContiRadio" value="${c.id}" ${idx === 0 ? 'checked' : ''} class="w-4 h-4 accent-[var(--accent)]" />
    `;
    els.addToContiListContainer.appendChild(label);
  });

  show(els.addToContiModal, 'flex');
}

/* ==================================================
   [3단계] 악보 뷰어 화면 (Viewer Section)
   ================================================== */
export function isTwoPageViewActive() {
  return state.activeMenu === 'user' && (state.viewSheetCount === 2) && (window.innerWidth >= 640) && (state.songs.length > 1);
}

export async function openViewerForSong(songIndex) {
  stopMetronome();
  if (isTwoPageViewActive()) {
    // 2곡 보기 모드에서는 책 펼침 양면 페어(1-2, 3-4, 5-6...) 기준 짝수 인덱스로 정렬
    state.currentIndex = Math.floor(songIndex / 2) * 2;
  } else {
    state.currentIndex = songIndex;
  }
  state.viewLevel = 'viewer';
  state.locked = true;
  saveCurrentMenuSession();
  const song = state.songs[state.currentIndex];
  if (song && !(song.id in state.stickersBySong)) {
    await loadStickers(song.id);
  }
  const nextSong = isTwoPageViewActive() ? state.songs[state.currentIndex + 1] : null;
  if (nextSong && !(nextSong.id in state.stickersBySong)) {
    await loadStickers(nextSong.id);
  }
  resetZoom();
  applyUIState();
  await renderAll();
  pushAppState();
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
  const songLeft = state.songs[state.currentIndex];
  const songRight = isTwoPage ? (state.songs[state.currentIndex + 1] || null) : null;

  if (isTwoPage) {
    const vw = els.viewer.clientWidth;
    const vh = els.viewer.clientHeight;
    const gap = 12;
    const halfW = Math.floor((vw - gap) / 2);

    // 슬롯 0: 좌측 악보
    if (songLeft) {
      els.sheetContainer.style.display = 'block';
      await renderBaseSheet(els.viewer, els.sheetContainer, els.baseCanvas, songLeft, { x: 0, y: 0, w: halfW, h: vh });
      await renderUserDrawing(els.sheetContainer, els.userCanvas, songLeft.id);
      if (!(songLeft.id in state.stickersBySong)) {
        await loadStickers(songLeft.id);
      }
      renderStickerLayer(els.stickerLayer, els.sheetContainer, songLeft.id);
    } else {
      clearCanvases(els.sheetContainer, els.baseCanvas, els.userCanvas);
      renderStickerLayer(els.stickerLayer, els.sheetContainer, null);
    }

    // 슬롯 1: 우측 악보 (홀수 곡일 때는 깔끔한 빈 슬롯 유지)
    if (songRight) {
      if (els.sheetContainerRight) {
        els.sheetContainerRight.style.display = 'block';
        await renderBaseSheet(els.viewer, els.sheetContainerRight, els.baseCanvasRight, songRight, { x: halfW + gap, y: 0, w: halfW, h: vh });
        await renderUserDrawing(els.sheetContainerRight, els.userCanvasRight, songRight.id);
        if (!(songRight.id in state.stickersBySong)) {
          await loadStickers(songRight.id);
        }
        renderStickerLayer(els.stickerLayerRight, els.sheetContainerRight, songRight.id);
      }
    } else {
      if (els.sheetContainerRight) {
        els.sheetContainerRight.style.display = 'none';
        clearCanvases(els.sheetContainerRight, els.baseCanvasRight, els.userCanvasRight);
        renderStickerLayer(els.stickerLayerRight, els.sheetContainerRight, null);
      }
    }
  } else {
    // 1곡 보기 모드 (단독 슬롯 0)
    if (els.sheetContainerRight) {
      els.sheetContainerRight.style.display = 'none';
      clearCanvases(els.sheetContainerRight, els.baseCanvasRight, els.userCanvasRight);
      renderStickerLayer(els.stickerLayerRight, els.sheetContainerRight, null);
    }
    if (songLeft) {
      els.sheetContainer.style.display = 'block';
      await renderBaseSheet(els.viewer, els.sheetContainer, els.baseCanvas, songLeft);
      await renderUserDrawing(els.sheetContainer, els.userCanvas, songLeft.id);
      if (!(songLeft.id in state.stickersBySong)) {
        await loadStickers(songLeft.id);
      }
      renderStickerLayer(els.stickerLayer, els.sheetContainer, songLeft.id);
    } else {
      clearCanvases(els.sheetContainer, els.baseCanvas, els.userCanvas);
      renderStickerLayer(els.stickerLayer, els.sheetContainer, null);
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
  if (state.activeMenu && menuSessions[state.activeMenu]) {
    menuSessions[state.activeMenu] = {
      viewLevel: state.viewLevel,
      currentContiId: state.currentContiId,
      currentIndex: state.currentIndex,
      locked: state.locked,
      viewerReturnView: state.viewerReturnView,
    };
  }
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

    // 뷰어 편집 중 브라우저 뒤로가기 제스처 시 저장 확인
    if (state.viewLevel === 'viewer' && !state.locked && hasDriveAuth() && state.currentContiId) {
      if (confirm('편집 중인 내용이 있습니다. 저장하시겠습니까?')) {
        syncContiDetailToDrive(state.currentContiId, true);
      }
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
  state.currentIndex = targetState.currentIndex || 0;
  state.viewerReturnView = targetState.viewerReturnView || null;

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
    const song = state.songs[state.currentIndex];
    if (song && !(song.id in state.stickersBySong)) {
      await loadStickers(song.id);
    }
    resetZoom();
    await renderAll();
  }

  saveCurrentMenuSession();
  applyUIState();
}

export function handleDirectBack() {
  stopMetronome();
  if (state.viewLevel === 'viewer') {
    const wasEditing = !state.locked;
    if (wasEditing && hasDriveAuth() && state.currentContiId) {
      if (confirm('편집 중인 내용이 있습니다. 저장하시겠습니까?')) {
        syncContiDetailToDrive(state.currentContiId, true);
      }
    }
    if (state.viewerReturnView === 'songLibrary') {
      state.viewLevel = 'songLibrary';
      state.viewerReturnView = null;
      state.locked = true;
      resetZoom();
      saveCurrentMenuSession();
      renderSongLibraryView();
      applyUIState();
      return;
    }
    state.viewLevel = 'songList';
    state.viewerReturnView = null;
    state.locked = true;
    resetZoom();
    saveCurrentMenuSession();
    renderSongListView();
    applyUIState();
  } else if (state.viewLevel === 'songList') {
    state.viewLevel = 'contiList';
    state.currentContiId = null;
    state.viewerReturnView = null;
    saveCurrentMenuSession();
    renderContiListView();
    applyUIState();
  } else if (state.viewLevel === 'settings' || state.viewLevel === 'songLibrary') {
    switchToMenu(state.previousMenu || 'user', true);
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

  // 4. 복원된 세션에 맞는 데이터 로드 및 렌더링
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
    await renderAll();
  }

  applyUIState();
  if (!isFromHistory) {
    pushAppState();
  }
}

/* ==================================================
   UI 가시성 및 상태 제어
   ================================================== */
export function applyUIState() {
  document.documentElement.classList.toggle('dark', isDarkThemeActive());

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

  // 뷰어 모드가 아닐 때 뷰어 메트로놈이 실행 중이면 자동 정지
  if (state.viewLevel !== 'viewer' && metronomeActiveBtn === els.viewerBpmBtn) {
    stopMetronome();
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
    hide(els.viewerBpmBtn);
    hide(els.lockBtn);
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
    } else {
      hide(els.songListAddBtn);
    }
    hide(els.viewerBpmBtn);
    hide(els.lockBtn);
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

    show(els.backBtn, 'flex');
    if (els.backBtnText) els.backBtnText.textContent = '이전 화면';
    hide(els.headerLogoArea);
    show(els.viewerHeaderInfo, 'flex');
    if (els.viewerContiTitle) els.viewerContiTitle.textContent = '악보 보관함';
    if (els.viewerSongTitle) {
      els.viewerSongTitle.textContent = `${state.allSongs.length}개의 악보 보관 중`;
      show(els.viewerSongTitle);
    }
    hide(els.addContiBtn);
    hide(els.songListAddBtn);
    hide(els.viewerBpmBtn);
    hide(els.lockBtn);
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

    show(els.backBtn, 'flex');
    if (els.backBtnText) els.backBtnText.textContent = '이전 화면';
    hide(els.headerLogoArea);
    show(els.viewerHeaderInfo, 'flex');
    if (els.viewerContiTitle) els.viewerContiTitle.textContent = '환경 설정';
    if (els.viewerSongTitle) {
      els.viewerSongTitle.textContent = '테마 및 클라우드 동기화';
      show(els.viewerSongTitle);
    }
    hide(els.addContiBtn);
    hide(els.songListAddBtn);
    hide(els.viewerBpmBtn);
    hide(els.lockBtn);
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
  if (els.viewerSongTitle) {
    if (isTwoPageViewActive()) {
      const nextSong = state.songs[state.currentIndex + 1];
      if (currentSong && nextSong) {
        els.viewerSongTitle.textContent = `${state.currentIndex + 1}. ${currentSong.name} | ${state.currentIndex + 2}. ${nextSong.name}`;
      } else if (currentSong) {
        els.viewerSongTitle.textContent = `${state.currentIndex + 1}. ${currentSong.name}`;
      } else {
        els.viewerSongTitle.textContent = '악보 없음';
      }
    } else {
      els.viewerSongTitle.textContent = currentSong ? `${state.currentIndex + 1}. ${currentSong.name}` : '악보 없음';
    }
    show(els.viewerSongTitle, 'inline');
  }

  hide(els.addContiBtn);
  hide(els.songListAddBtn);
  if (hasSongs) {
    show(els.navIndicator, 'inline-flex');
    if (currentSong && currentSong.tempo) {
      if (els.viewerBpmText) els.viewerBpmText.textContent = currentSong.tempo;
      if (els.viewerBpmBtn) {
        els.viewerBpmBtn.title = `템포: ${currentSong.tempo} BPM (클릭하여 소리 듣기)`;
        show(els.viewerBpmBtn, 'inline-flex');
      }
    } else {
      if (els.viewerBpmText) els.viewerBpmText.textContent = '--';
      if (els.viewerBpmBtn) {
        els.viewerBpmBtn.title = '설정된 템포(BPM) 없음';
        show(els.viewerBpmBtn, 'inline-flex');
      }
    }
  } else {
    hide(els.navIndicator);
    hide(els.viewerBpmBtn);
    stopMetronome();
  }
  show(els.lockBtn, 'flex');

  els.emptyState.style.display = hasSongs ? 'none' : 'flex';
  els.baseCanvas.style.visibility = hasSongs ? 'visible' : 'hidden';
  els.userCanvas.style.visibility = hasSongs ? 'visible' : 'hidden';
  if (els.baseCanvasRight) els.baseCanvasRight.style.visibility = hasSongs ? 'visible' : 'hidden';
  if (els.userCanvasRight) els.userCanvasRight.style.visibility = hasSongs ? 'visible' : 'hidden';

  if (state.locked) {
    show(els.lockClosedIcon, 'flex');
    hide(els.lockOpenIcon);
    els.lockBtn.className = 'h-8 sm:h-[34px] px-2 sm:px-2.5 rounded-full border flex items-center justify-center gap-1.5 active:scale-95 transition-all shrink-0 select-none shadow-sm cursor-pointer lock-view-mode';
    els.lockBtn.style.borderColor = 'var(--border)';
    els.lockBtn.style.backgroundColor = 'var(--surface-2)';
    els.lockBtn.style.color = 'var(--text-dim)';
    if (els.lockBtnLabel) els.lockBtnLabel.textContent = '보기';
    els.lockBtn.title = '보기 모드 (잠김 - 클릭하여 편집 모드로 전환)';
  } else {
    hide(els.lockClosedIcon);
    show(els.lockOpenIcon, 'flex');
    els.lockBtn.className = 'h-8 sm:h-[34px] px-2 sm:px-2.5 rounded-full border flex items-center justify-center gap-1.5 active:scale-95 transition-all shrink-0 select-none shadow-sm cursor-pointer lock-edit-mode';
    els.lockBtn.style.borderColor = 'var(--accent)';
    els.lockBtn.style.backgroundColor = 'var(--accent-soft)';
    els.lockBtn.style.color = 'var(--accent)';
    if (els.lockBtnLabel) els.lockBtnLabel.textContent = '편집';
    els.lockBtn.title = '편집 모드 (열림 - 클릭하여 보기 모드로 전환)';
  }

  const nextSongForSf = isTwoPageViewActive() ? state.songs[state.currentIndex + 1] : null;
  const hasSongform = (currentSong && currentSong.songform && currentSong.songform.length > 0) ||
                      (nextSongForSf && nextSongForSf.songform && nextSongForSf.songform.length > 0);
  const isEditingLeader = !state.locked && isLeader;
  const showStickyBar = hasSongs && (isEditingLeader || hasSongform);
  els.songformStickyBar.style.display = showStickyBar ? 'flex' : 'none';

  // [상단 1행] 인도자 전용 스티커 부착 바
  if (els.stickerBarRow) {
    els.stickerBarRow.style.display = isEditingLeader ? 'flex' : 'none';
  }
  if (els.songformChipsList) {
    els.songformChipsList.style.display = isEditingLeader ? 'flex' : 'none';
  }
  if (els.openChordModalBtn) {
    els.openChordModalBtn.style.display = isEditingLeader ? 'inline-flex' : 'none';
  }
  if (els.stickerSizeControls) {
    els.stickerSizeControls.style.display = isEditingLeader ? 'flex' : 'none';
    updateStickerSizeLabel(state.stickerStep || 3);
  }

  // [하단 2행] 송폼 진행 순서 바 (편집 화면에서는 스티커 바 아래로 분리 표시)
  if (els.flowBarRow) {
    const showFlow = hasSongform || isEditingLeader;
    els.flowBarRow.style.display = showFlow ? 'flex' : 'none';
  }

  const showLeaderToolbar = !state.locked && isLeader;
  const showUserToolbar = !state.locked && !isLeader;

  els.leaderToolbar.style.display = showLeaderToolbar ? 'flex' : 'none';
  els.userPenToolbar.style.display = showUserToolbar ? 'flex' : 'none';

  const showNav = state.locked && hasSongs && state.songs.length > 1;
  els.navUI.style.display = showNav ? 'block' : 'none';
  els.navUI.classList.toggle('hidden', !showNav);

  const canEditStickers = !state.locked && isLeader;
  els.stickerLayer.classList.toggle('locked', !canEditStickers);
  if (els.stickerLayerRight) els.stickerLayerRight.classList.toggle('locked', !canEditStickers);
  const canDraw = (!state.locked && !isLeader && hasSongs);
  els.userCanvas.style.pointerEvents = canDraw ? 'auto' : 'none';
  if (els.userCanvasRight) els.userCanvasRight.style.pointerEvents = canDraw ? 'auto' : 'none';

  const canZoom = !state.locked && hasSongs;
  updateZoomVisibility(!canZoom);

  const isDark = isDarkThemeActive();
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

  updateHotspotPositions();
  updateNavIndicator();
  renderColorSwatches();
  updateBottomNavActiveState();
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
  if (els.navIndicator) {
    if (state.songs.length > 0 && state.viewLevel === 'viewer') {
      if (isTwoPageViewActive()) {
        const nextIdx = state.currentIndex + 1;
        if (nextIdx < state.songs.length) {
          els.navIndicator.textContent = `${state.currentIndex + 1}-${nextIdx + 1} / ${state.songs.length} 곡`;
        } else {
          els.navIndicator.textContent = `${state.currentIndex + 1} / ${state.songs.length} 곡`;
        }
      } else {
        els.navIndicator.textContent = `${state.currentIndex + 1} / ${state.songs.length} 곡`;
      }
      show(els.navIndicator, 'inline-flex');
    } else {
      els.navIndicator.textContent = '';
      hide(els.navIndicator);
    }
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

function goPrev() {
  if (!state.locked) return;
  const step = isTwoPageViewActive() ? 2 : 1;
  if (state.currentIndex > 0) {
    stopMetronome();
    resetZoom();
    state.currentIndex = Math.max(0, state.currentIndex - step);
    renderAll();
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
    renderAll();
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
  const isLeader = state.activeMenu === 'leader';

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

      if (isLeader) {
        flowWrap.classList.add('cursor-pointer', 'hover:opacity-85');
        flowWrap.title = '탭하여 송폼 진행 순서(Flow) 편집';
        flowWrap.addEventListener('click', () => openSongformOrderModal());
      }
      col.appendChild(flowWrap);
    } else if (isLeader && !state.locked) {
      const emptyBtn = document.createElement('button');
      emptyBtn.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-dashed text-xs font-semibold active:scale-95 transition-all';
      emptyBtn.style.borderColor = 'var(--border)';
      emptyBtn.style.color = 'var(--text-dim)';
      emptyBtn.innerHTML = `<span>+ 송폼 순서</span>`;
      emptyBtn.addEventListener('click', () => openSongformOrderModal());
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

function placeSongformSticker(label) {
  if (state.activeMenu !== 'leader') return;
  if (state.locked) {
    state.locked = false;
    applyUIState();
  }
  const song = state.songs[state.currentIndex];
  if (!song) {
    alert('먼저 악보를 등록해주세요.');
    return;
  }
  const list = state.stickersBySong[song.id] || (state.stickersBySong[song.id] = []);
  list.push({
    id: crypto.randomUUID(),
    type: 'songform',
    label,
    x: 50,
    y: 35
  });
  saveStickers(song.id);
  renderStickerLayer(els.stickerLayer, els.sheetContainer, song.id);
}

function openChordModal() {
  if (state.activeMenu !== 'leader') return;
  const song = state.songs[state.currentIndex];
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
  if (state.activeMenu !== 'leader') return;
  const text = (chordText || '').trim();
  if (!text) {
    alert('코드 텍스트를 입력해주세요.');
    return;
  }
  const song = state.songs[state.currentIndex];
  if (!song) {
    alert('먼저 악보를 등록해주세요.');
    return;
  }
  const list = state.stickersBySong[song.id] || (state.stickersBySong[song.id] = []);
  list.push({
    id: crypto.randomUUID(),
    type: 'chord',
    label: text,
    x: 50,
    y: 35
  });
  saveStickers(song.id);
  renderStickerLayer(els.stickerLayer, els.sheetContainer, song.id);
  if (hasDriveAuth() && state.currentContiId) {
    syncContiDetailToDrive(state.currentContiId, false);
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

  els.viewer.addEventListener('pointerup', (e) => {
    if (!active || !state.locked) return;
    active = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const elapsed = Date.now() - startTime;
    if (elapsed > 700) return;

    if (state.navDirection === 'horizontal') {
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goNext();
        else goPrev();
      }
    } else {
      if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) goNext();
        else goPrev();
      }
    }
  });
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

// 최종 저장 및 적용 시점에만 1회 고품질 확정 렌더링
function getFinalScaledImageUrl() {
  if (!ratioState.img) return null;
  const nw = ratioState.img.naturalWidth || 800;
  const nh = ratioState.img.naturalHeight || 1100;
  const tw = Math.max(10, Math.round(nw * ratioState.wScale));
  const th = Math.max(10, Math.round(nh * ratioState.hScale));

  const offscreen = document.createElement('canvas');
  offscreen.width = tw;
  offscreen.height = th;
  const ctx = offscreen.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(ratioState.img, 0, 0, tw, th);
  return offscreen.toDataURL('image/png');
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

// 신규 곡 메타데이터 모달 오픈
function openSongMetaModal(croppedUrl, originalUrl, defaultName) {
  editingSongMetaId = null;
  pendingCroppedData = { croppedUrl, originalUrl };

  if (els.songMetaModalTitle) els.songMetaModalTitle.textContent = '악보 정보 입력';
  if (els.songMetaSaveBtn) els.songMetaSaveBtn.textContent = '악보 등록 완료';

  els.songMetaNameInput.value = defaultName || '';
  els.songMetaKeySelect.value = '';
  els.songMetaTimeSigSelect.value = '4/4';
  els.songMetaTempoInput.value = '';
  updateSongMetaBpmBtnState();
  renderSongMetaThemesContainer([]);

  if (els.songMetaLibrarySyncRow) {
    if (songUploadTarget === 'library') {
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

function openSongformOrderModal() {
  const song = state.songs[state.currentIndex];
  if (!song) {
    alert('먼저 악보를 등록해주세요.');
    return;
  }
  els.songformOrderSongTitle.textContent = `현재 곡: ${song.name}`;
  currentOrderFlow = Array.isArray(song.songform) ? [...song.songform] : [];

  if (els.songformStepInput) els.songformStepInput.value = '';

  els.songformPickerChips.innerHTML = '';
  state.songformLabels.forEach(label => {
    const isI = (label === 'I');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `px-3 py-1.5 rounded-full border text-xs sm:text-sm font-bold transition-all active:scale-95 shadow-sm ${isI ? 'part-serif-i' : ''}`;
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

function renderSongformOrderFlowList() {
  els.songformFlowList.innerHTML = '';
  if (!currentOrderFlow.length) {
    els.songformFlowList.innerHTML = `<span id="songformFlowEmptyHint" class="text-xs" style="color:var(--text-dim)">입력 후 [추가]를 누르면 순서가 연결됩니다</span>`;
    return;
  }
  currentOrderFlow.forEach((step, idx) => {
    const isI = (step === 'I');
    const chip = document.createElement('span');
    chip.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-sm cursor-pointer hover:opacity-85 active:scale-95 transition-all ${isI ? 'part-serif-i' : ''}`;
    chip.style.backgroundColor = 'var(--accent)';
    chip.style.color = '#ffffff';
    chip.innerHTML = `<span>${escapeHtml(step)}</span><span class="text-[10px] opacity-75 font-normal ml-0.5">×</span>`;
    chip.title = '탭하여 이 파트 삭제';
    chip.addEventListener('click', () => {
      currentOrderFlow.splice(idx, 1);
      renderSongformOrderFlowList();
    });
    els.songformFlowList.appendChild(chip);

    if (idx < currentOrderFlow.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'text-xs opacity-40 font-bold';
      arrow.textContent = '>';
      els.songformFlowList.appendChild(arrow);
    }
  });
}

/* ==================================================
   환경 설정 화면 관리 (송폼 라벨, 주제 태그, 테마, 네비게이션)
   ================================================== */
export function renderSettingsView() {
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
  if (els.viewCount1Btn) setButtonActive(els.viewCount1Btn, (state.viewSheetCount || 1) === 1);
  if (els.viewCount2Btn) setButtonActive(els.viewCount2Btn, state.viewSheetCount === 2);
}

/* ==================================================
   이벤트 리스너 연결
   ================================================== */
function wireEventListeners() {
  // 인증 관련
  els.headerGoogleLoginBtn.addEventListener('click', handleLoginClick);
  els.headerProfileChip.addEventListener('click', handleProfileClick);

  // 3단계 뒤로가기 버튼
  els.backBtn.addEventListener('click', () => {
    if (appHistoryDepth > 0) {
      window.history.back();
    } else {
      handleDirectBack();
    }
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

    if (editingContiId) {
      const target = state.contis.find(c => c.id === editingContiId);
      if (target) {
        target.title = title;
        target.date = date;
        target.memo = memo;
      }
    } else {
      const newConti = {
        id: crypto.randomUUID(),
        title,
        date,
        memo,
        authorEmail: state.currentUser?.email || 'leader@continote.com',
        authorName: state.currentUser?.name || '찬양인도자',
        sharedWith: [],
        songs: [],
        createdAt: Date.now()
      };
      state.contis.unshift(newConti);
    }
    await saveContis();
    if (hasDriveAuth()) {
      syncContisIndexToDrive(state.contis, true);
    }
    hide(els.contiModal);
    renderContiListView();
    applyUIState();
  });
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
        els.shareEmailInput.value = '';
        renderShareEmailList();
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



  // 헤더 악보 뷰어 템포(BPM) 메트로놈 재생/정지 버튼
  if (els.viewerBpmBtn) {
    els.viewerBpmBtn.addEventListener('click', () => {
      const song = getCurrentSong();
      const tempo = song?.tempo ? parseInt(song.tempo, 10) : 0;
      if (!tempo || tempo < 20 || tempo > 300) {
        showSyncToast('설정된 템포(BPM)가 없습니다. 악보 정보에서 템포를 등록해주세요.', 'error');
        return;
      }
      const beats = getBeatsPerMeasure(song?.timeSig);
      toggleMetronome(tempo, els.viewerBpmBtn, beats);
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
  if (els.emptySongAddBtn) {
    els.emptySongAddBtn.addEventListener('click', () => {
      if (state.activeMenu !== 'leader') return;
      songUploadTarget = 'conti';
      els.fileInput.click();
    });
  }

  // 자물쇠 토글 버튼
  els.lockBtn.addEventListener('click', async () => {
    const wasEditing = !state.locked;
    state.locked = !state.locked;
    saveCurrentMenuSession();
    if (state.locked) resetZoom();
    applyUIState();
    await renderAll();

    // 편집 상태에서 보기 상태로 자물쇠를 닫을 때 저장 수행
    if (wasEditing && state.locked) {
      if (hasDriveAuth() && state.currentContiId) {
        syncContiDetailToDrive(state.currentContiId, true);
      }
    }
  });

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

  // 내 콘티에 악보 추가 확인
  if (els.confirmAddToContiBtn) {
    els.confirmAddToContiBtn.addEventListener('click', async () => {
      const selected = document.querySelector('input[name="targetContiRadio"]:checked');
      if (!selected || !targetAddToContiSong) return;
      const targetConti = state.contis.find(c => c.id === selected.value);
      if (targetConti) {
        if (!targetConti.songs) targetConti.songs = [];
        const newSongId = crypto.randomUUID();
        const isFull = targetAddToContiMode === 'full';

        const cloned = {
          ...targetAddToContiSong,
          id: newSongId,
          songform: (isFull && Array.isArray(targetAddToContiSong.songform)) ? [...targetAddToContiSong.songform] : [],
          order: targetConti.songs.length
        };
        targetConti.songs.push(cloned);

        // 전체 가져오기일 때만 스티커 복사
        if (isFull) {
          const origStickers = state.stickersBySong[targetAddToContiSong.id] || (await loadStickers(targetAddToContiSong.id));
          if (origStickers && origStickers.length) {
            state.stickersBySong[newSongId] = origStickers.map(st => ({ ...st, id: crypto.randomUUID() }));
            await saveStickers(newSongId);
          }
        }

        await saveContis();
        if (hasDriveAuth() && targetConti.id) {
          syncContiDetailToDrive(targetConti.id, true);
        }
        hide(els.addToContiModal);
        const modeDesc = isFull ? '전체(악보+송폼+스티커)' : '악보';
        alert(`'${targetConti.title}' 콘티에 '${targetAddToContiSong.name}' ${modeDesc}를 가져왔습니다!`);
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
          await renderAll();
          if (hasDriveAuth() && state.currentContiId) {
            syncContiDetailToDrive(state.currentContiId, true);
          }
        }
        return;
      }

      // 신규 곡 등록: 메타데이터 입력 모달로 이동
      openSongMetaModal(finalUrl, ratioState.originalUrl, ratioState.name);
    });
  }

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
      // 1. 현재 콘티 목록에서 업데이트
      const targetSong = state.songs.find(s => s.id === editingSongMetaId);
      if (targetSong) {
        targetSong.name = name;
        targetSong.key = key;
        targetSong.timeSig = timeSig;
        targetSong.tempo = tempo;
        targetSong.themes = themes;
        await saveSongs();
        if (hasDriveAuth() && state.currentContiId) {
          syncContiDetailToDrive(state.currentContiId, true);
        }
      }

      // 2. 마스터 악보 보관함(라이브러리)에서도 일괄 업데이트 또는 사후 신규 등록
      const libSong = state.allSongs.find(s => s.id === editingSongMetaId);
      const shouldSyncToLib = els.songMetaAddToLibraryCheckbox ? els.songMetaAddToLibraryCheckbox.checked : false;

      if (libSong) {
        libSong.name = name;
        libSong.key = key;
        libSong.timeSig = timeSig;
        libSong.tempo = tempo;
        libSong.themes = themes;
        await saveLibrarySong(libSong);
        if (hasDriveAuth()) {
          syncLibraryToDrive(state.allSongs, true);
        }
      } else if (targetSong && shouldSyncToLib) {
        await saveLibrarySong(targetSong);
        if (hasDriveAuth()) {
          syncLibraryToDrive(state.allSongs, true);
        }
        showSyncToast('마스터 악보 보관함에 등록되었습니다', 'success');
      }

      stopMetronome();
      hide(els.songMetaModal);
      editingSongMetaId = null;
      renderSongListView();
      if (state.viewLevel === 'songLibrary') renderSongLibraryView();
      applyUIState();
      return;
    }

    // [신규 곡 등록 모드]
    const newSong = {
      id: crypto.randomUUID(),
      name,
      key,
      timeSig,
      tempo,
      themes,
      image: pendingCroppedData.croppedUrl,
      original: pendingCroppedData.originalUrl,
      order: state.songs.length,
      songform: [],
      createdAt: Date.now(),
      authorEmail: state.currentUser?.email || 'leader@continote.com',
      authorName: state.currentUser?.name || '인도자'
    };

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
      const beats = getBeatsPerMeasure(timeSig);
      if (bpm && bpm >= 20 && bpm <= 300) {
        toggleMetronome(bpm, els.songMetaBpmBtn, beats);
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
    if (hasDriveAuth() && state.currentContiId) {
      syncContiDetailToDrive(state.currentContiId, true);
    }
    renderStickerLayer(els.stickerLayer, els.sheetContainer, song.id);
  });

  els.leaderSaveDoneBtn.addEventListener('click', async () => {
    state.locked = true;
    resetZoom();
    applyUIState();
    await renderAll();
    if (hasDriveAuth() && state.currentContiId) {
      syncContiDetailToDrive(state.currentContiId, true);
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
    const song = state.songs[state.currentIndex];
    if (song) {
      song.songform = [...currentOrderFlow];
      await saveSongs();
      await saveLibrarySong(song);
      if (hasDriveAuth() && state.currentContiId) {
        syncContiDetailToDrive(state.currentContiId, true);
      }
    }
    hide(els.songformOrderModal);
    renderSongformStickyChips();
    applyUIState();
  });
  document.querySelectorAll('[data-close-songform-order]').forEach(el => el.addEventListener('click', () => hide(els.songformOrderModal)));

  // 사용자 도구 버튼들
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
    list.push({
      id: crypto.randomUUID(),
      type: 'text',
      label: text,
      x: 50,
      y: 45
    });
    saveStickers(targetSong.id);
    renderStickerLayer(targetLayer, targetContainer, targetSong.id);
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

  // Google Drive 연결
  els.driveConnectBtn.addEventListener('click', () => {
    handleLoginClick();
  });

  if (els.driveManualSyncBtn) {
    els.driveManualSyncBtn.addEventListener('click', async () => {
      await runFullDriveSync(true);
    });
  }

  // 곡 넘김 핫스팟
  els.hotspotPrev.addEventListener('click', goPrev);
  els.hotspotNext.addEventListener('click', goNext);

  // 드로잉 시스템 (좌측/단독 악보 & 우측 2곡보기 악보)
  setupDrawingSystem(els.userCanvas, () => {
    const song = state.songs[state.currentIndex];
    if (song) saveUserDrawing(song.id, els.userCanvas);
  });
  if (els.userCanvasRight) {
    setupDrawingSystem(els.userCanvasRight, () => {
      const songRight = state.songs[state.currentIndex + 1];
      if (songRight) saveUserDrawing(songRight.id, els.userCanvasRight);
    });
  }

  // 스와이프 내비게이션
  setupSwipeNavigation();

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

  window.addEventListener('resize', debounce(renderAll, 200));
}

/* ==================================================
   초기화
   ================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  purgeNetlifyWidgets();
  cacheElements();
  const prefs = loadPreferences();
  state.theme = prefs.theme || 'system';
  state.navDirection = prefs.navDirection || 'horizontal';
  state.songformLabels = prefs.songformLabels || ['A', 'B', 'C', 'D', 'bis', 'I', 'O'];
  state.themes = prefs.themes || ['은혜', '찬양', '감사', '회개', '결단', '십자가', '부흥', '승리'];
  state.viewSheetCount = prefs.viewSheetCount || 1;
  applyStickerStep(prefs.stickerStep || 3);

  initGoogleAuth();

  // 데이터 로드
  state.viewLevel = 'contiList';
  await loadContis();
  await loadLibrarySongs();

  // 공유 링크로 진입했을 경우 자동 열람 처리
  const hash = window.location.hash;
  if (hash.startsWith('#share=')) {
    const shareId = hash.replace('#share=', '').trim();
    const sharedConti = state.contis.find(c => c.id === shareId);
    if (sharedConti) {
      const myEmail = state.currentUser?.email || 'leader@continote.com';
      if (!sharedConti.sharedWith.includes(myEmail)) {
        sharedConti.sharedWith.push(myEmail);
        await saveContis();
      }
      openSongList(shareId);
      return;
    }
  }

  wireEventListeners();
  initBrowserHistory();
  setupPWAInstall();
  registerServiceWorker();
  renderContiListView();
  applyUIState();
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
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker 등록 실패 (로컬/비HTTPS 환경 가능):', err);
        });
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

/* ========================================================
   Netlify 주입 위젯 & 배지 런타임 실시간 제거
   ======================================================== */
function purgeNetlifyWidgets() {
  const isNetlifyEl = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag.includes('netlify')) return true;
    const id = (el.id || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    if (id.includes('netlify') || cls.includes('netlify')) return true;
    if (el.hasAttribute && (el.hasAttribute('data-netlify-deploy-id') || el.hasAttribute('data-netlify'))) return true;
    if (tag === 'a' && ((el.href || '').includes('netlify.com') || (el.href || '').includes('netlify.app'))) return true;
    if (tag === 'iframe' && ((el.src || '').includes('netlify') || (el.id || '').includes('netlify'))) return true;
    return false;
  };

  const removeMatched = (root) => {
    if (!root) return;
    if (isNetlifyEl(root)) {
      root.remove();
      return;
    }
    const candidates = root.querySelectorAll ? root.querySelectorAll('*') : [];
    candidates.forEach(el => {
      if (isNetlifyEl(el)) {
        el.remove();
      }
    });
  };

  // 초기 1회 실행
  if (document.body) removeMatched(document.body);

  // 실시간 동적 주입 감지
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          removeMatched(node);
        }
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

