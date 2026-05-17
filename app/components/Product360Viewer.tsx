"use client";

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

type DragState = {
  baseIndex: number;
  startX: number;
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

  useEffect(() => {
    frames.forEach((frameUrl) => {
      const image = new Image();
      image.src = frameUrl;
    });
  }, [frames]);

  if (!frames.length) return null;

  const activeFrame = frames[wrapIndex(frameIndex, frames.length)];
  const isInteractive = frames.length > 1;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isInteractive) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      baseIndex: frameIndex,
      startX: event.clientX,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || !isInteractive) return;

    const draggedFrames = Math.round((event.clientX - dragState.startX) / 18);
    setFrameIndex(wrapIndex(dragState.baseIndex + draggedFrames, frames.length));
  };

  const clearDragState = () => {
    setDragState(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setFrameIndex((current) => wrapIndex(current - 1, frames.length));
    }

    if (event.key === "ArrowRight") {
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
        "h-40 w-full select-none rounded-md border border-white/10 bg-zinc-950 bg-cover bg-center outline-none ring-amber-200 transition-shadow focus-visible:ring-2",
        isInteractive ? "cursor-grab active:cursor-grabbing" : "",
        className,
      ].join(" ")}
      style={{
        backgroundImage: `url("${activeFrame}")`,
        touchAction: isInteractive ? "pan-y" : "auto",
      }}
    />
  );
}
