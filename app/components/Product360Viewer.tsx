"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { FiRotateCcw, FiZoomIn, FiZoomOut } from "react-icons/fi";

type DragState = {
  baseFrameIndex: number;
  baseRowIndex: number;
  baseTiltX: number;
  baseTiltY: number;
  startX: number;
  startY: number;
};

type TiltState = {
  x: number;
  y: number;
};

type PointerPoint = {
  x: number;
  y: number;
};

type PinchState = {
  baseZoom: number;
  startDistance: number;
};

type Product360ViewerProps = {
  alt: string;
  imageUrl?: string | null;
  frameUrls?: string[];
  frameRows?: string[][];
  className?: string;
};

const EMPTY_FRAME_URLS: string[] = [];
const EMPTY_FRAME_ROWS: string[][] = [];
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const MIN_FRAME_DRAG_DISTANCE = 14;
const MAX_FRAME_DRAG_DISTANCE = 42;
const FRAME_DRAG_WIDTH_RATIO = 0.95;
const ROW_DRAG_DISTANCE = 46;
const MAX_TILT = 24;
const TILT_DRAG_DISTANCE = 7;
const TILT_KEY_STEP = 5;
const PRELOAD_ROOT_MARGIN = "320px";
const PRELOAD_BATCH_SIZE = 4;
const PRELOAD_BATCH_DELAY_MS = 90;
const ACTIVE_ROW_PRELOAD_DELAY_MS = 120;
const ACTIVE_ROW_PRELOAD_LIMIT = 36;
const NEARBY_FRAME_PRELOAD_OFFSETS = [0, 1, -1, 2, -2, 3, -3];

const ZERO_TILT: TiltState = { x: 0, y: 0 };
const preloadedFrameUrls = new Set<string>();

type IdleCallbackWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number }
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function wrapIndex(value: number, frameCount: number) {
  return ((value % frameCount) + frameCount) % frameCount;
}

