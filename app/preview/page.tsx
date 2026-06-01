export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div
        className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-zinc-700"
        style={{ aspectRatio: "9 / 16", height: "90vh", maxHeight: "900px", maxWidth: "calc(90vh * 9 / 16)" }}
      >
        <iframe
          src="/setlist"
          className="w-full h-full border-none"
          title="Mobile Preview"
        />
      </div>
    </div>
  );
}
