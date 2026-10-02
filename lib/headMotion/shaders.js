import { HEAD, IMG_W, IMG_H } from "./config";

export const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

export const FS = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uC[2];
uniform float uR[2];
uniform mat3 uM[2];      // local -> view (rotation)
uniform mat3 uMi[2];     // view -> local
uniform vec3 uT[2];      // local -> view translation
uniform sampler2D uTex0, uTex1;   // 화면 영상
uniform vec2 uTexel;              // 화면 영상 1픽셀 크기 (uv)
uniform float uSharpen;           // 화면 영상 샤프닝 세기
uniform sampler2D uRing;
uniform vec3 uDome[2];   // 받침 돔 (img px): x, y, r
uniform vec2 uFade;          // 사진에서 추출한 바디 명암 (row 0: 좌, row 1: 우)
uniform sampler2D uPlate;    // 배경 사진

const float D = ${HEAD.depth.toFixed(3)};      // 뒤쪽 돔 깊이 (반지름 대비)
const float BEZEL_R = 0.977;
const float SCREEN_R = 0.8534;

vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }

vec3 tap(int i, vec2 uv){ return i == 0 ? texture2D(uTex0, uv).rgb : texture2D(uTex1, uv).rgb; }

/* 화면 영상: 압축으로 뭉개진 윤곽을 살리는 언샤프 마스크 */
vec3 screenColor(int i, vec2 uv){
  vec3 c = tap(i, uv);
  vec3 blur = (tap(i, uv + vec2(uTexel.x, 0.)) + tap(i, uv - vec2(uTexel.x, 0.))
             + tap(i, uv + vec2(0., uTexel.y)) + tap(i, uv - vec2(0., uTexel.y))) * 0.25;
  return clamp(c + uSharpen * (c - blur), 0., 1.);
}

/* 사진의 받침 명암을 그대로 쓰는 재질 (view-space normal → color) */
vec3 body(vec3 n, float row, float vy){
  float phi = atan(n.x, max(n.z, 0.0));
  float u = clamp(phi / 3.14159265 + 0.5, 0.004, 0.996);
  vec3 ring = toLin(texture2D(uRing, vec2(u, row)).rgb);
  vec3 top = toLin(texture2D(uRing, vec2(0.30, row)).rgb) * 1.04;
  float ny = n.y;
  vec3 c = ny > 0. ? mix(ring, top, smoothstep(0.0, 1.0, ny) * 0.55)
                   : ring * (1.0 - 0.55 * ny * ny);
  // 받침과 맞닿는 아래쪽 약한 차폐
  c *= mix(0.78, 1.0, smoothstep(-1.05, -0.55, vy));
  return c;
}

/* 머리 하나를 레이캐스트: rgb, depth(view z), hit */
vec4 head(vec2 q, int i, out float depth){
  depth = -1e9;
  mat3 M = i == 0 ? uM[0] : uM[1];
  mat3 Mi = i == 0 ? uMi[0] : uMi[1];
  vec3 T = i == 0 ? uT[0] : uT[1];
  vec3 o = Mi * (vec3(q, 6.0) - T);
  vec3 d = Mi * vec3(0., 0., -1.);
  // 타원체 (z를 D로 스케일)
  vec3 os = vec3(o.xy, o.z / D), ds = vec3(d.xy, d.z / D);
  float a = dot(ds,ds), b = dot(os,ds), c = dot(os,os) - 1.0, h = b*b - a*c;
  if (h < 0.) return vec4(0.);
  h = sqrt(h);
  float t0 = (-b - h) / a, t1 = (-b + h) / a;
  // 반공간 z <= 0 (정면 평면)
  float tin = -1e9, tout = 1e9;
  if (d.z < -1e-6) tin = -o.z / d.z;
  else if (d.z > 1e-6) tout = -o.z / d.z;
  else if (o.z > 0.) return vec4(0.);
  float te = max(t0, tin), tx = min(t1, tout);
  if (te > tx) return vec4(0.);
  vec3 p = o + d * te;
  vec3 pv = M * p + T;
  depth = pv.z;
  float row = i == 0 ? 0.25 : 0.75;
  vec3 col;
  if (tin > t0) {                          // 정면
    vec3 nf = M * vec3(0., 0., 1.);
    float r = length(p.xy);
    float fz = clamp(nf.z, 0., 1.);
    float F = 0.04 + 0.96 * pow(1. - fz, 5.);
    float grad = clamp(0.5 - pv.x*0.35 + pv.y*0.45, 0., 1.);     // 좌상단 소프트박스 반사
    if (r < SCREEN_R) {
      vec2 uv = vec2(0.5 + p.x / (2.*SCREEN_R), 0.5 - p.y / (2.*SCREEN_R));
      vec3 vid = toLin(screenColor(i, uv));
      float edge = 1. - smoothstep(SCREEN_R - 0.008, SCREEN_R, r);
      col = mix(vec3(0.004), vid, edge) * (1. - F) + F * 0.75 + 0.012 * grad;
    } else if (r < BEZEL_R) {
      col = vec3(0.011, 0.0105, 0.010) + F * 0.30 + 0.020 * grad * grad;
    } else {                                // 둥근 림
      float k = smoothstep(BEZEL_R - 0.004, 1.0, r);
      vec3 nr = M * normalize(vec3(p.xy, 0.0));
      vec3 n = normalize(mix(nf, nr, k * 0.9));
      col = body(n, row, pv.y);
    }
  } else {                                  // 뒤쪽 돔
    vec3 nl = normalize(vec3(p.x, p.y, p.z / (D*D)));
    vec3 n = normalize(M * nl);
    col = body(n, row, pv.y);
    col *= mix(0.82, 1.0, smoothstep(0.0, 0.02, -p.z));  // 정면 모서리 바로 뒤 그늘
  }
  return vec4(col, 1.0);
}

