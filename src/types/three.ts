import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Player, CellIndex } from './game';

export interface GamePiece {
  mesh: THREE.Group;
  cellIndex: CellIndex;
  player: Player;
  isWinning: boolean;
}

export interface BoardGeometryConfig {
  cellSize: number;
  boardSize: number;
  gap: number;
}

export interface RenderConfig {
  antialias: boolean;
  alpha: boolean;
  powerPreference: WebGLPowerPreference;
  maxPixelRatio: number;
}

export interface CameraConfig {
  fov: number;
  near: number;
  far: number;
}

export interface CameraPositions {
  desktop: {
    y: number;
    z: number;
    fov: number;
    minDist: number;
  };
  mobile: {
    y: number;
    z: number;
    fov: number;
    minDist: number;
  };
}

export interface StageColorConfig {
  fog: THREE.Color;
  ground: THREE.Color;
  ambient: THREE.Color;
  platformAccent: THREE.Color;
  gridLine: THREE.Color;
  accentMultiplier: number;
}

export interface ParticleConfig {
  count: number;
  size: number;
  opacity: number;
  blending: THREE.Blending;
}
