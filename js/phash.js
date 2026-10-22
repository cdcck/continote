/**
 * ContiNote - Perceptual Hash (pHash) Sheet Music Similarity Engine
 * 악보 이미지의 지문(dHash, Difference Hash)을 추출하고 유사도를 비교하여 동일 곡 판별
 */

const HASH_SIZE = 16; // 16x16 = 256 bits (악보 오선지 및 마디 구조 판별에 최적화된 정밀도)

/**
 * 이미지 원본(Image, Canvas, Blob, DataURL)으로부터 256비트 dHash 16진수 문자열을 비동기 계산
 * @param {HTMLImageElement|HTMLCanvasElement|Blob|string} imageSource
 * @returns {Promise<string>} 64자리 16진수 해시 문자열
 */
export async function computeImageHash(imageSource) {
  let img;
  let revokeUrl = null;

  if (typeof imageSource === 'string') {
    img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = imageSource;
    });
  } else if (imageSource instanceof Blob) {
    revokeUrl = URL.createObjectURL(imageSource);
    img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = revokeUrl;
    });
  } else if (imageSource instanceof HTMLImageElement) {
    img = imageSource;
  } else if (imageSource instanceof HTMLCanvasElement) {
    return computeHashFromCanvas(imageSource);
  } else {
    throw new Error('지원하지 않는 이미지 타입입니다.');
  }

  // 17x16 캔버스에 리사이징 (수평 인접 픽셀 차이 비교용)
  const canvas = document.createElement('canvas');
  canvas.width = HASH_SIZE + 1;
  canvas.height = HASH_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // 흰색 배경 후 그레이스케일 드로잉
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (revokeUrl) URL.revokeObjectURL(revokeUrl);

  return computeHashFromCanvas(canvas);
}

/**
 * 캔버스 픽셀 데이터로부터 dHash 계산
 * @param {HTMLCanvasElement} canvas 
 * @returns {string} 16진수 해시 문자열
 */
function computeHashFromCanvas(canvas) {
  let targetCanvas = canvas;
  if (canvas.width !== HASH_SIZE + 1 || canvas.height !== HASH_SIZE) {
    const resized = document.createElement('canvas');
    resized.width = HASH_SIZE + 1;
    resized.height = HASH_SIZE;
    const rctx = resized.getContext('2d', { willReadFrequently: true });
    rctx.drawImage(canvas, 0, 0, resized.width, resized.height);
    targetCanvas = resized;
  }

  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, HASH_SIZE + 1, HASH_SIZE).data;

  // 밝기(Luminance) 배열 구성
  const gray = [];
  for (let i = 0; i < imgData.length; i += 4) {
    // 인간 시각 인지 가중치 적용 (Rec. 601)
    const lum = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
    gray.push(lum);
  }

  // 인접 픽셀 차이(dHash) 비트 추출 (가로 HASH_SIZE * 세로 HASH_SIZE = 256 비트)
  let bitString = '';
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      const left = gray[y * (HASH_SIZE + 1) + x];
      const right = gray[y * (HASH_SIZE + 1) + (x + 1)];
      bitString += left > right ? '1' : '0';
    }
  }

  // 256비트 2진수를 64자리 16진수로 변환
  let hexHash = '';
  for (let i = 0; i < bitString.length; i += 4) {
    const nibble = bitString.substring(i, i + 4);
    hexHash += parseInt(nibble, 2).toString(16);
  }

  return hexHash;
}

/**
 * 두 16진수 해시 간의 해밍 거리(Hamming Distance, 다른 비트 수) 계산
 * @param {string} hash1 
 * @param {string} hash2 
 * @returns {number} 0 ~ 256
 */
export function calculateHammingDistance(hash1, hash2) {
  if (!hash1 || !hash2) return 256;
  const len = Math.min(hash1.length, hash2.length);
  let distance = 0;

  for (let i = 0; i < len; i++) {
    const val1 = parseInt(hash1[i], 16);
    const val2 = parseInt(hash2[i], 16);
    let xor = val1 ^ val2;
    // 비트 1의 개수 세기
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  // 길이 차이가 있다면 패널티 추가
  distance += Math.abs(hash1.length - hash2.length) * 4;
  return distance;
}

/**
 * 두 해시 간의 유사도 백분율(0.0 ~ 100.0%) 계산
 * @param {string} hash1 
 * @param {string} hash2 
 * @returns {number} 유사도 퍼센트 (예: 92.5)
 */
export function calculateSimilarity(hash1, hash2) {
  const totalBits = HASH_SIZE * HASH_SIZE; // 256
  const distance = calculateHammingDistance(hash1, hash2);
  const similarity = Math.max(0, (1 - distance / totalBits) * 100);
  return Math.round(similarity * 10) / 10;
}

/**
 * 등록하려는 새 악보 해시와 기존 곡 목록을 비교하여 동일 곡 판정
 * @param {string} newHash 신규 악보 해시
 * @param {Array<{ id: string, title: string, pHash: string }>} existingSongs 기존 곡 목록
 * @param {number} threshold 동일 곡 판별 임계치 (기본 85%)
 * @returns {{ isMatch: boolean, matchedSong: Object|null, similarity: number }}
 */
export function findMatchingSong(newHash, existingSongs = [], threshold = 85) {
  if (!newHash || !Array.isArray(existingSongs) || existingSongs.length === 0) {
    return { isMatch: false, matchedSong: null, similarity: 0 };
  }

  let bestMatch = null;
  let maxSimilarity = 0;

  for (const song of existingSongs) {
    if (!song.pHash) continue;
    const sim = calculateSimilarity(newHash, song.pHash);
    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      bestMatch = song;
    }
  }

  return {
    isMatch: maxSimilarity >= threshold,
    matchedSong: maxSimilarity >= threshold ? bestMatch : null,
    similarity: maxSimilarity
  };
}