vec4 dome(vec2 img, int i){
  vec3 dm = i == 0 ? uDome[0] : uDome[1];
  vec2 q = (img - dm.xy) / dm.z; q.y = -q.y;
  float rr = dot(q,q);
  if (rr > 1.0 || img.y > uFade.y) return vec4(0.);
  vec3 n = vec3(q, sqrt(1.0 - rr));
  // 바로 아래 사진 받침의 같은 x 위치 색을 이어받아 경계가 보이지 않게 함 (가로로 평균 내 세로 줄무늬 방지)
  vec3 c = vec3(0.);
  for (int k = -3; k <= 3; k++) {
    vec2 uv = vec2(img.x + float(k) * 4.0, uFade.y + 6.0) / vec2(${IMG_W.toFixed(1)}, ${IMG_H.toFixed(1)});
    c += toLin(texture2D(uPlate, uv).rgb);
  }
  c = c / 7.0 * (0.94 + 0.06 * n.y);
  float a = 1.0 - smoothstep(uFade.x, uFade.y, img.y);
  return vec4(c, a);
}

/* 머리 아래 접촉 그림자 (1 = 그림자 없음). q: 머리 반지름 단위 좌표, T: 머리 중심 */
float contact(vec2 q, vec3 T){
  vec2 d = q - T.xy;
  float len = max(length(d), 1e-4);
  float edge = len - 1.0;                                // 머리 윤곽에서의 거리
  float below = smoothstep(0.35, 0.8, -d.y / len);       // 아래쪽 방향만
  return 1.0 - 0.38 * below * (1.0 - smoothstep(0.0, 0.16, edge));
}

/* 받침 영역(돔 + 원통) 안인지 */
bool onStand(vec2 img, int i){
  vec3 dm = i == 0 ? uDome[0] : uDome[1];
  vec2 r = img - dm.xy;
  return abs(r.x) < dm.z && (r.y >= 0.0 || dot(r, r) < dm.z * dm.z);
}

void main(){
  float sx = ${IMG_W.toFixed(1)} / uRes.x;
  vec4 acc = vec4(0.);
  for (int s = 0; s < 4; s++) {
    vec2 off = s==0 ? vec2(-.125,-.375) : s==1 ? vec2(.375,-.125) : s==2 ? vec2(.125,.375) : vec2(-.375,.125);
    vec2 f = gl_FragCoord.xy + off;
    vec2 img = vec2(f.x * sx, (uRes.y - f.y) * sx);
    float dA, dB;
    vec2 qa = (img - uC[0]) / uR[0]; qa.y = -qa.y;
    vec2 qb = (img - uC[1]) / uR[1]; qb.y = -qb.y;
    vec4 A = dot(qa,qa) < 2.2 ? head(qa, 0, dA) : vec4(0.);
    vec4 B = dot(qb,qb) < 2.2 ? head(qb, 1, dB) : vec4(0.);
    if (A.a > 0. && B.a > 0.) { if (dA > dB) B = vec4(0.); else A = vec4(0.); }
    vec4 hc = A + B;
    if (hc.a > 0.) {
      acc += vec4(hc.rgb, 1.0);
      continue;
    }
    // 머리가 없는 곳: 돔 + 아래 사진 받침에 같은 접촉 그림자를 이어서 적용
    int si = onStand(img, 0) ? 0 : onStand(img, 1) ? 1 : -1;
    if (si < 0) continue;
    vec4 dc = dome(img, si);
    float sh = si == 0 ? contact(qa, uT[0]) : contact(qb, uT[1]);
    acc += vec4(dc.rgb * dc.a * sh, 1.0 - (1.0 - dc.a) * sh);
  }
  acc *= 0.25;
  vec3 c = acc.a > 0. ? acc.rgb / acc.a : vec3(0.);
  c = pow(clamp(c, 0., 1.), vec3(1./2.2));
  gl_FragColor = vec4(c * acc.a, acc.a);
}`;
