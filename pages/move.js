import Head from "next/head";
import HeadMotionStage from "@/components/HeadMotionStage";

export default function Move() {
  return (
    <>
      <Head>
        <title>Resonance</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <HeadMotionStage variant="move" />
    </>
  );
}
