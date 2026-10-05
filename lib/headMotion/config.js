/* ═════════ 설정 ═════════ */
export const RIGHT_DELAY = 0.4; // 우측(생성형) 영상+움직임 지연(초)
export const DUR = 29;
export const PLAYBACK_RATE = 0.7; // 영상 재생 속도 (움직임은 영상 시간을 따라가므로 함께 느려짐)

/* 움직임 폭 배율 (키프레임·끄덕임 각도에 곱함, 미세 흔들림은 제외) */
export const MOTION_SCALE = { yaw: 1.4, pitch: 1.8 };

/* 화질 */
export const MAX_DPR = 3; // 캔버스 해상도 상한 (기기 픽셀 비율 기준)
export const SCREEN_SHARPEN = 0.6; // 화면 영상 샤프닝 세기 (0 = 끔)

/* 사진(2560×1600, 원본 1428 아래로 식탁 다리 공간 확장) 기준 머리 위치 — 픽셀 측정값 */
export const IMG_W = 2560;
export const IMG_H = 1600;
export const HEADS = [
  { c: [920, 567], r: 307, dome: [928.5, 905, 184] }, // 좌: 추론형 (베이지)   dome = 받침 윗면 [x, 중심y, 반지름]
  { c: [1640, 566], r: 307, dome: [1629.5, 905, 184] }, // 우: 생성형 (테라코타)
];
export const DOME_FADE = [884, 912]; // 이 높이(px)부터 사진 받침으로 자연스럽게 전환

/* 머리 형태 / 회전축 (머리 반지름 = 1 기준) */
export const HEAD = {
  depth: 0.95, // 정면에서 뒤로 돔 깊이 (레퍼런스: 거의 반구)
  panPivotZ: -0.3, // 좌우 회전축: 정면에서 뒤로 0.30
  tiltPivot: [-0.5, -0.4], // 끄덕임 축 (y, z)
};

/* 스토리보드 구간 [시작(초), 이름, 설명, 상단 캡슐 영문 라벨] */
export const SEGMENTS = [
  [0, "상황탐색", "서로 화면이 살짝 반대로", "Sensing"],
  [3, "분석", "중앙 정렬", "Analyzing"],
  [6, "AI 대화", "서로 마주봄", "Conversing"],
  [15, "생성 준비", "좌측은 안쪽, 우측은 정면", "Preparing"],
  [18, "정렬", "둘 다 정면", "Aligning"],
  [22, "결과 확인", "생성 결과물 확인", "Reviewing"],
  [25, "끄덕임", "추론형 ↑ · 생성형 ↓", "Sensing"],
];

/* 키프레임 [초, 각도(도), 이징]   이징: 's' 부드러운 가감속 · 'o' 부드럽게 + 아주 살짝 지나쳤다 정착
   yaw: + = 안쪽(상대 기기 쪽)   pitch: + = 위를 봄
   타이밍/텐션은 시제품 촬영 영상(생성형) 기준: 동작 0.9~2초, 정지 구간에도 미세하게 계속 움직임 */
export const TRACKS = [
  {
    // 좌: 추론형
    yaw: [[0, 0], [0.3, 0], [1.5, -18, "o"], [2.5, -18], [3.6, 0, "o"], [5.4, 0], [6.7, 20, "o"], [8.5, 20], [9.2, 24, "s"], [10.2, 24], [12.0, 20, "s"], [16.9, 20], [18.3, 0, "o"], [29, 0]],
    pitch: [[0, 0], [1.5, -3, "s"], [2.5, -3], [3.6, 0, "s"], [18.3, 0], [19.3, 2, "s"], [23.6, 2], [24.2, 0, "s"], [29, 0]],
    // 끄덕임 [시작, 길이, 상하 진폭, 횟수, 첫 방향(+1 위), 좌우 섞임 진폭]
    nods: [[7.2, 1.6, 3, 1.5, +1, 1], [12.2, 1.4, 3, 1, +1, 0.5], [24.2, 4.4, 9, 2.5, +1, 4]],
  },
  {
    // 우: 생성형
    yaw: [[0, 0], [0.3, 0], [1.3, -18, "o"], [2.4, -18], [3.4, 0, "o"], [5.6, 0], [6.8, 20, "o"], [7.8, 20], [8.4, 25, "s"], [9.3, 25], [11.3, 20, "s"], [14.8, 20], [16.6, 0, "s"], [29, 0]],
    pitch: [[0, 0], [1.3, -4, "s"], [2.4, -4], [3.4, 0, "s"], [14.8, 0], [16.6, -6, "s"], [18.3, -6], [19.3, 2, "o"], [22.6, 2], [23.6, 0, "s"], [29, 0]],
    nods: [[9.6, 1.6, 3, 1.5, +1, 1], [24.2, 4.4, 9, 2.5, -1, 4]],
  },
];

