"use client";

import { useEffect, useCallback } from "react";

/**
 * Hook that tracks cursor position relative to a container element
 * and sets CSS custom properties --mouse-x / --mouse-y on each
 * child `.card` element for the proximity-glow border effect.
 * Automatically no-ops on touch devices without a pointer/mouse.
 */
export function useCardGlow(containerRef: React.RefObject<HTMLElement | null>) {
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const cards = container.querySelectorAll<HTMLElement>(".card");
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty("--mouse-x", `${x}px`);
        card.style.setProperty("--mouse-y", `${y}px`);
      });
    },
    [containerRef]
  );

  useEffect(() => {
    // Only bind mouse listeners if the device supports hover/pointer
    if (typeof window === "undefined" || !window.matchMedia("(hover: hover)").matches) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => container.removeEventListener("mousemove", handleMouseMove);
  }, [containerRef, handleMouseMove]);
}
