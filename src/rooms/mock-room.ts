/**
 * Aurora Mock Room Generator
 * 
 * Provides a lightweight, animated mathematical canvas simulation used to test
 * room mounting, parameter updates, pointer interaction, and resource teardown lifecycles.
 */

import type { RoomInstance, RoomContext, RoomCleanupFn, RoomPointerEvent } from './types';
import { dampParameter } from '../lib/state';

export function createMockRoom(roomName: string, accentColor = '#00F0FF'): RoomInstance {
  let animId = 0;
  let activeParams: Record<string, any> = {};
  let mouseX = 0.5;
  let mouseY = 0.5;
  let targetMouseX = 0.5;
  let targetMouseY = 0.5;

  return {
    mount(ctx: RoomContext): RoomCleanupFn {
      const { canvas, prng, dpr } = ctx;
      activeParams = { ...ctx.params };

      const c2d = canvas.getContext('2d');
      if (!c2d) {
        return () => {};
      }

      let width = (canvas.width = canvas.clientWidth * dpr);
      let height = (canvas.height = canvas.clientHeight * dpr);
      let time = prng.nextFloat(0, 100);

      // Create particle orbit field
      const numPoints = 80;
      const points = Array.from({ length: numPoints }, (_, i) => ({
        phase: (i / numPoints) * Math.PI * 2,
        speed: prng.nextFloat(0.4, 1.2),
        radiusOffset: prng.nextFloat(0.8, 1.2),
      }));

      const render = () => {
        time += 0.016;
        mouseX = dampParameter(mouseX, targetMouseX, 6.0, 0.016);
        mouseY = dampParameter(mouseY, targetMouseY, 6.0, 0.016);

        c2d.fillStyle = 'rgba(9, 10, 13, 0.2)';
        c2d.fillRect(0, 0, width, height);

        const centerX = width * 0.5 + (mouseX - 0.5) * 80 * dpr;
        const centerY = height * 0.5 + (mouseY - 0.5) * 80 * dpr;
        const baseRadius = Math.min(width, height) * 0.25;

        c2d.save();
        c2d.strokeStyle = accentColor;
        c2d.lineWidth = 1.5 * dpr;
        c2d.beginPath();

        points.forEach((pt, idx) => {
          const angle = pt.phase + time * pt.speed;
          const r = baseRadius * pt.radiusOffset * (1 + 0.15 * Math.sin(time * 2 + idx));
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (idx === 0) {
            c2d.moveTo(x, y);
          } else {
            c2d.lineTo(x, y);
          }
        });

        c2d.closePath();
        c2d.stroke();

        // Center typography placard
        c2d.fillStyle = '#F4F6FB';
        c2d.font = `600 ${14 * dpr}px 'JetBrains Mono', monospace`;
        c2d.textAlign = 'center';
        c2d.fillText(`${roomName.toUpperCase()} • ACTIVE`, centerX, centerY - 10 * dpr);

        c2d.fillStyle = '#A0A6B8';
        c2d.font = `400 ${11 * dpr}px 'JetBrains Mono', monospace`;
        const speedVal = activeParams.speed !== undefined ? activeParams.speed : '1.0';
        c2d.fillText(`SPEED: ${speedVal} • SEED: ${ctx.params.seed || '#000000'}`, centerX, centerY + 14 * dpr);

        c2d.restore();
        animId = requestAnimationFrame(render);
      };

      animId = requestAnimationFrame(render);

      // Return explicit cleanup function
      return () => {
        if (animId) {
          cancelAnimationFrame(animId);
          animId = 0;
        }
      };
    },

    updateParams(params: Record<string, any>): void {
      activeParams = { ...activeParams, ...params };
    },

    resize(w: number, h: number): void {
      // Re-scale canvas dimensions on resize
      w;
      h;
    },

    onPointer(event: RoomPointerEvent): void {
      targetMouseX = event.normalizedX;
      targetMouseY = event.normalizedY;
    },
  };
}