/* 첫 재생 인트로: 블러 영상이 페이드인 → 끝무렵 루프 영상이 블러가 걷히며 겹쳐 들어옴 (초) */
export const INTRO = {
  fadeIn: 0.8, // 인트로 영상 투명도 0 → 1
  overlap: 1.1, // 인트로 끝나기 이만큼 전에 루프 영상 재생 시작
  reveal: [0.3, 1.3], // 루프 영상 시간 기준 투명도 0 → 1 구간 (앞쪽 흰 화면 가림)
  unblur: [0.3, 1.8], // 루프 영상 시간 기준 블러가 걷히는 구간
  blur: 0.035, // 시작 블러 반경 (화면 uv)
  rightTint: { color: [255, 150, 60], amount: 0.75 }, // 우측 기기 인트로에만 얹는 주황빛 오버레이 (색, 세기 0~1)
};

/* 배경음: 기본은 bgm, 카드가 등장하는 정렬(Aligning) 구간부터 루프 끝 Sensing 까지는 jazz */
export const AUDIO = {
  // 원본 20초를 음정 유지한 채 0.75배로 늘리고, 끝 페이드아웃 전 본 연주(18초)를 두 번 이어 붙인 34초
  // — 정렬 시작(실제 18 / PLAYBACK_RATE 초, 0.7 기준 약 25.7초)까지 끊김 없이 나와야 하므로 속도를 더 낮추면 길이를 다시 맞춰야 함
  bgm: "/media/robo2-3d/bgm.mp3",
  jazz: "/media/robo2-3d/jazz.mp3",
  jazzFrom: 18, // 이 시각(초, 루프 기준)부터 루프 끝까지 jazz
  lead: 0, // jazz 를 정렬 시작보다 이만큼(루프 기준 초) 먼저 들이기 시작
  fadeIn: 0.4, // bgm → jazz 전환 (실제 초)
  fadeOut: 0.4, // 루프가 처음으로 돌아갈 때 jazz → bgm 전환 (실제 초)
  startFade: 1.5, // 첫 재생 시 bgm 페이드인 (실제 초)
  volume: 0.8,
};

/* 좌측(추론형) 화면에 문장이 나타날 때마다 순서대로 읽어주는 음성 [영상 기준 시각(초), 파일] */
export const VOICE = {
  cues: [
    [0.4, "/media/robo2-3d/voice/voice1.mp3"], // Reading the table's pace and mood
    [3.1, "/media/robo2-3d/voice/voice2.mp3"], // Conversation, Family, Dinner, Mood
    [6.4, "/media/robo2-3d/voice/voice3.mp3"], // The conversation picks up, mood bright
    [9.6, "/media/robo2-3d/voice/voice4.mp3"], // Wine detected · Château Margaux
    [13.0, "/media/robo2-3d/voice/voice5.mp3"], // I'll add more weight to the generation
    [16.4, "/media/robo2-3d/voice/voice6.mp3"], // I'll reflect Classic mood · Bordeaux vintage keywords
    [22.1, "/media/robo2-3d/voice/voice7.mp3"], // This one fits the mood right now
    [25.4, "/media/robo2-3d/voice/voice8.mp3"], // Talk's over, let's change the vibe
  ],
  volume: 1,
  rate: 1.3, // 음성 재생 속도 (음정 유지)
  lead: 0.5, // 모든 음성을 문장 등장보다 이만큼(영상 기준 초) 먼저 시작
  duck: 0.45, // 음성이 나오는 동안 배경음 볼륨 배율
  duckFade: 0.3, // 배경음 줄이고 되돌리는 시간 (실제 초)
};

export const MEDIA = {
  image: "/media/robo2-3d/device.jpg", // 받침 색 샘플용 (두 테마 모두 받침은 동일)
  themes: {
    main: "/media/robo2-3d/device.jpg", // 기본 회색 배경
    night: "/media/robo2-3d/device-dark.jpg", // HDRI(warm_restaurant_night) 배경 + 흰 원형 탁자
  },
  /* night 테마 조명: Poly Haven "Warm Restaurant Night" (CC0) 에서 구운 환경맵 (u=0.5 가 카메라 정면) */
  env: {
    spec: "/media/robo2-3d/env-spec.png", // 반사용 (유리·베젤)
    diff: "/media/robo2-3d/env-diff.png", // 조명용 irradiance (값 ×2)
  },
  intro: { mp4: "/media/robo2-3d/intro.mp4", webm: "/media/robo2-3d/intro.webm" },
  reasoning: { mp4: "/media/robo2-3d/reasoning.mp4", webm: "/media/robo2-3d/reasoning.webm" },
  generative: { mp4: "/media/robo2-3d/generative.mp4", webm: "/media/robo2-3d/generative.webm" },
};
