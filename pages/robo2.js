import Head from "next/head";
import HeadMotionStage from "@/components/HeadMotionStage";

export default function Robo2() {
  return (
    <>
      <Head>
        <title>Resonance</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preload" href="/fonts/WantedSansVariable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </Head>
      <HeadMotionStage />
    </>
  );
}
