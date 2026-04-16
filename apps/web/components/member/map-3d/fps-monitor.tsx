'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { addToast } from '@heroui/react';

const SAMPLE_WINDOW = 180; // ~3s at 60fps
const MIN_AVG_FPS = 30;

interface FpsMonitorProps {
  onFallback: () => void;
}

export function FpsMonitor({ onFallback }: FpsMonitorProps) {
  const samples = useRef<number[]>([]);
  const warned = useRef(false);

  useFrame((_, delta) => {
    if (warned.current) return;
    samples.current.push(1 / Math.max(delta, 0.001));
    if (samples.current.length > SAMPLE_WINDOW) samples.current.shift();
    if (samples.current.length >= SAMPLE_WINDOW) {
      const avg = samples.current.reduce((a, b) => a + b, 0) / samples.current.length;
      if (avg < MIN_AVG_FPS) {
        warned.current = true;
        addToast({
          title: 'Desempenho baixo',
          description: 'O mapa 3D está pesado. Trocando para o modo simples em 3s.',
          color: 'warning',
        });
        setTimeout(() => onFallback(), 3000);
      }
    }
  });

  return null;
}
