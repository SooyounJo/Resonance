// /robo2 화면을 서버 없이 열리는 HTML 파일 하나로 내보냄 (영상·사진·폰트·음악·음성 모두 포함)
// 사용: yarn export:html  →  export/resonance-robo2-main.html (바탕화면에도 복사)
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NAME = "resonance-robo2-main.html";
const pub = (p) => path.join(root, "public", p);
const MIME = { ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2" };

const entry = `
import "@/styles/globals.css";
import { createRoot } from "react-dom/client";
import HeadMotionStage from "@/components/HeadMotionStage";
document.title = "Resonance";
createRoot(document.getElementById("__next")).render(<HeadMotionStage />);
`;

const result = await build({
  stdin: { contents: entry, loader: "jsx", resolveDir: root },
  bundle: true,
  minify: true,
  write: false,
  outdir: "out",
  format: "iife",
  jsx: "automatic",
  loader: { ".js": "jsx" },
  alias: { "@": root },
  external: ["/fonts/*", "/media/*"],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
let js = result.outputFiles.find((f) => f.path.endsWith(".js")).text;
let css = result.outputFiles.find((f) => f.path.endsWith(".css")).text;

// 폰트는 CSS 에 data URI 로
const font = "/fonts/WantedSansVariable.woff2";
css = css.split(font).join(`data:font/woff2;base64,${fs.readFileSync(pub(font)).toString("base64")}`);

// 미디어는 base64 로 넣고, 열릴 때 blob URL 로 바꿔 코드 속 경로 문자열을 대체 (webm 은 mp4 로 통일)
const assets = {};
js = js.replace(/"(\/media\/[^"]+)"/g, (_, p) => {
  const file = p.replace(/\.webm$/, ".mp4");
  if (!assets[file]) assets[file] = [MIME[path.extname(file)], fs.readFileSync(pub(file)).toString("base64")];
  return `__A[${JSON.stringify(file)}]`;
});

const loader = `
var __A = {}, __D = ${JSON.stringify(assets)};
for (var k in __D) {
  var b = atob(__D[k][1]), u = new Uint8Array(b.length);
  for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  __A[k] = URL.createObjectURL(new Blob([u], { type: __D[k][0] }));
}
__D = null;
`;

const safe = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1");
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resonance</title>
<style>${safe(css)}</style>
</head>
<body>
<div id="__next"></div>
<script>${safe(loader)}</script>
<script>${safe(js)}</script>
</body>
</html>
`;

const outDir = path.join(root, "export");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, NAME);
fs.writeFileSync(out, html);
const desk = path.join(os.homedir(), "Desktop", NAME);
fs.copyFileSync(out, desk);
console.log(`${out}\n${desk}\n${(html.length / 1024 / 1024).toFixed(1)}MB, media ${Object.keys(assets).length}`);
