import Head from "next/head";
import DeviceScreens from "@/components/DeviceScreens";

export default function Robo2() {
  return (
    <>
      <Head>
        <title>추론형 · 생성형</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <DeviceScreens
        imageSrc="/media/robo2/device.jpg"
        leftSrc="/media/robo2/reasoning.mp4"
        rightSrc="/media/robo2/generative.mp4"
      />
    </>
  );
}
