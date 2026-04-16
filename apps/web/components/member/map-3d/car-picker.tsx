'use client';

import { Suspense, useMemo } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import { Check, X } from 'lucide-react';
import { useRef } from 'react';
import { CAR_MODELS, type CarModel } from './car-models';
import { useCarPref } from '../../../lib/car-pref';

function RotatingCar({ url, scale, yOffset }: { url: string; scale: number; yOffset: number }) {
  const gltf = useLoader(GLTFLoader, url);
  const groupRef = useRef<Group>(null);

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((obj) => {
      if ((obj as Mesh).isMesh) {
        const mesh = obj as Mesh;
        const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[];
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if (m && 'flatShading' in m) m.flatShading = true;
          });
        } else if (mat && 'flatShading' in mat) {
          mat.flatShading = true;
        }
      }
    });
    return cloned;
  }, [gltf.scene]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.6;
  });

  return (
    <group ref={groupRef} position={[0, yOffset, 0]}>
      <primitive object={scene} scale={scale} />
    </group>
  );
}

function CarTile({ car, selected, onSelect }: { car: CarModel; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'relative rounded-xl overflow-hidden border-2 transition-all flex flex-col',
        selected ? 'border-brand shadow-lg shadow-brand/30' : 'border-transparent hover:border-border',
      ].join(' ')}
    >
      <div className="aspect-square bg-gradient-to-b from-[#FEF3C7] to-[#FDBA74] relative">
        <Canvas camera={{ position: [3.5, 2.5, 4.5], fov: 35 }} dpr={[1, 2]}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} />
          <hemisphereLight args={['#FDBA74', '#34D399', 0.5]} />
          <Suspense fallback={null}>
            <RotatingCar url={car.url} scale={car.scale * 1.2} yOffset={0} />
          </Suspense>
        </Canvas>
        {selected && (
          <div className="absolute top-2 right-2 bg-brand text-white rounded-full p-1 shadow">
            <Check className="h-3 w-3" />
          </div>
        )}
      </div>
      <div className="bg-white py-2 px-3 text-xs font-bold text-foreground">{car.name}</div>
    </button>
  );
}

interface CarPickerProps {
  open: boolean;
  onClose: () => void;
}

export function CarPicker({ open, onClose }: CarPickerProps) {
  const [carId, setCar] = useCarPref();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 shadow-2xl max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Escolha seu carrinho</h2>
            <p className="text-xs text-foreground-muted mt-1">
              Modelos CC-BY por{' '}
              <a
                href="https://quaternius.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Quaternius
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground p-1"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CAR_MODELS.map((car) => (
            <CarTile
              key={car.id}
              car={car}
              selected={car.id === carId}
              onSelect={() => {
                setCar(car.id);
                onClose();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
