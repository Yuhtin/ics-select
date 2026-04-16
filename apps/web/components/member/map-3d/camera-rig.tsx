'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, Vector3 } from 'three';
import { useSceneStore } from './scene-store';

const CAM_OFFSET_FOLLOW = new Vector3(0, 70, 55);
const CAM_OFFSET_FOCUS = new Vector3(-12, 30, 18);

interface CameraRigProps {
  carPositionRef: React.MutableRefObject<Vector3>;
  nodePositionsRef: React.MutableRefObject<Map<string, Vector3>>;
}

export function CameraRig({ carPositionRef, nodePositionsRef }: CameraRigProps) {
  const { camera, size } = useThree();
  const target = useRef(new Vector3(0, 0, 0));
  const mode = useSceneStore((s) => s.cameraMode);
  const focusedId = useSceneStore((s) => s.focusedNodeId);

  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    const frustum = 50;
    const aspect = size.width / size.height;
    camera.left = -frustum * aspect;
    camera.right = frustum * aspect;
    camera.top = frustum;
    camera.bottom = -frustum;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  useFrame(() => {
    if (mode === 'follow') {
      target.current.lerp(carPositionRef.current, 0.08);
      camera.position.copy(target.current).add(CAM_OFFSET_FOLLOW);
      camera.lookAt(target.current);
    } else if (mode === 'focus' && focusedId) {
      const nodePos = nodePositionsRef.current.get(focusedId);
      if (nodePos) {
        target.current.lerp(nodePos, 0.1);
        const desired = nodePos.clone().add(CAM_OFFSET_FOCUS);
        camera.position.lerp(desired, 0.1);
        camera.lookAt(nodePos);
      }
    }
  });

  return null;
}
