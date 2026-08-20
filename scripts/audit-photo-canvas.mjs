/**
 * Audit supplier product photos for transparent / baked-dark / light studio backgrounds.
 * Usage: node scripts/audit-photo-canvas.mjs
 * Uses cached raw feeds in %TEMP%/<supplier>_raw/ when present.
 *
 * Requires (dev-only, no commit): npm i --no-save pngjs jpeg-js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import esbuild from 'esbuild';
import { XMLParser } from 'fast-xml-parser';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMP = process.env.TEMP || process.env.TMP || '/tmp';

const SUPPLIER_ORIGINS = {
  Вершина: 'https://vershinatyres.ru',
  ШинаСу: 'https://shina.su',
  Форточки: 'https://api-b2b.pwrs.ru',
  Семисотнов: 'https://z34.ru',
  Шинсервис: 'https://duplo-s0.shinservice.ru',
};

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const cachePath = (supplier, name) => path.join(ensureDir(path.join(TEMP, `${supplier}_raw`)), name);

const ensureArray = (v) => {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseNodeValue: true,
  parseAttributeValue: true,
  trimValues: true,
  parseTrueNumberOnly: false,
  arrayMode: false,
});

async function bundleTransformer(supplierRel) {
  const entry = path.join(ROOT, 'src/services/suppliers', supplierRel, 'transformers.js');
  const outfile = path.join(TEMP, `audit_photo_xform_${supplierRel.replace(/[\\/]/g, '_')}.cjs`);
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    logLevel: 'error',
  });
  delete require.cache[outfile];
  return require(outfile);
}

function absolutePhotoUrl(rawUrl, supplierLabel) {
  const raw = String(rawUrl ?? '').trim();
  if (!raw || raw === 'undefined' || raw === 'null') return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  const origin = SUPPLIER_ORIGINS[supplierLabel];
  if (!origin) return raw;
  return raw.startsWith('/') ? `${origin}${raw}` : `${origin}/${raw}`;
}

function pickDiverse(items, n, kind) {
  const withPhoto = items.filter((it) => it.photoUrl);
  const byBrand = new Map();
  for (const it of withPhoto) {
    const brand = String(it.brand || '—').trim() || '—';
    if (!byBrand.has(brand)) byBrand.set(brand, []);
    byBrand.get(brand).push(it);
  }
  const brands = [...byBrand.keys()];
  const picked = [];
  const usedUrls = new Set();
  let bi = 0;
  let guard = 0;
  while (picked.length < n && brands.length && guard++ < 5000) {
    const brand = brands[bi % brands.length];
    const bucket = byBrand.get(brand);
    if (!bucket || !bucket.length) {
      brands.splice(bi % Math.max(brands.length, 1), 1);
      continue;
    }
    const idx = Math.floor((picked.length * 7 + bi * 3) % bucket.length);
    const it = bucket.splice(idx, 1)[0];
    const url = absolutePhotoUrl(it.photoUrl, it.supplier);
    if (url && !usedUrls.has(url)) {
      usedUrls.add(url);
      picked.push({ ...it, kind, absUrl: url });
    }
    bi++;
  }
  if (picked.length < n) {
    const step = Math.max(1, Math.floor(withPhoto.length / (n - picked.length + 1)));
    for (let i = 0; i < withPhoto.length && picked.length < n; i += step) {
      const it = withPhoto[i];
      const url = absolutePhotoUrl(it.photoUrl, it.supplier);
      if (url && !usedUrls.has(url)) {
        usedUrls.add(url);
        picked.push({ ...it, kind, absUrl: url });
      }
    }
  }
  return picked;
}

function sniffFormat(buf, contentType, url) {
  const ct = (contentType || '').split(';')[0].trim().toLowerCase();
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'webp';
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpeg';
  if (ct.includes('webp')) return 'webp';
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (ext === '.png') return 'png';
    if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
    if (ext === '.webp') return 'webp';
    return ct || ext || 'unknown';
  } catch {
    return ct || 'unknown';
  }
}

function readPngIhdr(buf) {
  if (buf.length < 33) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
    colorTypeName:
      { 0: 'gray', 2: 'RGB', 3: 'palette', 4: 'gray+A', 6: 'RGBA' }[buf[25]] || `ct${buf[25]}`,
  };
}

function classifyCorners(corners) {
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  let transparent = 0;
  let dark = 0;
  let light = 0;
  let mid = 0;
  for (const c of corners) {
    if (c.a != null && c.a < 16) transparent++;
    else if (lum(c) < 40) dark++;
    else if (lum(c) > 200) light++;
    else mid++;
  }
  const n = corners.length;
  if (transparent >= Math.ceil(n * 0.75)) return 'transparent-alpha';
  if (dark >= Math.ceil(n * 0.75)) return 'baked-dark';
  if (light >= Math.ceil(n * 0.75)) return 'light-studio';
  if (transparent > 0 && dark === 0) return 'partial-transparent';
  if (dark > 0 && light === 0) return 'mostly-dark';
  return `mixed(t${transparent}/d${dark}/l${light}/m${mid})`;
}

function sampleRgba(data, width, height, channels = 4) {
  const pts = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
  ];
  return pts.map(([x, y]) => {
    const i = (y * width + x) * channels;
    return {
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
      a: channels === 4 ? data[i + 3] : 255,
      x,
      y,
    };
  });
}

function decodePixels(buf, format) {
  if (format === 'png') {
    const png = PNG.sync.read(buf);
    const corners = sampleRgba(png.data, png.width, png.height, 4);
    return {
      width: png.width,
      height: png.height,
      corners,
      cornerClass: classifyCorners(corners),
    };
  }
  if (format === 'jpeg') {
    const decoded = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    const corners = sampleRgba(decoded.data, decoded.width, decoded.height, 4);
    // JPEG has no alpha — force a=255 already via formatAsRGBA
    return {
      width: decoded.width,
      height: decoded.height,
      corners,
      cornerClass: classifyCorners(corners),
    };
  }
  throw new Error(`unsupported format for pixel sample: ${format}`);
}

async function fetchImage(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'image/*,*/*',
      'User-Agent': 'Mozilla/5.0 (compatible; tyres_discs-photo-audit/1.0)',
      Referer: new URL(url).origin + '/',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType };
}

