import Head from "next/head";
import HeadMotionStage from "@/components/HeadMotionStage";

export default function Robo2() {
  return (
    <>
      <Head>
        <title>Device Head Motion</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <HeadMotionStage />
    </>
  );
}
