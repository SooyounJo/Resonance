// /move 를 인트로 시작부터 루프 한 바퀴 끝까지 1080x1350 mp4 로 렌더링 (dev 서버 실행 중이어야 함)
import puppeteer from "puppeteer-core";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUDIO, VOICE, PLAYBACK_RATE } from "../lib/headMotion/config.js";

const URL = process.env.URL || "http://localhost:3000/move?render";
const CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const FPS = 30, W = 1080, H = 1350, SR = 48000;
const NAME = "resonance-move.mp4";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "export");
fs.mkdirSync(outDir, { recursive: true });
const videoTmp = path.join(outDir, "move-video.tmp.mp4");
const audioTmp = path.join(outDir, "move-audio.tmp.f32");
const out = path.join(outDir, NAME);

/* ───── 화면 ───── */
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--ignore-gpu-blocklist", "--enable-gpu", "--hide-scrollbars"],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle0", timeout: 120000 });
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
await page.waitForFunction("window.__renderReady === true && document.fonts.status === 'loaded'", { timeout: 120000 });
const { loopStart, end } = await page.evaluate(() => window.__renderInfo());
const frames = Math.round(end * FPS);
console.log(`loopStart ${loopStart.toFixed(3)}s, end ${end.toFixed(3)}s, ${frames} frames`);

// SHOTS=1,10,30 → 해당 시각 장면만 png 로 저장하고 종료 (확인용)
if (process.env.SHOTS) {
  for (const T of process.env.SHOTS.split(",").map(Number)) {
    await page.evaluate((t) => window.__renderAt(t), T);
    await page.screenshot({ path: path.join(outDir, `shot-${T}.png`) });
  }
  await browser.close();
  process.exit(0);
}

const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", videoTmp], {
  stdio: ["pipe", "ignore", "inherit"],
});
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate((T) => window.__renderAt(T), i / FPS);
  const png = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 90 === 0) console.log(`frame ${i}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();

/* ───── 소리: 사이트와 같은 규칙으로 bgm·jazz·음성 합성 ───── */
const pub = (src) => path.join(root, "public", src);
const decode = (file, af) => {
  const args = ["-v", "error", "-i", file, ...(af ? ["-af", af] : []), "-f", "f32le", "-ac", "2", "-ar", String(SR), "-"];
  const b = execFileSync("ffmpeg", args, { maxBuffer: 1 << 30 });
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
};
const bgm = decode(pub(AUDIO.bgm));
const jazz = decode(pub(AUDIO.jazz));
const voices = VOICE.cues.map(([cue, src]) => {
  const buf = decode(pub(src), `atempo=${VOICE.rate}`);
  return { buf, at: Math.round((loopStart + Math.max(cue - VOICE.lead, 0.01) / PLAYBACK_RATE) * SR) };
});
const N = Math.round(end * SR);
const mix = new Float32Array(N * 2);
const L = loopStart * SR, J = (loopStart + (AUDIO.jazzFrom - AUDIO.lead) / PLAYBACK_RATE) * SR;
let duck = 1;
for (let n = 0; n < N; n++) {
  const talking = voices.some((v) => n >= v.at && n < v.at + v.buf.length / 2);
  duck = talking ? Math.max(duck - 1 / (VOICE.duckFade * SR), VOICE.duck) : Math.min(duck + 1 / (VOICE.duckFade * SR), 1);
  const master = n < L ? 0 : Math.min((n - L) / (AUDIO.startFade * SR), 1);
  const m = n < J ? 0 : Math.min((n - J) / (AUDIO.fadeIn * SR), 1);
  const s = (1 - Math.cos(m * Math.PI)) / 2;
  const bi = Math.floor(n - L), ji = Math.floor(n - J);
  for (let c = 0; c < 2; c++) {
    let x = 0;
    if (bi >= 0 && bi * 2 + c < bgm.length) x += bgm[bi * 2 + c] * AUDIO.volume * master * (1 - s) * duck;
    if (ji >= 0 && ji * 2 + c < jazz.length) x += jazz[ji * 2 + c] * AUDIO.volume * s * duck;
    for (const v of voices) {
      const k = (n - v.at) * 2 + c;
      if (k >= 0 && k < v.buf.length) x += v.buf[k] * VOICE.volume;
    }
    mix[n * 2 + c] = x;
  }
}
let peak = 0;
for (const x of mix) peak = Math.max(peak, Math.abs(x));
if (peak > 0.99) for (let i = 0; i < mix.length; i++) mix[i] *= 0.99 / peak;
console.log(`audio peak ${peak.toFixed(3)}`);
fs.writeFileSync(audioTmp, Buffer.from(mix.buffer));

execFileSync("ffmpeg", ["-y", "-v", "error", "-i", videoTmp, "-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", audioTmp, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest", out]);
fs.rmSync(videoTmp);
fs.rmSync(audioTmp);
const desk = path.join(os.homedir(), "Desktop", NAME);
fs.copyFileSync(out, desk);
console.log(`done: ${out}\n      ${desk}`);
