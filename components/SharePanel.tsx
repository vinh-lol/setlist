"use client";

import { useState } from "react";
import QRCode from "react-qr-code";

interface Props {
  url: string;
  onClose: () => void;
}

export default function SharePanel({ url, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/70 z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 flex flex-col gap-4 w-80 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-sm tracking-widest uppercase">Share Setlist</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="bg-white p-3 rounded-xl flex items-center justify-center">
          <QRCode value={url} size={220} />
        </div>

        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 bg-zinc-800 text-zinc-400 text-xs px-3 py-2 rounded-lg border border-zinc-700 truncate"
            onFocus={e => e.target.select()}
          />
          <button
            onClick={copyLink}
            className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors whitespace-nowrap min-w-[60px]"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <p className="text-zinc-600 text-xs text-center">
          Anyone with this link can view the setlist
        </p>
      </div>
    </div>
  );
}
