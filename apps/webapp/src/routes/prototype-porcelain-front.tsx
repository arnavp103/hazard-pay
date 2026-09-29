import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

export const Route = createFileRoute("/prototype-porcelain-front")({
  component: PorcelainFront,
});

const chapters = [
  { time: 0, title: "Procession", detail: "Ivory ranks cross the snow." },
  { time: 8, title: "Ceramic rain", detail: "Rear mortars open a staggered barrage." },
  { time: 17, title: "Countercharge", detail: "Furnace claws meet the shield line." },
  { time: 24, title: "The conductor", detail: "A crown relay tears through the canal." },
  { time: 30, title: "Aftermath", detail: "Survivors reform among broken porcelain." },
] as const;

function PorcelainFront() {
  const film = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const active = chapterIndex;

  function seekChapter(index: number) {
    const wasPlaying = film.current ? !film.current.paused : false;
    setChapterIndex(index);
    setTime(chapters[index]?.time ?? 0);
    if (film.current) {
      film.current.src = `/porcelain-front/chapter-${index + 1}.webm`;
      film.current.load();
      if (wasPlaying) { void film.current.play().catch(() => undefined); }
    }
  }

  return (
    <main className="min-h-screen bg-shell px-5 py-8 text-ink sm:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="mb-3 font-data text-xs tracking-widest text-ink-dim uppercase">Hazard Pay / art study 04</p>
            <h1 className="font-display text-5xl font-extrabold tracking-tight sm:text-7xl">Porcelain Front</h1>
            <p className="mt-3 max-w-xl text-sm text-ink-dim">A miniature siege in fired ivory, cobalt enamel and brass. Forty-nine mechanical figures. One fractured canal.</p>
          </div>
          <Link to="/" className="font-data text-xs text-accent underline underline-offset-4">Back to overworld</Link>
        </header>

        <figure className="overflow-hidden border border-line bg-panel">
          <video
            ref={film}
            className="aspect-video w-full"
            controls
            playsInline
            preload="metadata"
            poster="/porcelain-front/poster.webp"
            onTimeUpdate={() => setTime((chapters[chapterIndex]?.time ?? 0) + (film.current?.currentTime ?? 0))}
            onEnded={() => {
              if (chapterIndex < chapters.length - 1) {
                seekChapter(chapterIndex + 1);
                void film.current?.play().catch(() => undefined);
              }
            }}
            onError={() => setUnavailable(true)}
            onLoadedData={() => setUnavailable(false)}
            aria-label="Porcelain Front: the complete 36-second Blender siege"
          >
            <source src="/porcelain-front/chapter-1.webm" type="video/webm" />
            Your browser cannot play this film. Download the WebM chapters below.
          </video>
          <figcaption className="flex flex-wrap justify-between gap-3 border-t border-line px-5 py-4 font-data text-xs text-ink-dim">
            <span>36 seconds · 49 figures · original Blender scene</span>
            <span>
              {time.toFixed(1)}
              {" "}
              / 36 s · 12 distinct frames/second
            </span>
          </figcaption>
        </figure>
        {unavailable && (
          <p role="status" className="mt-3 border border-line bg-panel p-4 text-sm text-ink-dim">
            The film is not available in this checkout. Rebuild it with the scene source and rendering instructions below.
          </p>
        )}

        <button
          type="button"
          className="mt-4 border border-accent bg-panel px-4 py-2 font-data text-sm text-accent hover:bg-panel-2"
          onClick={() => {
            seekChapter(0);
            void film.current?.play().catch(() => undefined);
          }}
        >
          Replay full battle
        </button>

        <nav aria-label="Film chapters" className="mt-5 grid gap-2 sm:grid-cols-5">
          {chapters.map((chapter, index) => (
            <button
              key={chapter.title}
              type="button"
              aria-current={active === index ? "step" : undefined}
              className={`border p-4 text-left transition-colors hover:bg-panel-2 ${active === index ? "border-accent bg-panel-2" : "border-line bg-panel"}`}
              onClick={() => seekChapter(index)}
            >
              <span className="font-data text-xs text-accent">
                0:
                {String(chapter.time).padStart(2, "0")}
              </span>
              <span className="mt-2 block font-display text-lg font-bold">{chapter.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-dim">{chapter.detail}</span>
            </button>
          ))}
        </nav>

        <section className="mt-10 grid gap-8 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-bold">An editable miniature battle</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-dim">Every shell, articulated leg, lance and mortar is authored geometry. Hierarchy rigs animate the march, recoil, claw strikes, crown pulse and persistent casualties. The camera follows the same uninterrupted encounter.</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-dim">This lane studies Blender art and authored animation through a prerendered film. Five compact chapters play in order. The scene authoring script builds an editable .blend; the complete quality master accompanies the review. It does not run a 3D simulation in your browser.</p>
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Open the work</h2>
            <div className="mt-3 flex flex-col items-start gap-3 font-data text-sm text-accent">

              <a href="/porcelain-front/build_scene.py" download className="underline underline-offset-4">Original scene authoring script</a>
              {chapters.map((chapter, index) => (
                <a key={chapter.title} href={`/porcelain-front/chapter-${index + 1}.webm`} download className="underline underline-offset-4">
                  {chapter.title}
                  {" "}
                  — WebM chapter
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
