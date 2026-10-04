import { useEffect, useRef, useState } from "react";
import styles from "@/styles/HeadMotion.module.css";
import {
  RIGHT_DELAY,
  DUR,
  HEADS,
  DOME_FADE,
  SEGMENTS,
  TRACKS,
  MEDIA,
  MAX_DPR,
  SCREEN_SHARPEN,
  MOTION_SCALE,
  INTRO,
  IMG_W,
  AUDIO,
  PLAYBACK_RATE,
} from "@/lib/headMotion/config";
import { RING } from "@/lib/headMotion/ring";
import { sample, nod, drift, xform, mod } from "@/lib/headMotion/motion";
import { VS, FS } from "@/lib/headMotion/shaders";

// 캡슐 줄 폭: 좌측 머리 바깥 끝 ~ 우측 머리 바깥 끝 (사진 폭 대비 비율)
const STEPS_W = (HEADS[1].c[0] + HEADS[1].r - (HEADS[0].c[0] - HEADS[0].r)) / IMG_W;

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

function makeVideo(name, canMp4, loop = true) {
  const v = document.createElement("video");
  v.src = MEDIA[name][canMp4 ? "mp4" : "webm"];
  v.muted = true;
  v.loop = loop;
  v.playsInline = true;
  v.preload = "auto";
  v.defaultPlaybackRate = v.playbackRate = PLAYBACK_RATE;
  v.setAttribute("playsinline", "");
  v.setAttribute("muted", "");
  return v;
}

