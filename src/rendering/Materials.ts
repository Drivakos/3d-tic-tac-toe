/**
 * Materials - All Three.js material and geometry definitions
 * Centralized material management for the 3D Tic-Tac-Toe game
 */

import * as THREE from 'three';

// ============================================================================
// Material Definitions
// ============================================================================

export const materials: Record<string, THREE.Material> = {
    board: new THREE.MeshStandardMaterial({
        color: 0x12121f,
        metalness: 0.6,
        roughness: 0.35,
        envMapIntensity: 0.8
    }),
    boardTop: new THREE.MeshStandardMaterial({
        color: 0x0d0d18,
        metalness: 0.7,
        roughness: 0.25,
        envMapIntensity: 1.0
    }),
    gridLine: new THREE.MeshStandardMaterial({
        color: 0x8a9a8a,
        emissive: 0x8a9a8a,
        emissiveIntensity: 0.3,
        metalness: 0.95,
        roughness: 0.05,
        envMapIntensity: 1.5
    }),
    playerX: new THREE.MeshPhysicalMaterial({
        color: 0x00f5ff,
        emissive: 0x00f5ff,
        emissiveIntensity: 0.6,
        metalness: 1.0,
        roughness: 0.08,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        envMapIntensity: 2.0,
        reflectivity: 1.0
    }),
    playerO: new THREE.MeshPhysicalMaterial({
        color: 0xff00aa,
        emissive: 0xff00aa,
        emissiveIntensity: 0.6,
        metalness: 1.0,
        roughness: 0.08,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        envMapIntensity: 2.0,
        reflectivity: 1.0
    }),
    winHighlight: new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 1.0,
        metalness: 1.0,
        roughness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 2.5,
        reflectivity: 1.0
    }),
    ground: new THREE.MeshStandardMaterial({
        color: 0x050508,
        metalness: 0.9,
        roughness: 0.15,
        envMapIntensity: 0.5
    })
};

// ============================================================================
// X Piece Geometry Configuration
// ============================================================================

export const X_CONFIG = {
    ARM_LENGTH: 1.1,
    TUBE_RADIUS: 0.1,
    RADIAL_SEGMENTS: 24,
    CAP_SEGMENTS: 12
} as const;

export const xGeometries = {
    cylinder: new THREE.CylinderGeometry(
        X_CONFIG.TUBE_RADIUS,
        X_CONFIG.TUBE_RADIUS,
        X_CONFIG.ARM_LENGTH - X_CONFIG.TUBE_RADIUS * 2,
        X_CONFIG.RADIAL_SEGMENTS
    ),
    topCap: new THREE.SphereGeometry(
        X_CONFIG.TUBE_RADIUS,
        X_CONFIG.RADIAL_SEGMENTS,
        X_CONFIG.CAP_SEGMENTS,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
    ),
    bottomCap: new THREE.SphereGeometry(
        X_CONFIG.TUBE_RADIUS,
        X_CONFIG.RADIAL_SEGMENTS,
        X_CONFIG.CAP_SEGMENTS,
        0,
        Math.PI * 2,
        Math.PI / 2,
        Math.PI / 2
    ),
    glow: new THREE.PlaneGeometry(X_CONFIG.TUBE_RADIUS * 2.5, X_CONFIG.ARM_LENGTH * 0.85)
};

// ============================================================================
// O Piece Geometry Configuration
// ============================================================================

export const O_CONFIG = {
    TORUS_RADIUS: 0.5,
    TUBE_RADIUS: 0.1
} as const;

export const oGeometries = {
    torus: new THREE.TorusGeometry(O_CONFIG.TORUS_RADIUS, O_CONFIG.TUBE_RADIUS, 24, 48),
    glow: new THREE.RingGeometry(
        O_CONFIG.TORUS_RADIUS - O_CONFIG.TUBE_RADIUS * 1.2,
        O_CONFIG.TORUS_RADIUS + O_CONFIG.TUBE_RADIUS * 1.2,
        48
    )
};

// ============================================================================
// Glow Materials
// ============================================================================

export const glowMaterials = {
    x: new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    }),
    o: new THREE.MeshBasicMaterial({
        color: 0xff00aa,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    })
};

// ============================================================================
// Urgency Colors (for timer effects)
// ============================================================================

export const urgencyColors = {
    red: new THREE.Color(0xff2200),
    orange: new THREE.Color(0xff6600)
};

// ============================================================================
// Board Configuration
// ============================================================================

export const BOARD_CONFIG = {
    CELL_SIZE: 2,
    get BOARD_SIZE() { return this.CELL_SIZE * 3; },
    GAP: 0.1
} as const;