function getCenteredRowIndex(rowCount: number) {
  return Math.max(0, Math.floor(rowCount / 2));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundZoom(value: number) {
  return Math.round(value * 100) / 100;
}

function getPointerDistance(points: PointerPoint[]) {
  if (points.length < 2) return 0;

  const [first, second] = points;
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getFrameDragDistance(
  viewer: HTMLDivElement | null,
  frameCount: number
) {
  const viewerWidth = viewer?.clientWidth || 320;

  return clamp(
    (viewerWidth * FRAME_DRAG_WIDTH_RATIO) / frameCount,
    MIN_FRAME_DRAG_DISTANCE,
    MAX_FRAME_DRAG_DISTANCE
  );
}

function preloadFrame(src: string) {
  if (preloadedFrameUrls.has(src)) {
    return Promise.resolve();
  }

  preloadedFrameUrls.add(src);

  const image = new window.Image();
  image.decoding = "async";

  if (image.decode) {
    image.src = src;
    return image.decode().catch(() => undefined);
  }

  return new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

function preloadNearbyFrames(row: string[], frameIndex: number) {
  return Promise.all(
    NEARBY_FRAME_PRELOAD_OFFSETS.map((offset) =>
      preloadFrame(row[wrapIndex(frameIndex + offset, row.length)])
    )
  );
}

function preloadFrameRow(row: string[]) {
  return Promise.all(row.slice(0, ACTIVE_ROW_PRELOAD_LIMIT).map(preloadFrame));
}

export default function Product360Viewer({
  alt,
  imageUrl,
  frameUrls = EMPTY_FRAME_URLS,
  frameRows = EMPTY_FRAME_ROWS,
  className = "",
}: Product360ViewerProps) {
  const rows = useMemo(() => {
    const normalizedRows = frameRows.filter((row) => row.length > 0);

    if (normalizedRows.length > 0) return normalizedRows;
    if (frameUrls.length > 1) return [frameUrls];
    if (imageUrl) return [[imageUrl]];
    return EMPTY_FRAME_ROWS;
  }, [frameRows, frameUrls, imageUrl]);

  const [frameIndex, setFrameIndex] = useState(0);
  const [rowIndex, setRowIndex] = useState(() =>
    getCenteredRowIndex(rows.length)
  );
  const [tilt, setTilt] = useState<TiltState>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const activePointers = useRef<Map<number, PointerPoint>>(new Map());
  const pinchState = useRef<PinchState | null>(null);
  const pendingDragPoint = useRef<PointerPoint | null>(null);
  const dragAnimationFrame = useRef<number | null>(null);

  const frameUrlsToPreload = useMemo(
    () => Array.from(new Set(rows.flat())),
    [rows]
  );
  const safeRowIndex = rows.length ? clamp(rowIndex, 0, rows.length - 1) : 0;
  const activeRow = rows[safeRowIndex] || EMPTY_FRAME_URLS;
  const activeFrame = activeRow.length
    ? activeRow[wrapIndex(frameIndex, activeRow.length)]
    : null;
  const canRotateFrames = activeRow.length > 1;
  const canRotateRows = rows.length > 1;
  const canTilt = !canRotateFrames && !canRotateRows;
  const isDragInteractive = canRotateFrames || canRotateRows || canTilt;
  const visibleTilt = canTilt ? tilt : ZERO_TILT;

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer || frameUrlsToPreload.length <= 1) return;

    let cancelled = false;
    let started = false;
    let timeoutId: number | undefined;
    let idleId: number | undefined;
    let observer: IntersectionObserver | null = null;
    let frameIndexToPreload = 0;

    const scheduleBatch = () => {
      if (cancelled) return;

      const typedWindow = window as IdleCallbackWindow;

      if (typedWindow.requestIdleCallback) {
        idleId = typedWindow.requestIdleCallback(preloadBatch, {
          timeout: 700,
        });
        return;
      }

      timeoutId = window.setTimeout(preloadBatch, PRELOAD_BATCH_DELAY_MS);
    };

    const preloadBatch = () => {
      if (cancelled) return;

      const batch = frameUrlsToPreload.slice(
        frameIndexToPreload,
        frameIndexToPreload + PRELOAD_BATCH_SIZE
      );

      frameIndexToPreload += PRELOAD_BATCH_SIZE;

      void Promise.all(batch.map(preloadFrame)).finally(() => {
        if (!cancelled && frameIndexToPreload < frameUrlsToPreload.length) {
          scheduleBatch();
        }
      });
    };

    const startPreloading = () => {
      if (started) return;

      started = true;
      scheduleBatch();
      observer?.disconnect();
      observer = null;
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            startPreloading();
          }
        },
        { rootMargin: PRELOAD_ROOT_MARGIN }
      );

      observer.observe(viewer);
    } else {
      startPreloading();
    }

    return () => {
      cancelled = true;
      observer?.disconnect();

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      const typedWindow = window as IdleCallbackWindow;

      if (idleId !== undefined && typedWindow.cancelIdleCallback) {
        typedWindow.cancelIdleCallback(idleId);
      }
    };
  }, [frameUrlsToPreload]);

  useEffect(() => {
    if (!canRotateFrames) return;

    const timeoutId = window.setTimeout(() => {
      void preloadFrameRow(activeRow);
    }, ACTIVE_ROW_PRELOAD_DELAY_MS);

    void preloadNearbyFrames(activeRow, frameIndex);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeRow, canRotateFrames, frameIndex]);

  useEffect(() => {
    return () => {
      if (dragAnimationFrame.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrame.current);
      }
    };
  }, []);

  if (!activeFrame) return null;

  const adjustZoom = (amount: number) => {
    setZoom((current) => {
      const nextZoom = roundZoom(clamp(current + amount, MIN_ZOOM, MAX_ZOOM));

      return nextZoom === current ? current : nextZoom;
    });
  };

  const resetView = () => {
    setFrameIndex(0);
    setRowIndex(getCenteredRowIndex(rows.length));
    setTilt({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setDragState(null);
    dragStateRef.current = null;
    pendingDragPoint.current = null;
    activePointers.current.clear();
    pinchState.current = null;

    if (dragAnimationFrame.current !== null) {
      window.cancelAnimationFrame(dragAnimationFrame.current);
      dragAnimationFrame.current = null;
    }
  };

  const updateDragView = (point: PointerPoint) => {
    const currentDragState = dragStateRef.current;

    if (!currentDragState) return;

    const horizontalDelta = point.x - currentDragState.startX;
    const verticalDelta = point.y - currentDragState.startY;

    if (canRotateFrames && Math.abs(horizontalDelta) >= 8) {
      const draggedFrames = Math.round(
        horizontalDelta /
          getFrameDragDistance(viewerRef.current, activeRow.length)
      );
      const nextFrameIndex = wrapIndex(
        currentDragState.baseFrameIndex + draggedFrames,
        activeRow.length
      );

      setFrameIndex((current) =>
        current === nextFrameIndex ? current : nextFrameIndex
      );
    }

    if (canRotateRows && Math.abs(verticalDelta) >= 8) {
      const draggedRows = Math.round(-verticalDelta / ROW_DRAG_DISTANCE);
      const nextRowIndex = clamp(
        currentDragState.baseRowIndex + draggedRows,
        0,
        rows.length - 1
      );

      setRowIndex((current) =>
        current === nextRowIndex ? current : nextRowIndex
      );
      return;
    }

    if (!canTilt) return;

    setTilt((current) => {
      const nextTilt = {
        x: clamp(
          currentDragState.baseTiltX - verticalDelta / TILT_DRAG_DISTANCE,
          -MAX_TILT,
          MAX_TILT
        ),
        y: clamp(
          currentDragState.baseTiltY + horizontalDelta / TILT_DRAG_DISTANCE,
          -MAX_TILT,
          MAX_TILT
        ),
      };

      return current.x === nextTilt.x && current.y === nextTilt.y
        ? current
        : nextTilt;
    });
  };

  const scheduleDragUpdate = (point: PointerPoint) => {
    pendingDragPoint.current = point;

    if (dragAnimationFrame.current !== null) return;

    dragAnimationFrame.current = window.requestAnimationFrame(() => {
      dragAnimationFrame.current = null;

      const nextPoint = pendingDragPoint.current;
      pendingDragPoint.current = null;

      if (nextPoint) {
        updateDragView(nextPoint);
      }
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragInteractive) return;

    if (canRotateFrames) {
      void preloadNearbyFrames(activeRow, frameIndex);
      void preloadFrameRow(activeRow);
    }

    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    event.currentTarget.setPointerCapture(event.pointerId);

    if (activePointers.current.size >= 2) {
      const startDistance = getPointerDistance(
        Array.from(activePointers.current.values())
      );

      pinchState.current = {
        baseZoom: zoom,
        startDistance,
      };

      setDragState(null);
      return;
    }

    const nextDragState = {
      baseFrameIndex: frameIndex,
      baseRowIndex: safeRowIndex,
      baseTiltX: tilt.x,
      baseTiltY: tilt.y,
      startX: event.clientX,
      startY: event.clientY,
    };

    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointers.current.has(event.pointerId)) {
      activePointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (activePointers.current.size >= 2 && pinchState.current) {
      const currentDistance = getPointerDistance(
        Array.from(activePointers.current.values())
      );

      if (pinchState.current.startDistance > 0) {
        setZoom((current) => {
          const nextZoom = roundZoom(
            clamp(
              pinchState.current!.baseZoom *
                (currentDistance / pinchState.current!.startDistance),
              MIN_ZOOM,
              MAX_ZOOM
            )
          );

          return nextZoom === current ? current : nextZoom;
        });
      }

      return;
    }

    if (!dragStateRef.current) return;

    scheduleDragUpdate({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const clearPointerState = (event: PointerEvent<HTMLDivElement>) => {
    activePointers.current.delete(event.pointerId);
    pinchState.current = null;
    setDragState(null);
    dragStateRef.current = null;
    pendingDragPoint.current = null;

    if (dragAnimationFrame.current !== null) {
      window.cancelAnimationFrame(dragAnimationFrame.current);
      dragAnimationFrame.current = null;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;

    event.preventDefault();
    adjustZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };

  const handleDoubleClick = () => {
    setZoom((current) => (current > MIN_ZOOM ? MIN_ZOOM : 2));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();

      if (canRotateFrames) {
        setFrameIndex((current) => wrapIndex(current - 1, activeRow.length));
        return;
      }

      if (canTilt) {
        setTilt((current) => ({
          ...current,
          y: clamp(current.y - TILT_KEY_STEP, -MAX_TILT, MAX_TILT),
        }));
      }
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();

      if (canRotateFrames) {
        setFrameIndex((current) => wrapIndex(current + 1, activeRow.length));
        return;
      }

      if (canTilt) {
        setTilt((current) => ({
          ...current,
          y: clamp(current.y + TILT_KEY_STEP, -MAX_TILT, MAX_TILT),
        }));
      }
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (canRotateRows) {
        setRowIndex((current) => clamp(current + 1, 0, rows.length - 1));
        return;
      }

      if (canTilt) {
        setTilt((current) => ({
          ...current,
          x: clamp(current.x + TILT_KEY_STEP, -MAX_TILT, MAX_TILT),
        }));
      }
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (canRotateRows) {
        setRowIndex((current) => clamp(current - 1, 0, rows.length - 1));
        return;
      }

      if (canTilt) {
        setTilt((current) => ({
          ...current,
          x: clamp(current.x - TILT_KEY_STEP, -MAX_TILT, MAX_TILT),
        }));
      }
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      adjustZoom(ZOOM_STEP);
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      adjustZoom(-ZOOM_STEP);
    }

    if (event.key === "0") {
      event.preventDefault();
      resetView();
    }
  };

  return (
    <div
      ref={viewerRef}
      aria-label={`${alt} image viewer`}
      role="group"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPointerState}
      onPointerCancel={clearPointerState}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      className={[
        "relative h-40 w-full select-none overflow-hidden rounded-md border border-[#eadbb8] bg-[#fff8ea] outline-none ring-accent focus-visible:ring-2",
        isDragInteractive ? "cursor-grab active:cursor-grabbing" : "",
        className,
      ].join(" ")}
      style={{
        touchAction: canRotateFrames || canRotateRows ? "none" : "pan-y",
      }}
    >
      <img
        alt={alt}
        decoding="async"
        draggable={false}
        loading="lazy"
        src={activeFrame}
        className={[
          "h-full w-full object-contain",
          dragState ? "will-change-transform" : "",
        ].join(" ")}
        style={{
          transform: `perspective(900px) rotateX(${visibleTilt.x}deg) rotateY(${visibleTilt.y}deg) scale(${zoom})`,
          transformStyle: "preserve-3d",
          transition: dragState ? "none" : "transform 140ms ease",
        }}
      />

      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            adjustZoom(-ZOOM_STEP);
          }}
          className="grid size-9 place-items-center rounded-md border border-[#d9c28c] bg-white/95 text-[#8c6518] shadow-[0_10px_24px_rgba(99,69,22,0.14)] transition hover:border-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
        >
          <FiZoomOut aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Reset view"
          title="Reset view"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            resetView();
          }}
          className="grid size-9 place-items-center rounded-md border border-[#d9c28c] bg-white/95 text-[#8c6518] shadow-[0_10px_24px_rgba(99,69,22,0.14)] transition hover:border-accent hover:text-primary"
        >
          <FiRotateCcw aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            adjustZoom(ZOOM_STEP);
          }}
          className="grid size-9 place-items-center rounded-md border border-[#d9c28c] bg-white/95 text-[#8c6518] shadow-[0_10px_24px_rgba(99,69,22,0.14)] transition hover:border-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
        >
          <FiZoomIn aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
