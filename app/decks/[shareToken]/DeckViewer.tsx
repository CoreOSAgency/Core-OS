"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BOX,
  BODY_FONT_SEQUENCE,
  PX_PER_IN,
  SLIDE_W_IN,
  SLIDE_H_IN,
  DECK_FONT_STACK,
  type DeckModel,
} from "@/lib/deckModel";

const SLIDE_W = Math.round(SLIDE_W_IN * PX_PER_IN); // 960
const SLIDE_H = Math.round(SLIDE_H_IN * PX_PER_IN); // 540
const inPx = (inches: number) => `${Math.round(inches * PX_PER_IN)}px`;

function rectStyle(r: { x: number; y: number; w: number; h: number }): React.CSSProperties {
  return {
    position: "absolute",
    left: inPx(r.x),
    top: inPx(r.y),
    width: inPx(r.w),
    height: inPx(r.h),
  };
}

// One rendered slide at native 960x540. `bodyRef` is handed back so the viewer
// can measure the real bullet height and step the font down to fit.
function Slide({
  model,
  index,
  bodyRef,
}: {
  model: DeckModel;
  index: number; // -1 = title slide
  bodyRef?: (el: HTMLUListElement | null) => void;
}) {
  const common: React.CSSProperties = {
    width: SLIDE_W,
    height: SLIDE_H,
    position: "relative",
    overflow: "hidden",
    background: `#${model.bg}`,
    fontFamily: DECK_FONT_STACK,
    color: `#${model.text}`,
    flex: "0 0 auto",
  };

  if (index < 0) {
    return (
      <div style={common}>
        {model.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={model.logo.dataUrl}
            alt=""
            style={{
              position: "absolute",
              left: inPx(BOX.logo.x),
              top: inPx(BOX.logo.y),
              height: inPx(model.logo.hIn),
              width: inPx(model.logo.wIn),
              objectFit: "contain",
            }}
          />
        )}
        <div
          style={{
            ...rectStyle(BOX.titleText),
            fontSize: BOX.titleText.pt,
            fontWeight: 700,
            lineHeight: 1.15,
          }}
        >
          {model.title}
        </div>
      </div>
    );
  }

  const slide = model.slides[index];
  return (
    <div style={common}>
      <div
        style={{
          ...rectStyle(BOX.heading),
          color: `#${model.accent}`,
          fontSize: BOX.heading.pt,
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        {slide.heading}
      </div>
      <ul
        ref={bodyRef}
        style={{
          position: "absolute",
          left: inPx(BOX.body.x),
          top: inPx(BOX.body.y),
          width: inPx(slide.bodyWidthIn),
          height: inPx(BOX.body.h),
          margin: 0,
          paddingLeft: 22,
          overflow: "hidden",
          fontSize: slide.bodyFontPt,
          lineHeight: 1.2,
          listStyle: "disc",
        }}
      >
        {slide.bullets.map((b, i) => (
          <li key={i} style={{ marginBottom: 10 }}>
            {b}
          </li>
        ))}
      </ul>
      {slide.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.image.dataUrl}
          alt=""
          style={{
            position: "absolute",
            left: inPx(BOX.image.x),
            top: inPx(BOX.image.y),
            width: inPx(BOX.image.w * slide.image.scale),
            height: inPx(BOX.image.h * slide.image.scale),
            objectFit: "contain",
          }}
        />
      )}
    </div>
  );
}

// Steps each bullet list's font down through the sequence until it genuinely
// fits its box - measured, not estimated. Runs on mount, slide change, resize.
function fitBodies(els: (HTMLUListElement | null)[]) {
  for (const el of els) {
    if (!el) continue;
    let chosen = BODY_FONT_SEQUENCE[0];
    for (const pt of BODY_FONT_SEQUENCE) {
      chosen = pt;
      el.style.fontSize = `${pt}px`;
      if (el.scrollHeight <= el.clientHeight) break;
    }
    el.style.fontSize = `${chosen}px`;
  }
}

export default function DeckViewer({
  model,
  shareToken,
  print,
}: {
  model: DeckModel;
  title: string;
  shareToken: string;
  print: boolean;
}) {
  const total = model.slides.length + 1; // + title slide
  const [current, setCurrent] = useState(0); // 0 = title
  const [scale, setScale] = useState(1);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const bodyEls = useRef<(HTMLUListElement | null)[]>([]);
  const touchX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => setCurrent((c) => Math.min(total - 1, Math.max(0, c + delta))),
    [total],
  );

  // Fit the stage: scale a native-size slide to the viewport.
  useEffect(() => {
    if (print) return;
    const recompute = () => {
      const el = stageRef.current;
      if (!el) return;
      const s = Math.min(el.clientWidth / SLIDE_W, el.clientHeight / SLIDE_H);
      setScale(s > 0 ? s : 1);
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [print]);

  // Auto-fit bullet text against real measured height.
  useEffect(() => {
    fitBodies(bodyEls.current);
  }, [current, scale, print]);

  useEffect(() => {
    const onResize = () => fitBodies(bodyEls.current);
    window.addEventListener("resize", onResize);
    // Signal to the PDF route that layout has settled.
    (window as unknown as { __deckReady?: boolean }).__deckReady = true;
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (print) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [print, go]);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  // --- Print mode: every slide stacked, no chrome, one slide per PDF page. ---
  if (print) {
    return (
      <div style={{ background: "#000" }}>
        <style>{`@page { size: ${SLIDE_W}px ${SLIDE_H}px; margin: 0; }
          html, body { margin: 0; padding: 0; background: #000; }
          .deck-print-slide { break-after: page; page-break-after: always; }
          .deck-print-slide:last-child { break-after: auto; page-break-after: auto; }`}</style>
        {Array.from({ length: total }, (_, i) => (
          <div className="deck-print-slide" key={i}>
            <Slide
              model={model}
              index={i - 1}
              bodyRef={
                i === 0 ? undefined : (el) => (bodyEls.current[i - 1] = el)
              }
            />
          </div>
        ))}
      </div>
    );
  }

  // --- Interactive viewer ---
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#0c0d0f",
      }}
    >
      <div
        ref={stageRef}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <div
          style={{
            width: SLIDE_W,
            height: SLIDE_H,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {/* Only the current slide is shown; keep the current body ref live for fitting. */}
          <Slide
            model={model}
            index={current - 1}
            bodyRef={
              current === 0
                ? undefined
                : (el) => (bodyEls.current[current - 1] = el)
            }
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          color: "#e5e5e5",
          fontFamily: DECK_FONT_STACK,
          fontSize: 13,
          userSelect: "none",
        }}
      >
        <button onClick={() => go(-1)} disabled={current === 0} style={navBtn}>
          ‹ Prev
        </button>
        <span style={{ minWidth: 60, textAlign: "center" }}>
          {current + 1} / {total}
        </span>
        <button
          onClick={() => go(1)}
          disabled={current === total - 1}
          style={navBtn}
        >
          Next ›
        </button>
        <button onClick={toggleFullscreen} style={navBtn} title="Present (F)">
          ⛶ Present
        </button>
        <a
          href={`/api/decks/${shareToken}/pdf`}
          download
          style={{ ...navBtn, textDecoration: "none" }}
          title="Download as PDF - works as a document post on LinkedIn"
        >
          ⬇ Download
        </a>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "inherit",
  borderRadius: 6,
  padding: "5px 12px",
  cursor: "pointer",
  fontSize: 13,
};
