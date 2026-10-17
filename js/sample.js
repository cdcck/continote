/**
 * ContiNote - Demo / Sample Sheet Music Generator
 */

export function generateSampleSheetDataURL(title = '은혜로다 (Grace)') {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 1700;
  const ctx = c.getContext('2d');

  // 배경
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, c.width, c.height);

  // 제목
  ctx.fillStyle = '#1E1E1E';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 600, 140);

  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#666666';
  ctx.fillText('Words & Music by ContiNote Band', 600, 180);

  // 5선 악보 보표 시뮬레이션
  const lineStaffs = [260, 480, 700, 920, 1140, 1360];
  lineStaffs.forEach((startY, sIdx) => {
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2.5;
    for (let l = 0; l < 5; l++) {
      const y = startY + (l * 18);
      ctx.beginPath();
      ctx.moveTo(120, y);
      ctx.lineTo(1080, y);
      ctx.stroke();
    }

    // 높은음자리표 및 마디선
    ctx.font = '60px serif';
    ctx.fillStyle = '#222222';
    ctx.textAlign = 'left';
    ctx.fillText('𝄞', 125, startY + 54);

    // 마디선
    [360, 600, 840, 1080].forEach(bx => {
      ctx.beginPath();
      ctx.moveTo(bx, startY);
      ctx.lineTo(bx, startY + 72);
      ctx.stroke();
    });

    // 음표 스케치
    for (let nx = 220; nx < 1040; nx += 90) {
      const ny = startY + 18 + ((nx % 5) * 9);
      ctx.beginPath();
      ctx.arc(nx, ny, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#222';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(nx + 7, ny);
      ctx.lineTo(nx + 7, ny - 38);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 가사 스케치
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#444444';
    ctx.textAlign = 'center';
    ctx.fillText(`시작됐네 우리 주님의 놀라운 은혜의 날이 (${sIdx + 1})`, 600, startY + 115);
  });

  return c.toDataURL('image/png');
}
