"use client";

import React, { useState, useRef, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ZoomContainerProps {
  children: React.ReactNode;
  className?: string;
  minScale?: number;
  maxScale?: number;
}

export const ZoomContainer: React.FC<ZoomContainerProps> = ({
  children,
  className = "",
  minScale = 0.5,
  maxScale = 2.0,
}) => {
  const [scale, setScale] = useState<number>(1.0);
  const initialDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1.0);
  const [isPinching, setIsPinching] = useState(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialDistanceRef.current = Math.hypot(dx, dy);
        initialScaleRef.current = scale;
        setIsPinching(true);
      }
    },
    [scale]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 2 && initialDistanceRef.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDistance = Math.hypot(dx, dy);
        if (initialDistanceRef.current > 10) {
          const ratio = currentDistance / initialDistanceRef.current;
          const target = Math.round(initialScaleRef.current * ratio * 100) / 100;
          const clamped = Math.min(Math.max(target, minScale), maxScale);
          setScale(clamped);
        }
      }
    },
    [minScale, maxScale]
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      initialDistanceRef.current = null;
      setIsPinching(false);
    }
  }, []);

  const zoomIn = () => setScale((s) => Math.min(maxScale, Math.round((s + 0.1) * 10) / 10));
  const zoomOut = () => setScale((s) => Math.max(minScale, Math.round((s - 0.1) * 10) / 10));
  const resetZoom = () => setScale(1.0);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative flex-1 flex flex-col min-h-0 w-full ${className}`}
    >
      {/* Zoomable Inner Content */}
      <div
        className="flex-1 flex flex-col min-h-0 w-full transition-transform duration-75"
        style={{
          zoom: scale,
        }}
      >
        {children}
      </div>

      {/* Floating Zoom Indicator & Controls (Appears when zoomed or during pinch gesture) */}
      {(scale !== 1.0 || isPinching) && (
        <div className="fixed bottom-5 right-4 z-50 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-[rgba(92,61,46,0.18)] text-xs font-mono text-[var(--brown-dark)] animate-in fade-in zoom-in-95">
          <button
            type="button"
            onClick={zoomOut}
            className="p-1 rounded-full hover:bg-[var(--brown-faint)] active:scale-95 transition-all cursor-pointer"
            title="Zoom Out past default size"
          >
            <ZoomOut className="w-3.5 h-3.5 text-[var(--brown-dark)]" />
          </button>
          <span
            onClick={resetZoom}
            className="font-bold cursor-pointer hover:underline px-1 select-none tabular-nums"
            title="Click to reset to default size (100%)"
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            className="p-1 rounded-full hover:bg-[var(--brown-faint)] active:scale-95 transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5 text-[var(--brown-dark)]" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="p-1 rounded-full hover:bg-[var(--brown-faint)] text-[var(--text-muted)] hover:text-[var(--brown)] active:scale-95 transition-all ml-1 cursor-pointer"
            title="Reset zoom to 100%"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
