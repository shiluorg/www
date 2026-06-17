import HashSearch from './hash-search.js';
import { t9n } from './i18n.js';

const W = 630;
const PAD = 18;
const MAP_W = 594, MAP_H = 360;
const MIN_H = 600, MAX_H = 2800;

let _modal = null, _canvas = null, _ctx = null;

function _ensureCanvas(H) {
  if (!_canvas || _canvas.height !== H) {
    _canvas = document.createElement('canvas');
    _canvas.width = W;
    _canvas.height = H;
    _ctx = _canvas.getContext('2d');
  }
}

function _drawRoundRect(x, y, w, h, r) {
  _ctx.beginPath();
  _ctx.moveTo(x + r, y);
  _ctx.lineTo(x + w - r, y);
  _ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  _ctx.lineTo(x + w, y + h - r);
  _ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  _ctx.lineTo(x + r, y + h);
  _ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  _ctx.lineTo(x, y + r);
  _ctx.quadraticCurveTo(x, y, x + r, y);
  _ctx.closePath();
}

function _wrapText(text, maxWidth, font) {
  _ctx.font = font;
  const words = text.split('');
  const lines = [];
  let line = '';
  for (const ch of words) {
    const test = line + ch;
    if (_ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function _fmtYear(y) {
  return HashSearch.formatYear(y);
}

function _drawTag(text, x, y, color, bgAlpha) {
  _ctx.font = '11px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';
  const tw = _ctx.measureText(text).width + 16;
  _drawRoundRect(x, y, tw, 24, 4);
  _ctx.fillStyle = `rgba(${color},${bgAlpha})`;
  _ctx.fill();
  _ctx.strokeStyle = `rgba(${color},0.35)`;
  _ctx.lineWidth = 1;
  _ctx.stroke();
  _ctx.fillStyle = `rgb(${color})`;
  _ctx.textAlign = 'center';
  _ctx.textBaseline = 'middle';
  _ctx.fillText(text, x + tw / 2, y + 12);
  _ctx.textAlign = 'left';
  _ctx.textBaseline = 'alphabetic';
  return tw;
}

function _drawMarker(ctx, x, y, size) {
  ctx.fillStyle = '#f0883e';
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d1117';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f0883e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 2, y + size * 0.85);
  ctx.lineTo(x, y + size * 2);
  ctx.lineTo(x + 2, y + size * 0.85);
  ctx.stroke();
}

function _loadMapImage(lat, lon) {
  return new Promise((resolve) => {
    const degPerPx = 360 / (256 * 32);
    const halfLon = (MAP_W / 2) * degPerPx;
    const halfLat = (MAP_H / 2) * degPerPx;

    const xmin = lon - halfLon;
    const ymin = lat - halfLat;
    const xmax = lon + halfLon;
    const ymax = lat + halfLat;

    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${xmin.toFixed(4)},${ymin.toFixed(4)},${xmax.toFixed(4)},${ymax.toFixed(4)}&bboxSR=4326&size=${MAP_W},${MAP_H}&format=png32&f=image`;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 4000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

function _calcHeight(evt, dict) {
  const hasLoc = evt.a != null && evt.l != null;
  const hasContinent = !!evt.o;
  const hasRegion = !!evt.r;
  const cat = evt.c || dict.fallbackCategory;
  const desc = evt.s || '';

  _ensureCanvas(MAX_H);
  const titleLines = _wrapText(evt.t, W - PAD * 2, 'bold 26px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif');
  const descLines = desc ? _wrapText(desc, W - PAD * 2, '17px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif') : [];

  let h = 20; // top padding
  h += 48; // year
  h += 30; // space after year

  // Tags (no location line)
  const tags = [];
  if (cat) tags.push(1);
  if (hasContinent) tags.push(1);
  if (hasRegion) tags.push(1);
  if (tags.length > 0) h += 26;

  // Divider
  h += 22;

  // Map
  if (hasLoc) {
    h += MAP_H;
    h += 24; // space after map
    h += 18; // divider after map
  }

  // Title
  const titleCount = Math.min(titleLines.length, 3);
  h += titleCount * 34;

  // Description
  if (desc) {
    h += 4;
    const descCount = Math.min(descLines.length, 16);
    h += descCount * 24;
  }

  // Bottom: dots + branding + accent
  h += 70;

  return Math.max(MIN_H, Math.min(MAX_H, Math.ceil(h)));
}

async function generate(evt) {
  const dict = t9n();
  const hasLoc = evt.a != null && evt.l != null;
  const regionStr = evt.r || '';
  const continentStr = evt.o || '';
  const cat = evt.c || dict.fallbackCategory;

  const H = _calcHeight(evt, dict);
  _ensureCanvas(H);
  const ctx = _ctx;

  // --- Background ---
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0d1117');
  bgGrad.addColorStop(0.4, '#111820');
  bgGrad.addColorStop(0.7, '#0e131b');
  bgGrad.addColorStop(1, '#0a0e14');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // --- Accent ---
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0, '#58a6ff');
  accentGrad.addColorStop(0.5, '#f0883e');
  accentGrad.addColorStop(1, '#58a6ff');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 3);

  // --- Grid ---
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  ctx.textAlign = 'center';

  // ===== Year =====
  ctx.fillStyle = '#f0883e';
  ctx.font = 'bold 48px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';
  ctx.fillText(_fmtYear(evt.y), W / 2, 58);

  let cy = 88;

  // ===== Tags (right after year, no location line) =====
  const tags = [];
  if (cat) tags.push({ text: cat, color: '88,166,255' });
  if (continentStr) tags.push({ text: continentStr, color: '63,185,80' });
  if (regionStr) tags.push({ text: regionStr, color: '240,136,62' });

  if (tags.length > 0) {
    const gap = 6;
    ctx.font = '11px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';
    let totalW = 0;
    const widths = tags.map(t => ctx.measureText(t.text).width + 16);
    totalW = widths.reduce((s, w) => s + w, 0) + gap * (tags.length - 1);
    let tx = (W - totalW) / 2;
    for (let i = 0; i < tags.length; i++) {
      _drawTag(tags[i].text, tx, cy - 12, tags[i].color, 0.15);
      tx += widths[i] + gap;
    }
    cy += 26;
  }

  // ===== Divider =====
  cy += 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, cy);
  ctx.lineTo(W - PAD, cy);
  ctx.stroke();
  cy += 18;

  // ===== Map =====
  const mapX = (W - MAP_W) / 2;
  const mapY = cy;
  let mapLoaded = false;

  if (hasLoc) {
    const mapImg = await _loadMapImage(Number(evt.a), Number(evt.l));
    if (mapImg) {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#000';
      ctx.fillRect(mapX, mapY, MAP_W, MAP_H);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(mapX, mapY, MAP_W, MAP_H);
      ctx.drawImage(mapImg, mapX, mapY, MAP_W, MAP_H);
      mapLoaded = true;

      _drawMarker(ctx, mapX + MAP_W / 2, mapY + MAP_H / 2 - 14, 14);

      if (regionStr) {
        ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';
        const lw = ctx.measureText(regionStr).width + 14;
        const lx = mapX + MAP_W / 2 + 20;
        const ly = mapY + MAP_H / 2 - 8;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        _drawRoundRect(lx, ly - 12, lw, 24, 4);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(regionStr, lx + 7, ly + 4);
        ctx.textAlign = 'center';
      }
    }
  }

  if (!mapLoaded && hasLoc) {
    ctx.fillStyle = '#161b22';
    ctx.fillRect(mapX, mapY, MAP_W, MAP_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX, mapY, MAP_W, MAP_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let gx = mapX; gx < mapX + MAP_W; gx += 35) {
      ctx.beginPath(); ctx.moveTo(gx, mapY); ctx.lineTo(gx, mapY + MAP_H); ctx.stroke();
    }
    for (let gy = mapY; gy < mapY + MAP_H; gy += 35) {
      ctx.beginPath(); ctx.moveTo(mapX, gy); ctx.lineTo(mapX + MAP_W, gy); ctx.stroke();
    }
    _drawMarker(ctx, mapX + MAP_W / 2, mapY + MAP_H / 2 - 14, 14);
  }

  cy = hasLoc ? mapY + MAP_H + 24 : cy;

  // ===== Divider =====
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, cy);
  ctx.lineTo(W - PAD, cy);
  ctx.stroke();
  cy += 18;

  // ===== Title =====
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';
  const titleLines = _wrapText(evt.t, W - PAD * 2, 'bold 26px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif');
  for (const line of titleLines.slice(0, 3)) {
    ctx.fillText(line, W / 2, cy);
    cy += 34;
  }

  // ===== Description =====
  const desc = evt.s || '';
  if (desc) {
    cy += 4;
    ctx.fillStyle = '#8b949e';
    ctx.font = '17px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';
    const descLines = _wrapText(desc, W - PAD * 2, '17px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif');
    for (const line of descLines.slice(0, 16)) {
      ctx.fillText(line, W / 2, cy);
      cy += 24;
    }
  }

  // ===== Bottom: decorative dots =====
  const dotY = H - 62;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 13; i++) {
    const dx = PAD + (i / 12) * (W - PAD * 2);
    ctx.beginPath(); ctx.arc(dx, dotY, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(88,166,255,0.4)';
  ctx.beginPath(); ctx.arc(PAD, dotY, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(240,136,62,0.4)';
  ctx.beginPath(); ctx.arc(W - PAD, dotY, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(88,166,255,0.5)';
  ctx.beginPath(); ctx.arc(W / 2, dotY, 4.5, 0, Math.PI * 2); ctx.fill();

  // ===== Branding =====
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '13px "PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';
  ctx.fillText(dict.htmlTitle, W / 2, H - 24);

  // ===== Bottom accent =====
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, H - 3, W, 3);

  return _canvas;
}

async function downloadPNG(evt) {
  const canvas = await generate(evt);
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (evt.t || 'event').replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 40);
    a.download = `shilu_${evt.y}_${safeName}.png`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

export async function showPreview(evt) {
  const dict = t9n();
  const canvas = await generate(evt);

  if (_modal) {
    _modal.remove();
    _modal = null;
  }

  _modal = document.createElement('div');
  _modal.className = 'share-card-modal';
  _modal.innerHTML = `
    <div class="share-card-backdrop"></div>
    <div class="share-card-dialog">
      <div class="share-card-header">
        <span>${dict.shareCardTitle}</span>
        <button class="share-card-close icon-btn">✕</button>
      </div>
      <div class="share-card-preview">
        <img src="${canvas.toDataURL('image/png')}" alt="Share Card" />
      </div>
      <div class="share-card-actions">
        <button class="share-card-btn share-card-download">${dict.shareCardDownload}</button>
        <button class="share-card-btn share-card-copy">${dict.shareCardCopy}</button>
      </div>
    </div>
  `;
  document.body.appendChild(_modal);

  const close = () => { _modal?.remove(); _modal = null; };
  _modal.querySelector('.share-card-close').addEventListener('click', close);
  _modal.querySelector('.share-card-backdrop').addEventListener('click', close);

  _modal.querySelector('.share-card-download').addEventListener('click', () => {
    downloadPNG(evt);
  });

  _modal.querySelector('.share-card-copy').addEventListener('click', async () => {
    canvas.toBlob(async blob => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        const btn = _modal.querySelector('.share-card-copy');
        btn.textContent = dict.shareCardCopied;
        setTimeout(() => {
          btn.textContent = dict.shareCardCopy;
        }, 2000);
      } catch (e) {
        downloadPNG(evt);
      }
    }, 'image/png');
  });
}