export default function HeadMotionStage() {
  const canvasRef = useRef(null);
  const stepRefs = useRef([]);
  const notifyRefs = useRef([]);
  const [theme, setTheme] = useState("main");
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const saved = localStorage.getItem("resonance-theme");
    if (saved && MEDIA.themes[saved]) setTheme(saved);
  }, []);
  const chooseTheme = (t) => {
    setTheme(t);
    localStorage.setItem("resonance-theme", t);
  };

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
    gl.uniform1f(U("uSharpen"), SCREEN_SHARPEN);
    gl.uniform2f(U("uTexel"), 1 / 720, 1 / 720);
    gl.uniform1i(U("uIntro"), 4);
    gl.uniform4f(U("uIntroTint"), ...INTRO.rightTint.color.map((v) => v / 255), INTRO.rightTint.amount);

    const texs = [makeTex(gl, 0), makeTex(gl, 1)];
    const introTex = makeTex(gl, 4);
    // 명암 프로파일 텍스처
    const ringTex = makeTex(gl, 2);
    const n = RING.left.length, data = new Uint8Array(n * 2 * 4);
    ["left", "right"].forEach((k, row) =>
      RING[k].forEach((c, i) => data.set([c[0], c[1], c[2], 255], (row * n + i) * 4))
    );
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);

    // 이미지 텍스처: 받침 돔 색용 배경 사진 2장 + night 환경맵 2장
    const imgs = [];
    function imageTex(unit, uniform, src, repeatX) {
      const tex = makeTex(gl, unit);
      if (repeatX) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); // 환경맵 경도 이음새
      gl.uniform1i(U(uniform), unit);
      const img = new Image();
      img.onload = () => {
        if (disposed) return;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      };
      img.src = src;
      imgs.push(img);
      return tex;
    }
    const plateTex = imageTex(3, "uPlate", MEDIA.image);
    const plateNTex = imageTex(5, "uPlateN", MEDIA.themes.night);
    const envSpecTex = imageTex(6, "uEnvSpec", MEDIA.env.spec, true);
    const envDiffTex = imageTex(7, "uEnvDiff", MEDIA.env.diff, true);
    const uEnv = U("uEnv");
    let envMix = themeRef.current === "night" ? 1 : 0, lastT = performance.now();

    const uRes = U("uRes");
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
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
    vids[0].addEventListener(
      "loadedmetadata",
      () => !disposed && gl.uniform2f(U("uTexel"), 1 / vids[0].videoWidth, 1 / vids[0].videoHeight),
      { once: true }
    );
    const intro = makeVideo("intro", canMp4, false);
    // 루프 영상별 첫 바퀴 여부 (첫 바퀴에만 인트로에서 블러로 넘어옴)
    const firstPass = [true, true];
    const onEnded = (e) => {
      firstPass[vids.indexOf(e.currentTarget)] = false;
      e.currentTarget.currentTime = 0;
      e.currentTarget.play().catch(() => {});
    };
    vids.forEach((v) => v.addEventListener("ended", onEnded));

    /* ═════════ 재생 ═════════ */
    let playing = false, loopsStarted = false, introFailed = false, forced = null, disposed = false;
    const timers = [];

    /* ═════════ 배경음 ═════════ */
    const tracks = ["bgm", "jazz"].map((k) => {
      const a = new Audio(AUDIO[k]);
      a.preload = "auto";
      a.loop = false; // 두 곡 모두 끝에 자체 페이드아웃이 있어 반복 없이 루프마다 처음부터 한 번씩
      a.volume = 0;
      return a;
    });
    let audioMix = 0, jazzOn = false, prevT = 0, master = 0;
    // 소리 있는 재생은 자동재생 정책에 막힐 수 있어 사용자 입력 때마다 다시 시도
    function syncAudio() {
      tracks.forEach((a, i) => {
        const need = i === 0 ? loopsStarted && (!jazzOn || audioMix < 1) : jazzOn || audioMix > 0;
        const want = playing && !document.hidden && need;
        if (want && a.paused && !a.ended) a.play().catch(() => {});
        else if (!want && !a.paused) a.pause();
      });
    }
    const onUserInput = () => syncAudio();
    addEventListener("pointerdown", onUserInput);
    addEventListener("keydown", onUserInput);

    function startLoops() {
      if (loopsStarted) return;
      loopsStarted = true;
      vids[0].play().catch(() => {});
      syncAudio();
      timers.push(setTimeout(() => vids[1].play().catch(() => {}), (RIGHT_DELAY * 1000) / PLAYBACK_RATE));
    }

    function start() {
      timers.forEach(clearTimeout);
      timers.length = 0;
      loopsStarted = false;
      firstPass.fill(true);
      [intro, ...vids].forEach((v) => {
        v.pause();
        v.currentTime = 0;
      });
      if (introFailed) startLoops();
      else intro.play().catch(() => {});
      playing = true;
      tracks.forEach((a) => (a.currentTime = 0));
      jazzOn = false;
      audioMix = prevT = master = 0;
      syncAudio();
    }
    intro.addEventListener("ended", startLoops);
    intro.addEventListener("error", () => {
      if (disposed) return;
      introFailed = true;
      if (playing) startLoops();
    });

    // 자동재생이 막힌 경우 첫 클릭 시 재생
    const onFirstPointer = () => {
      if (intro.paused && vids[0].paused) start();
    };
    const onVisibility = () => {
      syncAudio();
      if (document.hidden || !playing) return;
      if (!loopsStarted) intro.paused && !intro.ended && intro.play().catch(() => {});
      else vids.forEach((v) => v.paused && v.play().catch(() => {}));
    };
    addEventListener("pointerdown", onFirstPointer, { once: true });
    document.addEventListener("visibilitychange", onVisibility);

    Promise.all(
      [intro, ...vids].map((v) =>
        v.readyState >= 3
          ? 0
          : new Promise((r) => {
              v.addEventListener("canplay", r, { once: true });
              if (v === intro) v.addEventListener("error", r, { once: true });
            })
      )
    ).then(() => !disposed && start());

    window.__setTime = (t) => {
      forced = t;
    }; // 테스트용: 움직임 시간만 고정

    /* ═════════ 루프 ═════════ */
    const uM = [U("uM[0]"), U("uM[1]")], uMi = [U("uMi[0]"), U("uMi[1]")], uT = [U("uT[0]"), U("uT[1]")];
    const uIntroA = U("uIntroA"), uLoopA = U("uLoopA"), uBlur = U("uBlur");
    const ramp = ([a, b], x) => {
      const k = Math.min(Math.max((x - a) / (b - a), 0), 1);
      return k * k * (3 - 2 * k);
    };
    /* ═════════ 상단 단계 캡슐 ═════════ */
    let curStep = -1, front = 0;
    function updateSteps(t) {
      let k = SEGMENTS.length - 1;
      while (k > 0 && t < SEGMENTS[k][0]) k--;
      stepRefs.current.forEach((el, j) => {
        if (!el) return;
        const end = j + 1 < SEGMENTS.length ? SEGMENTS[j + 1][0] : DUR;
        const p = j < k ? 1 : j > k ? 0 : Math.min(Math.max((t - SEGMENTS[j][0]) / (end - SEGMENTS[j][0]), 0), 1);
        el.style.setProperty("--p", p.toFixed(4));
      });
      if (k === curStep) return;
      stepRefs.current.forEach((el, j) => {
        if (!el) return;
        el.classList.toggle(styles.active, j === k);
        el.classList.toggle(styles.done, j < k);
      });
      // 알림: 이전 문구는 블러로 사라지고 새 문구가 블러에서 선명해짐
      const n = notifyRefs.current;
      if (n[0] && n[1]) {
        if (curStep >= 0) {
          n[front].className = styles.out;
          front ^= 1;
        }
        const el = n[front];
        el.textContent = SEGMENTS[k][3];
        el.className = "";
        void el.offsetWidth;
        el.className = styles.in;
      }
      curStep = k;
    }

    let raf;
    function frame() {
      resize();

      // 테마 조명 전환 (배경 사진 크로스페이드 0.8초와 같은 속도)
      const now = performance.now(), dt = Math.min((now - lastT) / 1000, 0.1);
      lastT = now;
      const envTarget = themeRef.current === "night" ? 1 : 0;
      envMix = envTarget > envMix ? Math.min(envMix + dt / 0.8, 1) : Math.max(envMix - dt / 0.8, 0);
      gl.uniform1f(uEnv, envMix);

      // 인트로 → 루프 전환
      if (playing && !loopsStarted && !introFailed && intro.duration && intro.currentTime >= intro.duration - INTRO.overlap) {
        startLoops();
      }
      const ia = introFailed ? 0 : ramp([0, INTRO.fadeIn], intro.currentTime);
      const la = [0, 0], br = [0, 0];
      for (let i = 0; i < 2; i++) {
        const ct = vids[i].currentTime;
        la[i] = firstPass[i] ? ramp(INTRO.reveal, ct) : 1;
        br[i] = firstPass[i] ? INTRO.blur * (1 - ramp(INTRO.unblur, ct)) : 0;
      }
      const showIntro = la[0] < 1 || la[1] < 1;
      gl.uniform2f(uIntroA, showIntro ? ia : 0, showIntro ? ia : 0);
      gl.uniform2f(uLoopA, la[0], la[1]);
      gl.uniform2f(uBlur, br[0], br[1]);
      if (showIntro && intro.readyState >= 2 && !intro.seeking) {
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, introTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, intro);
      }

      const t0 = forced ?? vids[0].currentTime;

      // 배경음: 정렬 시작에서 bgm → jazz 로 짧게 전환, 루프가 처음으로 돌아가면 bgm 도 처음부터
      if (playing) {
        if (t0 < prevT - 1) {
          tracks[0].currentTime = 0;
          syncAudio();
        }
        prevT = t0;
        const wantJazz = loopsStarted && t0 >= AUDIO.jazzFrom - AUDIO.lead;
        if (wantJazz !== jazzOn) {
          jazzOn = wantJazz;
          if (jazzOn) tracks[1].currentTime = 0;
          syncAudio();
        }
        const prevMix = audioMix;
        audioMix = jazzOn ? Math.min(audioMix + dt / AUDIO.fadeIn, 1) : Math.max(audioMix - dt / AUDIO.fadeOut, 0);
        if (loopsStarted) master = Math.min(master + dt / AUDIO.startFade, 1);
        // 레이즈드 코사인: 아주 작게 시작해 부드럽게 커지고 끝에서 완만히 정착
        const s = (1 - Math.cos(audioMix * Math.PI)) / 2;
        tracks[0].volume = AUDIO.volume * master * (1 - s);
        tracks[1].volume = AUDIO.volume * s;
        if (audioMix !== prevMix && (audioMix === 0 || audioMix === 1)) syncAudio();
      }

      const ts = [t0, forced != null ? mod(forced - RIGHT_DELAY, DUR) : vids[1].currentTime];
      for (let i = 0; i < 2; i++) {
        const t = ts[i], tr = TRACKS[i];
        const [np_, ny_, gate] = nod(tr.nods, t);
        const [dy_, dp_] = drift(t, i);
        const yaw = ((sample(tr.yaw, t) + ny_) * MOTION_SCALE.yaw + dy_ * gate) * (i === 0 ? 1 : -1);
        const pitch = (sample(tr.pitch, t) + np_) * MOTION_SCALE.pitch + dp_ * gate;
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

      updateSteps(t0);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      removeEventListener("pointerdown", onFirstPointer);
      removeEventListener("pointerdown", onUserInput);
      removeEventListener("keydown", onUserInput);
      tracks.forEach((a) => {
        a.pause();
        a.removeAttribute("src");
        a.load();
      });
      document.removeEventListener("visibilitychange", onVisibility);
      delete window.__setTime;
      vids.forEach((v) => v.removeEventListener("ended", onEnded));
      intro.removeEventListener("ended", startLoops);
      [intro, ...vids].forEach((v) => {
        v.pause();
        v.removeAttribute("src");
        v.load();
      });
      imgs.forEach((im) => (im.onload = null));
      [...texs, introTex, ringTex, plateTex, plateNTex, envSpecTex, envDiffTex].forEach((t) => gl.deleteTexture(t));
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div className={styles.page} data-theme={theme}>
      <div className={styles.stage}>
        {Object.entries(MEDIA.themes).map(([name, src]) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={name} src={src} alt="" className={styles.plate} data-on={theme === name} />
        ))}
        <canvas ref={canvasRef} />
      </div>

      <header className={styles.header} style={{ "--steps-w": STEPS_W }}>
        <h1 className={styles.title}>Resonance</h1>
        <ol className={styles.steps}>
          {SEGMENTS.map(([, , , en], i) => (
            <li key={i} ref={(el) => (stepRefs.current[i] = el)} className={styles.step}>
              <span>{en}</span>
              <div className={styles.fill} aria-hidden="true">
                <span>{en}</span>
              </div>
            </li>
          ))}
        </ol>
        <div className={styles.right}>
          <p className={styles.notify} aria-live="polite">
            <span ref={(el) => (notifyRefs.current[0] = el)} />
            <span ref={(el) => (notifyRefs.current[1] = el)} className={styles.out} />
          </p>
          <div className={styles.themes} role="group" aria-label="배경">
            {Object.keys(MEDIA.themes).map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={theme === name}
                onClick={() => chooseTheme(name)}
              >
                {name[0].toUpperCase() + name.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>
    </div>
  );
}