function loadSemisotnov() {
  const tyresBuf = fs.readFileSync(cachePath('semisotnov', 'tyres.xml'));
  const discsBuf = fs.readFileSync(cachePath('semisotnov', 'discs.xml'));
  const tyresRaw = xmlParser.parse(tyresBuf.toString('utf8'));
  const discsRaw = xmlParser.parse(discsBuf.toString('utf8'));
  const tArr = ensureArray(tyresRaw?.Выгрузка_Шины?.Шина);
  const dArr = ensureArray(discsRaw?.Выгрузка_Диски?.Диск);
  return {
    folder: 'semisotnov',
    label: 'Семисотнов',
    tyresRaw: { Выгрузка_Шины: { Шина: tArr } },
    discsRaw: { Выгрузка_Диски: { Диск: dArr } },
  };
}

function loadShinservice() {
  const tyresRaw = JSON.parse(fs.readFileSync(cachePath('shinservice', 'tyres.json'), 'utf8'));
  const discsRaw = JSON.parse(fs.readFileSync(cachePath('shinservice', 'discs.json'), 'utf8'));
  return { folder: 'shinservice', label: 'Шинсервис', tyresRaw, discsRaw };
}

function load4tochki() {
  const raw = JSON.parse(fs.readFileSync(cachePath('4tochki', 'catalog.json'), 'utf8'));
  return { folder: '4tochki', label: 'Форточки', tyresRaw: raw, discsRaw: raw };
}

function loadVershina() {
  const tyresBuf = fs.readFileSync(cachePath('Vershina', 'tyres.xml'));
  const discsBuf = fs.readFileSync(cachePath('Vershina', 'discs.xml'));
  const tyresRaw = xmlParser.parse(tyresBuf.toString('utf8'));
  const discsRaw = xmlParser.parse(discsBuf.toString('utf8'));
  const tArr = ensureArray(tyresRaw?.data?.tyres);
  const dArr = ensureArray(discsRaw?.data?.rims);
  return {
    folder: 'Vershina',
    label: 'Вершина',
    tyresRaw: { data: { tyres: tArr } },
    discsRaw: { data: { rims: dArr } },
  };
}

function verdictFromClasses(classes) {
  const counts = {};
  for (const c of classes) counts[c] = (counts[c] || 0) + 1;
  const transparent =
    (counts['transparent-alpha'] || 0) + (counts['partial-transparent'] || 0);
  const dark = (counts['baked-dark'] || 0) + (counts['mostly-dark'] || 0);
  const light = counts['light-studio'] || 0;
  const total = classes.length || 1;
  if (transparent / total >= 0.5) return { verdict: 'A', reason: 'transparent alpha dominant', counts };
  if (dark / total >= 0.5) return { verdict: 'B', reason: 'baked dark/black corners dominant', counts };
  if (light / total >= 0.5) return { verdict: 'C', reason: 'light studio corners dominant', counts };
  if (transparent > dark && transparent > light) return { verdict: 'A', reason: 'plurality transparent', counts };
  if (dark > light) return { verdict: 'B', reason: 'plurality dark', counts };
  if (light > 0) return { verdict: 'C', reason: 'plurality light / mixed', counts };
  return { verdict: '?', reason: 'inconclusive', counts };
}

