'use client';

import { useRef, useCallback } from 'react';

const THUMB = 28; // diameter in px

interface Props {
  value: number;       // 1–10
  onChange: (v: number) => void;
  color: string;
}

export default function ScoreSlider({ value, onChange, color }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const computeValue = useCallback((clientX: number): number => {
    const el = containerRef.current;
    if (!el) return value;
    const rect = el.getBoundingClientRect();
    // Usable track: from THUMB/2 to rect.width - THUMB/2
    const lo = THUMB / 2;
    const hi = rect.width - THUMB / 2;
    const x = Math.max(lo, Math.min(hi, clientX - rect.left));
    const pct = (x - lo) / (hi - lo);
    return Math.round(pct * 9) + 1;
  }, [value]);

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    onChange(computeValue(e.clientX));
    const onMove = (ev: MouseEvent) => onChange(computeValue(ev.clientX));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleTouchStart(e: React.TouchEvent) {
    onChange(computeValue(e.touches[0].clientX));
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    onChange(computeValue(e.touches[0].clientX));
  }

  const pct = (value - 1) / 9; // 0 → 1

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      style={{
        position: 'relative',
        height: THUMB,
        cursor: 'pointer',
        userSelect: 'none',
        touchAction: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Track background — inset by half-thumb so it aligns with thumb center at extremes */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: THUMB / 2,
        right: THUMB / 2,
        height: 4,
        background: '#E2E8F0',
        borderRadius: 2,
        transform: 'translateY(-50%)',
      }}>
        {/* Colored fill */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${pct * 100}%`,
          height: '100%',
          background: color,
          borderRadius: 2,
          transition: 'width 0.06s, background 0.2s',
        }} />
      </div>

      {/* Thumb — left: calc(pct * (100% - THUMB)) places it so:
           pct=0 → left=0,  thumb occupies [0, THUMB],    center = THUMB/2 = track start ✓
           pct=1 → left=100%-THUMB, thumb occupies [W-THUMB, W], center = W-THUMB/2 = track end ✓ */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `calc(${pct} * (100% - ${THUMB}px))`,
          width: THUMB,
          height: THUMB,
          borderRadius: '50%',
          background: 'white',
          border: `2.5px solid ${color}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          transform: 'translateY(-50%)',
          transition: 'border-color 0.2s',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
