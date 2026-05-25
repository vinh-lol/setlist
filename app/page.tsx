"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginButton from "@/components/LoginButton";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/setlist");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-zinc-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (status === "authenticated") return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-black tracking-tighter mb-3">SETLIST</h1>
        <p className="text-zinc-400 text-lg max-w-sm">
          Connect your Spotify and see exactly what&apos;s playing at your party — and when.
        </p>
      </div>
      <LoginButton />
    </div>
  );
}
