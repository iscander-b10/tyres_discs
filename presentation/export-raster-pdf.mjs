/**
 * Raster PDF: one screenshot per slide, no HTML layers.
 * Usage:
 *   node export-raster-pdf.mjs <out.pdf> <presentation-dir>
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { PDFDocument } from "pdf-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.PRESENTATION_ROOT || process.argv[3] || __dirname;
const OUT_PDF = process.argv[2] || path.join(os.homedir(), "Desktop", "SilverTyres.pdf");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const VIEW_W = 1920;
const VIEW_H = 1358;
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function waitForVisuals(page) {
  await page.evaluate(async () => {
    document.querySelectorAll("img").forEach((img) => {
      img.loading = "eager";
      img.decoding = "sync";
    });
    await Promise.all(
      [...document.images].map((img) => {
        if (img.complete && img.naturalWidth > 0) return null;
        return new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      }),
    );
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
}

const server = await startServer();
const port = server.address().port;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "silvert-tyres-slides-"));

try {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--disable-gpu", "--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: VIEW_W, height: VIEW_H, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle0", timeout: 120000 });
  await waitForVisuals(page);
  await page.addStyleTag({
    content: `
      .skip, .progress, .nav, .counter, #live { display: none !important; }
      html, body, .deck, .slide {
        width: ${VIEW_W}px !important;
        height: ${VIEW_H}px !important;
        max-height: ${VIEW_H}px !important;
      }
      .slide {
        padding-bottom: var(--pad-block) !important;
      }
      .slide--monitor {
        padding-bottom: clamp(1.1rem, 2.8vh, 1.75rem) !important;
      }
      .slide--cta {
        padding-top: var(--pad-block) !important;
        padding-bottom: var(--pad-block) !important;
      }
      .enter,
      .slide.is-entering .enter,
      .slide:not(.is-ready):not(.is-entering) .enter {
        opacity: 1 !important;
        transform: none !important;
        animation: none !important;
      }
    `,
  });
  await page.evaluate(() => {
    document.querySelectorAll(".slide").forEach((slide) => {
      slide.classList.add("is-ready");
      slide.classList.remove("is-entering");
    });
  });
  await waitForVisuals(page);
  await new Promise((r) => setTimeout(r, 800));

  const count = await page.$$eval(".slide", (els) => els.length);
  if (count !== 8) throw new Error(`Expected 8 slides, got ${count}`);

  const pngs = [];
  for (let i = 0; i < count; i += 1) {
    await page.evaluate((index) => {
      const deck = document.getElementById("deck");
      const slides = [...document.querySelectorAll(".slide")];
      slides.forEach((slide, n) => {
        slide.classList.toggle("is-active", n === index);
        slide.classList.add("is-ready");
      });
      deck.scrollTop = slides[index].offsetTop;
    }, i);
    await new Promise((r) => setTimeout(r, 250));
    const file = path.join(tmp, `slide-${String(i + 1).padStart(2, "0")}.png`);
    const handle = await page.$(`.slide:nth-of-type(${i + 1})`);
    if (!handle) throw new Error(`Missing slide ${i + 1}`);
    await handle.screenshot({ path: file, type: "png" });
    pngs.push(file);
    console.log(`captured ${path.basename(file)}`);
  }

  await browser.close();

  const pdf = await PDFDocument.create();
  pdf.setTitle("SilverTyres");
  pdf.setAuthor("SilverTyres");
  for (const file of pngs) {
    const image = await pdf.embedPng(fs.readFileSync(file));
    const pageDoc = pdf.addPage([PAGE_W, PAGE_H]);
    pageDoc.drawImage(image, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  }
  fs.writeFileSync(OUT_PDF, await pdf.save());
  const keepDir = process.env.KEEP_PNG_DIR;
  if (keepDir) {
    fs.mkdirSync(keepDir, { recursive: true });
    for (const file of pngs) {
      fs.copyFileSync(file, path.join(keepDir, path.basename(file)));
    }
    console.log(`kept pngs in ${keepDir}`);
  }
  console.log(`wrote ${OUT_PDF} (${fs.statSync(OUT_PDF).size} bytes)`);
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
