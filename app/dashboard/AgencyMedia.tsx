// No media library exists yet — deliverables agents generate are downloaded
// or saved to Drive directly, not stored in CoreOS itself. Honest empty
// state rather than a fabricated asset grid.
export default function AgencyMedia() {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-core-card/50 p-10 text-center">
      <div className="mb-2 text-2xl">🖼️</div>
      <h3 className="font-medium text-neutral-200">Media library isn&apos;t built yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
        Right now, documents agents generate download straight to your device or save to
        Google Drive from the chat panel — there&apos;s nowhere they&apos;re stored inside
        CoreOS itself.
      </p>
    </div>
  );
}
