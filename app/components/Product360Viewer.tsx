"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type DragState = {
  baseIndex: number;
  startX: number;
  startY: number;
};

type Product360ViewerProps = {
  alt: string;
  imageUrl?: string | null;
  frameUrls?: string[];
  className?: string;
};

const EMPTY_FRAME_URLS: string[] = [];

function wrapIndex(value: number, frameCount: number) {
  return ((value % frameCount) + frameCount) % frameCount;
}

export default function Product360Viewer({
  alt,
  imageUrl,
  frameUrls = EMPTY_FRAME_URLS,
  className = "",
}: Product360ViewerProps) {
  const frames = useMemo(() => {
    if (frameUrls.length > 1) return frameUrls;
    if (imageUrl) return [imageUrl];
    return frameUrls;
  }, [frameUrls, imageUrl]);

  const [frameIndex, setFrameIndex] = useState(0);
  const [dragState, setDragState] = useState<DragState | null>(null);

  if (!frames.length) return null;

  const activeFrame = frames[wrapIndex(frameIndex, frames.length)];
  const isInteractive = frames.length > 1;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isInteractive) return;

    setDragState({
      baseIndex: frameIndex,
      startX: event.clientX,
      startY: event.clientY,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || !isInteractive) return;

    const horizontalDelta = event.clientX - dragState.startX;
    const verticalDelta = dragState.startY - event.clientY;

    if (Math.abs(horizontalDelta) < 10) return;
    if (Math.abs(verticalDelta) > Math.abs(horizontalDelta)) return;

    const draggedFrames = Math.round(horizontalDelta / 18);

    setFrameIndex(wrapIndex(dragState.baseIndex + draggedFrames, frames.length));
  };

  const clearDragState = () => {
    setDragState(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      setFrameIndex((current) => wrapIndex(current - 1, frames.length));
    }

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      setFrameIndex((current) => wrapIndex(current + 1, frames.length));
    }
  };

  return (
    <div
      aria-label={alt}
      role="img"
      tabIndex={isInteractive ? 0 : -1}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearDragState}
      onPointerCancel={clearDragState}
      className={[
        "h-40 w-full select-none overflow-hidden rounded-md border border-white/10 bg-zinc-950 outline-none ring-amber-200 focus-visible:ring-2",
        isInteractive ? "cursor-grab active:cursor-grabbing" : "",
        className,
      ].join(" ")}
      style={{ touchAction: isInteractive ? "pan-y" : "auto" }}
    >
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={activeFrame}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
