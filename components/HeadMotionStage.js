import { useEffect, useRef } from "react";
import styles from "@/styles/HeadMotion.module.css";
import { RIGHT_DELAY, DUR, HEADS, DOME_FADE, SEGMENTS, TRACKS, MEDIA } from "@/lib/headMotion/config";
import { RING } from "@/lib/headMotion/ring";
import { sample, nod, drift, xform, mod } from "@/lib/headMotion/motion";
import { VS, FS } from "@/lib/headMotion/shaders";

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function makeTex(gl, unit) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([240, 200, 190, 255]));
  return t;
}

function makeVideo(name, canMp4) {
  const v = document.createElement("video");
  v.src = MEDIA[name][canMp4 ? "mp4" : "webm"];
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = "auto";
  v.setAttribute("playsinline", "");
  v.setAttribute("muted", "");
  return v;
}

export default function HeadMotionStage() {
  const canvasRef = useRef(null);
  const titleRef = useRef(null);
  const subRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });

    /* ═════════ WebGL ═════════ */
    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);

    gl.uniform2fv(U("uC[0]"), HEADS[0].c);
    gl.uniform2fv(U("uC[1]"), HEADS[1].c);
    gl.uniform1fv(U("uR[0]"), [HEADS[0].r, HEADS[1].r]);
    gl.uniform3fv(U("uDome[0]"), [...HEADS[0].dome, ...HEADS[1].dome]);
    gl.uniform2fv(U("uFade"), DOME_FADE);
    gl.uniform1i(U("uTex0"), 0);
    gl.uniform1i(U("uTex1"), 1);
    gl.uniform1i(U("uRing"), 2);

    const texs = [makeTex(gl, 0), makeTex(gl, 1)];
    // 명암 프로파일 텍스처
    const ringTex = makeTex(gl, 2);
    const n = RING.left.length, data = new Uint8Array(n * 2 * 4);
    ["left", "right"].forEach((k, row) =>
      RING[k].forEach((c, i) => data.set([c[0], c[1], c[2], 255], (row * n + i) * 4))
    );
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);

    const uRes = U("uRes");
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }

    /* ═════════ 비디오 ═════════ */
    const canMp4 = document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E"');
    const vids = [makeVideo("reasoning", canMp4), makeVideo("generative", canMp4)];
    const onEnded = (e) => {
      e.currentTarget.currentTime = 0;
      e.currentTarget.play().catch(() => {});
    };
    vids.forEach((v) => v.addEventListener("ended", onEnded));

    /* ═════════ 재생 ═════════ */
    let playing = false, forced = null, disposed = false;
    const timers = [];

    function start() {
      vids.forEach((v) => {
        v.pause();
        v.currentTime = 0;
      });
      vids[0].play().catch(() => {});
      timers.push(setTimeout(() => vids[1].play().catch(() => {}), RIGHT_DELAY * 1000));
      playing = true;
    }

    // 자동재생이 막힌 경우 첫 클릭 시 재생
    const onFirstPointer = () => {
      if (vids[0].paused) start();
    };
    const onVisibility = () => {
      if (!document.hidden && playing) vids.forEach((v) => v.paused && v.play().catch(() => {}));
    };
    addEventListener("pointerdown", onFirstPointer, { once: true });
    document.addEventListener("visibilitychange", onVisibility);

    Promise.all(
      vids.map((v) => (v.readyState >= 3 ? 0 : new Promise((r) => v.addEventListener("canplay", r, { once: true }))))
    ).then(() => !disposed && start());

    window.__setTime = (t) => {
      forced = t;
    }; // 테스트용: 움직임 시간만 고정

    /* ═════════ 루프 ═════════ */
    const uM = [U("uM[0]"), U("uM[1]")], uMi = [U("uMi[0]"), U("uMi[1]")], uT = [U("uT[0]"), U("uT[1]")];
    let raf;
    function frame() {
      resize();
      const t0 = forced ?? vids[0].currentTime;
      const ts = [t0, forced != null ? mod(forced - RIGHT_DELAY, DUR) : vids[1].currentTime];
      for (let i = 0; i < 2; i++) {
        const t = ts[i], tr = TRACKS[i];
        const [np_, ny_, gate] = nod(tr.nods, t);
        const [dy_, dp_] = drift(t, i);
        const yaw = (sample(tr.yaw, t) + ny_ + dy_ * gate) * (i === 0 ? 1 : -1);
        const pitch = sample(tr.pitch, t) + np_ + dp_ * gate;
        const [M, Mi, T] = xform(yaw, pitch);
        gl.uniformMatrix3fv(uM[i], false, M);
        gl.uniformMatrix3fv(uMi[i], false, Mi);
        gl.uniform3fv(uT[i], T);
        const v = vids[i];
        if (v.readyState >= 2 && !v.seeking) {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, texs[i]);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
        }
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const seg = [...SEGMENTS].reverse().find(([s]) => t0 >= s) || SEGMENTS[0];
      if (titleRef.current.textContent !== seg[1]) {
        titleRef.current.textContent = seg[1];
        subRef.current.textContent = seg[2];
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      removeEventListener("pointerdown", onFirstPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      delete window.__setTime;
      vids.forEach((v) => {
        v.removeEventListener("ended", onEnded);
        v.pause();
        v.removeAttribute("src");
        v.load();
      });
      [...texs, ringTex].forEach((t) => gl.deleteTexture(t));
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.stage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MEDIA.image} alt="" />
        <canvas ref={canvasRef} />
      </div>

      <p className={styles.caption} aria-live="polite">
        <span ref={titleRef}>{SEGMENTS[0][1]}</span>
        <small ref={subRef}>{SEGMENTS[0][2]}</small>
      </p>
    </div>
  );
}
