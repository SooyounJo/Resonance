import { useEffect, useRef } from "react";
import styles from "@/styles/DeviceScreens.module.css";

// 우측 영상 시작 지연 (초) — 값을 바꿔 딜레이 조절
const RIGHT_DELAY = 0.4;

const play = (v) => v.play().catch(() => {});

const ready = (v) =>
  v.readyState >= 3
    ? Promise.resolve()
    : new Promise((r) => v.addEventListener("canplay", r, { once: true }));

export default function DeviceScreens({
  imageSrc = "/media/devices.jpg",
  leftSrc = "/media/inference.mp4",
  rightSrc = "/media/generative.mp4",
}) {
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    const left = leftRef.current;
    const right = rightRef.current;
    const vids = [left, right];
    const timers = [];
    let cancelled = false;

    const delayed = (fn) => timers.push(setTimeout(fn, RIGHT_DELAY * 1000));

    // 무한 루프 보장: loop 속성 + 끝나면 처음부터 다시
    const onEnded = (e) => {
      e.currentTarget.currentTime = 0;
      play(e.currentTarget);
    };
    vids.forEach((v) => {
      v.loop = true;
      v.addEventListener("ended", onEnded);
    });

    Promise.all(vids.map(ready)).then(() => {
      if (cancelled) return;
      vids.forEach((v) => {
        v.pause();
        v.currentTime = 0;
      });
      play(left);
      delayed(() => play(right));
    });

    // 자동재생이 막힌 경우 클릭 시 같은 딜레이로 재생
    const onClick = () => {
      if (left.paused) play(left);
      if (right.paused) delayed(() => play(right));
    };
    document.addEventListener("click", onClick, { once: true });

    // 탭을 다시 볼 때 멈춰 있으면 재개
    const onVisibility = () => {
      if (!document.hidden) vids.forEach((v) => v.paused && play(v));
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      vids.forEach((v) => v.removeEventListener("ended", onEnded));
      document.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className={styles.stage}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc} alt="원형 디스플레이 기기 두 대" />
      <div className={`${styles.screen} ${styles.left}`}>
        <video
          ref={leftRef}
          src={leftSrc}
          autoPlay
          muted
          loop
          playsInline
          aria-label="추론형"
        />
      </div>
      <div className={`${styles.screen} ${styles.right}`}>
        <video
          ref={rightRef}
          src={rightSrc}
          autoPlay
          muted
          loop
          playsInline
          aria-label="생성형"
        />
      </div>
    </div>
  );
}
