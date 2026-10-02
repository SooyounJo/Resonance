import Head from "next/head";
import DeviceScreens from "@/components/DeviceScreens";

export default function Home() {
  return (
    <>
      <Head>
        <title>추론형 · 생성형</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <DeviceScreens />
    </>
  );
}
