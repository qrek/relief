"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@/editor/components/Editor"), {
  ssr: false,
  loading: () => (
    <div className="grid h-screen w-screen place-items-center bg-neutral-950 text-sm text-neutral-500">
      Loading editor…
    </div>
  ),
});

export default function Page() {
  return <Editor />;
}
