import { HEAD } from "./config";

/* ═════════ 보간 ═════════ */
const easeSine = (u) => 0.5 - 0.5 * Math.cos(Math.PI * u);
const easeOutBack = (u) => {
  const c1 = 0.7, c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
};

export function sample(tr, t) {
  if (t <= tr[0][0]) return tr[0][1];
  for (let i = 1; i < tr.length; i++) {
    const [t1, v1, mode] = tr[i], [t0, v0] = tr[i - 1];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * (mode === "o" ? easeOutBack(easeSine(u)) : easeSine(u));
    }
  }
  return tr[tr.length - 1][1];
}

/* 끄덕임: 상하 + 약간의 좌우가 위상차를 두고 함께 (시제품처럼) → [pitch, yaw] */
export function nod(nods, t) {
  let p = 0, y = 0, gate = 1;
  for (const [s, d, a, c, dir, ya] of nods) {
    if (t < s || t > s + d) continue;
    const u = (t - s) / d;
    const env = Math.pow(Math.sin(Math.PI * u), 0.6);
    p += a * dir * Math.sin(2 * Math.PI * c * u) * env;
    y += ya * Math.sin(2 * Math.PI * c * u + Math.PI / 2.5) * env;
    gate = Math.min(gate, 1 - 0.7 * env);
  }
  return [p, y, gate];
}

/* 정지 구간에도 살아있는 듯한 미세 흔들림 */
export function drift(t, k) {
  const ph = k * 2.1;
  return [
    1.6 * Math.sin((2 * Math.PI * t) / 7.3 + ph) + 0.8 * Math.sin((2 * Math.PI * t) / 3.1 + ph * 1.7), // yaw
    0.9 * Math.sin((2 * Math.PI * t) / 5.7 + ph * 0.6) + 0.4 * Math.sin((2 * Math.PI * t) / 2.3 + ph * 2.3), // pitch
  ];
}

/* 변환: 끄덕임(틸트 축) → 좌우 회전(팬 축).  반환: [M, Mi, T] (column-major) */
export function xform(yawDeg, pitchDeg) {
  const y = (yawDeg * Math.PI) / 180, x = (-pitchDeg * Math.PI) / 180;
  const cy = Math.cos(y), sy = Math.sin(y), cx = Math.cos(x), sx = Math.sin(x);
  const Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]];
  const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const mv = (A, v) => A.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]);
  const m = mul(Ry, Rx);
  const Pt = [0, HEAD.tiltPivot[0], HEAD.tiltPivot[1]], A = [0, 0, HEAD.panPivotZ];
  const T = add(sub(mv(Ry, sub(Pt, mv(Rx, Pt))), mv(Ry, A)), A);
  const M = new Float32Array([m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]]);
  const Mi = new Float32Array([m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]]);
  return [M, Mi, T];
}

export const mod = (a, n) => ((a % n) + n) % n;