async function auditSupplier(loader) {
  const loaded = loader();
  console.error(`[${loaded.label}] transform…`);
  const xform = await bundleTransformer(loaded.folder);
  const tyres = xform.transformTyres(loaded.tyresRaw);
  const discs = xform.transformDiscs(loaded.discsRaw);
  const sample = [...pickDiverse(tyres, 8, 'tyre'), ...pickDiverse(discs, 8, 'disc')];
  console.error(
    `[${loaded.label}] sample ${sample.length} urls (tyres=${tyres.length} discs=${discs.length} withPhoto=${tyres.filter((t) => t.photoUrl).length}+${discs.filter((d) => d.photoUrl).length})`
  );

  const results = [];
  for (const item of sample) {
    const row = {
      supplier: loaded.label,
      kind: item.kind,
      brand: item.brand,
      code: item.code,
      url: item.absUrl,
    };
    try {
      const { buf, contentType } = await fetchImage(item.absUrl);
      row.contentType = contentType;
      row.format = sniffFormat(buf, contentType, item.absUrl);
      row.bytes = buf.length;
      if (row.format === 'png') {
        const ihdr = readPngIhdr(buf);
        if (ihdr) {
          row.pngColorType = ihdr.colorTypeName;
          row.width = ihdr.width;
          row.height = ihdr.height;
        }
      }
      if (row.format === 'webp') {
        row.cornerClass = 'webp-undecoded';
        row.note = 'webp: format only; install sharp for pixels if needed';
        console.error(`  skip-webp ${item.kind} ${item.brand}`);
      } else {
        const pix = decodePixels(buf, row.format);
        row.width = pix.width;
        row.height = pix.height;
        row.corners = pix.corners;
        row.cornerClass = pix.cornerClass;
        console.error(
          `  ok ${item.kind} ${item.brand} ${row.format}/${row.pngColorType || '-'} ${row.cornerClass}`
        );
      }
    } catch (e) {
      row.error = String(e && e.message ? e.message : e);
      console.error(`  FAIL ${item.absUrl} → ${row.error}`);
    }
    results.push(row);
  }

  const ok = results.filter((r) => r.cornerClass && r.cornerClass !== 'webp-undecoded');
  const { verdict, reason, counts } = verdictFromClasses(ok.map((r) => r.cornerClass));
  const formats = {};
  const cornerClasses = {};
  for (const r of results.filter((x) => x.format)) {
    formats[r.format] = (formats[r.format] || 0) + 1;
  }
  for (const r of ok) {
    cornerClasses[r.cornerClass] = (cornerClasses[r.cornerClass] || 0) + 1;
  }
  return {
    supplier: loaded.label,
    folder: loaded.folder,
    sampleN: sample.length,
    okN: ok.length,
    failN: results.filter((r) => r.error).length,
    formats,
    cornerClasses,
    verdict,
    reason,
    classCounts: counts,
    evidenceUrls: ok.slice(0, 4).map((r) => ({
      url: r.url,
      format: r.format,
      pngColorType: r.pngColorType,
      cornerClass: r.cornerClass,
      corners: r.corners,
      brand: r.brand,
      kind: r.kind,
    })),
    results,
  };
}

async function main() {
  const reports = [];
  for (const loader of [loadSemisotnov, loadShinservice, load4tochki, loadVershina]) {
    try {
      reports.push(await auditSupplier(loader));
    } catch (e) {
      console.error(e);
      reports.push({ supplier: String(loader.name), error: String(e && e.stack ? e.stack : e) });
    }
  }

  const outPath = path.join(TEMP, 'photo_canvas_audit.json');
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2));
  const summary = reports.map((r) => ({
    supplier: r.supplier,
    verdict: r.verdict,
    reason: r.reason,
    formats: r.formats,
    cornerClasses: r.cornerClasses,
    evidence: (r.evidenceUrls || []).map(
      (e) => `${e.kind}/${e.brand}: ${e.format} ${e.pngColorType || ''} ${e.cornerClass} c0=${JSON.stringify(e.corners?.[0])}`
    ),
  }));
  console.log(JSON.stringify({ outPath, summary }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
