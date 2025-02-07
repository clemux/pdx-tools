import { WebGLMap } from "map";
import { useEffect } from "react";

export function useCanvasPointerEvents(map: WebGLMap) {
  useEffect(() => {
    let primaryPointer: PointerEvent | null = null;
    let secondaryPointer: PointerEvent | null = null;
    let pointerDiff = 0;
    const canvas = map.gl.canvas;

    function moveCamera(e: MouseEvent) {
      map.moveCamera(e);
      map.redrawViewport();
    }

    function handleMouseUp(e: MouseEvent) {
      map.onMouseUp(e);
      canvas.removeEventListener("pointermove", moveCamera);
      canvas.removeEventListener("pointerup", handleMouseUp);
    }

    function pinchUp(e: PointerEvent) {
      if (e.pointerId == primaryPointer?.pointerId) {
        primaryPointer = null;
      } else if (e.pointerId == secondaryPointer?.pointerId) {
        secondaryPointer = null;
      }

      map.redrawViewport();
      canvas.removeEventListener("pointermove", pinchMove);
      canvas.removeEventListener("pointerup", pinchUp);
    }

    function pinchMove(e: PointerEvent) {
      if (e.pointerId == primaryPointer?.pointerId) {
        primaryPointer = e;
      } else if (e.pointerId == secondaryPointer?.pointerId) {
        secondaryPointer = e;
      }

      if (!primaryPointer || !secondaryPointer) {
        return;
      }

      const a = primaryPointer;
      const b = secondaryPointer;

      const dist = Math.sqrt(
        (b.clientX - a.clientX) ** 2 + (b.clientY - a.clientY) ** 2
      );

      if (pointerDiff != 0) {
        const midpoint = {
          clientX: (a.clientX + b.clientX) / 2,
          clientY: (a.clientY + b.clientY) / 2,
        };

        map.onWheel({
          ...midpoint,
          deltaY: pointerDiff - dist,
        });
        map.redrawViewport();
      }

      pointerDiff = dist;
    }

    function handleMouseDown(
      e: PointerEvent & { preventDefault: () => void; button: number }
    ) {
      e.preventDefault();
      if (e.button === 0) {
        if (e.isPrimary) {
          primaryPointer = e;
          map.onMouseDown(e);
          canvas.addEventListener("pointermove", moveCamera);
          canvas.addEventListener("pointerup", handleMouseUp);
        } else {
          secondaryPointer = e;
          canvas.removeEventListener("pointermove", moveCamera);
          canvas.removeEventListener("pointerup", handleMouseUp);
          canvas.addEventListener("pointermove", pinchMove);
          canvas.addEventListener("pointerup", pinchUp);
        }
      }
    }

    function handleMouseWheel(e: WheelEvent) {
      e.preventDefault();
      map.onWheel(e);
      map.redrawViewport();
    }

    canvas.addEventListener("wheel", handleMouseWheel);
    canvas.addEventListener("pointerdown", handleMouseDown);
    canvas.addEventListener("pointerup", handleMouseUp);
    canvas.addEventListener("pointerleave", handleMouseUp);
  }, [map]);
}
