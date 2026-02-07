/**
 * BoardRenderer - Game board, grid, pieces, and click targets
 * Handles all 3D rendering of the game board elements
 */

import * as THREE from 'three';
import { PLAYERS } from '../game/constants';
import {
    materials,
    xGeometries,
    oGeometries,
    glowMaterials,
    X_CONFIG,
    BOARD_CONFIG
} from './Materials';
import type { Player, Board } from '../types/game';

// ============================================================================
// Types
// ============================================================================

export interface BoardComponents {
    boardGroup: THREE.Group;
    platform: THREE.Group;
    gridLines: THREE.Group;
    clickTargets: THREE.Mesh[];
    pieces: THREE.Group[];
    platformEdgeMaterial: THREE.MeshStandardMaterial | null;
    platformCornerMaterial: THREE.MeshPhysicalMaterial | null;
    particles: THREE.Points;
    particlePositions: Float32Array;
    particleCount: number;
    particleGeometry: THREE.BufferGeometry;
}

// ============================================================================
// Configuration
// ============================================================================

const CELL_SIZE = BOARD_CONFIG.CELL_SIZE;
const BOARD_SIZE = BOARD_CONFIG.BOARD_SIZE;
const GAP = BOARD_CONFIG.GAP;
const X_ARM_LENGTH = X_CONFIG.ARM_LENGTH;
const X_TUBE_RADIUS = X_CONFIG.TUBE_RADIUS;

// Pre-create geometries for grid lines
const vLineGeometry = new THREE.BoxGeometry(0.06, 0.12, BOARD_SIZE - 0.3);
const hLineGeometry = new THREE.BoxGeometry(BOARD_SIZE - 0.3, 0.12, 0.06);
const clickTargetGeometry = new THREE.PlaneGeometry(CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2);

// ============================================================================
// Platform Creation
// ============================================================================

export function createPlatform(): { group: THREE.Group; edgeMaterial: THREE.MeshStandardMaterial; cornerMaterial: THREE.MeshPhysicalMaterial } {
    const group = new THREE.Group();

    const mainGeometry = new THREE.BoxGeometry(BOARD_SIZE + 0.8, 0.25, BOARD_SIZE + 0.8);
    const main = new THREE.Mesh(mainGeometry, materials.board);
    main.position.y = -0.25;
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    const topGeometry = new THREE.BoxGeometry(BOARD_SIZE + 0.6, 0.08, BOARD_SIZE + 0.6);
    const top = new THREE.Mesh(topGeometry, materials.boardTop);
    top.position.y = -0.08;
    top.receiveShadow = true;
    group.add(top);

    const edgeGeometry = new THREE.BoxGeometry(BOARD_SIZE + 0.85, 0.02, BOARD_SIZE + 0.85);
    const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x8a9a8a,
        emissive: 0x8a9a8a,
        emissiveIntensity: 0.1,
        metalness: 0.9,
        roughness: 0.2
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.position.y = -0.12;
    group.add(edge);

    const cornerGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8);
    const cornerMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x8a9a8a,
        emissive: 0x8a9a8a,
        emissiveIntensity: 0.2,
        metalness: 1.0,
        roughness: 0.1,
        clearcoat: 0.5
    });

    const cornerPositions = [
        [-BOARD_SIZE / 2 - 0.3, -0.2, -BOARD_SIZE / 2 - 0.3],
        [BOARD_SIZE / 2 + 0.3, -0.2, -BOARD_SIZE / 2 - 0.3],
        [-BOARD_SIZE / 2 - 0.3, -0.2, BOARD_SIZE / 2 + 0.3],
        [BOARD_SIZE / 2 + 0.3, -0.2, BOARD_SIZE / 2 + 0.3]
    ];

    cornerPositions.forEach((pos): void => {
        const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
        corner.position.set(pos[0], pos[1], pos[2]);
        corner.castShadow = true;
        group.add(corner);
    });

    return { group, edgeMaterial, cornerMaterial };
}

// ============================================================================
// Grid Lines
// ============================================================================

export function createGridLines(): THREE.Group {
    const gridGroup = new THREE.Group();

    for (let i = -1; i <= 1; i += 2) {
        const line = new THREE.Mesh(vLineGeometry, materials.gridLine);
        line.position.set(i * (CELL_SIZE / 2 + GAP / 2), 0.02, 0);
        line.castShadow = true;
        line.receiveShadow = true;
        gridGroup.add(line);
    }

    for (let i = -1; i <= 1; i += 2) {
        const line = new THREE.Mesh(hLineGeometry, materials.gridLine);
        line.position.set(0, 0.02, i * (CELL_SIZE / 2 + GAP / 2));
        line.castShadow = true;
        line.receiveShadow = true;
        gridGroup.add(line);
    }

    return gridGroup;
}

// ============================================================================
// Click Targets
// ============================================================================

export function createClickTargets(boardGroup: THREE.Group): THREE.Mesh[] {
    const targets: THREE.Mesh[] = [];

    for (let i = 0; i < 9; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;

        const x = (col - 1) * CELL_SIZE;
        const z = (row - 1) * CELL_SIZE;

        const target = new THREE.Mesh(
            clickTargetGeometry,
            new THREE.MeshBasicMaterial({ visible: false })
        );
        target.rotation.x = -Math.PI / 2;
        target.position.set(x, 0.01, z);
        target.userData = { cellIndex: i };

        targets.push(target);
        boardGroup.add(target);
    }

    return targets;
}

// ============================================================================
// Game Pieces
// ============================================================================

export function createX(cellIndex: number): THREE.Group {
    const group = new THREE.Group();

    function createRoundedArm(): THREE.Group {
        const armGroup = new THREE.Group();

        const cylinder = new THREE.Mesh(xGeometries.cylinder, materials.playerX.clone());
        cylinder.castShadow = true;
        cylinder.receiveShadow = true;
        armGroup.add(cylinder);

        const topCap = new THREE.Mesh(xGeometries.topCap, materials.playerX.clone());
        topCap.position.y = (X_ARM_LENGTH - X_TUBE_RADIUS * 2) / 2;
        topCap.castShadow = true;
        topCap.receiveShadow = true;
        armGroup.add(topCap);

        const bottomCap = new THREE.Mesh(xGeometries.bottomCap, materials.playerX.clone());
        bottomCap.position.y = -(X_ARM_LENGTH - X_TUBE_RADIUS * 2) / 2;
        bottomCap.castShadow = true;
        bottomCap.receiveShadow = true;
        armGroup.add(bottomCap);

        return armGroup;
    }

    const arm1 = createRoundedArm();
    arm1.rotation.z = Math.PI / 4;
    arm1.rotation.x = Math.PI / 2;
    group.add(arm1);

    const arm2 = createRoundedArm();
    arm2.rotation.z = -Math.PI / 4;
    arm2.rotation.x = Math.PI / 2;
    group.add(arm2);

    const glowArm1 = new THREE.Mesh(xGeometries.glow, glowMaterials.x);
    glowArm1.rotation.x = -Math.PI / 2;
    glowArm1.rotation.z = Math.PI / 4;
    glowArm1.position.y = -0.08;
    glowArm1.castShadow = false;
    glowArm1.receiveShadow = false;
    group.add(glowArm1);

    const glowArm2 = new THREE.Mesh(xGeometries.glow, glowMaterials.x);
    glowArm2.rotation.x = -Math.PI / 2;
    glowArm2.rotation.z = -Math.PI / 4;
    glowArm2.position.y = -0.08;
    glowArm2.castShadow = false;
    glowArm2.receiveShadow = false;
    group.add(glowArm2);

    const row = Math.floor(cellIndex / 3);
    const col = cellIndex % 3;
    group.position.set((col - 1) * CELL_SIZE, 0.15, (row - 1) * CELL_SIZE);

    group.scale.set(0, 0, 0);
    group.userData = { targetScale: 1, cellIndex };

    return group;
}

export function createO(cellIndex: number): THREE.Group {
    const group = new THREE.Group();

    const mesh = new THREE.Mesh(oGeometries.torus, materials.playerO.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const glow = new THREE.Mesh(oGeometries.glow, glowMaterials.o);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.08;
    glow.castShadow = false;
    glow.receiveShadow = false;
    group.add(glow);

    const row = Math.floor(cellIndex / 3);
    const col = cellIndex % 3;
    group.position.set((col - 1) * CELL_SIZE, 0.2, (row - 1) * CELL_SIZE);

    group.scale.set(0, 0, 0);
    group.userData = { targetScale: 1, cellIndex };

    return group;
}

// ============================================================================
// Piece Management
// ============================================================================

export function addPieceToBoard(
    boardGroup: THREE.Group,
    pieces: THREE.Group[],
    cellIndex: number,
    player: Player
): THREE.Group {
    const piece = player === PLAYERS.X ? createX(cellIndex) : createO(cellIndex);
    boardGroup.add(piece);
    pieces.push(piece);
    // Set scale to 1 immediately so piece is visible (animation removed for simplicity)
    piece.scale.set(1, 1, 1);
    return piece;
}

export function clearPieces(boardGroup: THREE.Group, pieces: THREE.Group[]): void {
    pieces.forEach((piece): void => {
        boardGroup.remove(piece);
    });
    pieces.length = 0;
}

export function highlightWinningPieces(pieces: THREE.Group[], pattern: number[]): void {
    pieces.forEach((piece): void => {
        if (pattern.includes(piece.userData.cellIndex)) {
            piece.children.forEach((child): void => {
                if (child instanceof THREE.Mesh && child.material && 'color' in child.material) {
                    if ('opacity' in child.material && (child.material as { opacity: number }).opacity < 1) {
                        if (!(child.material as { _originalColor?: THREE.Color })._originalColor) {
                            (child.material as THREE.Material & { _originalColor?: THREE.Color })._originalColor = (child.material as THREE.MeshStandardMaterial).color.clone();
                        }
                        (child.material as THREE.MeshStandardMaterial).color.setHex(0xffd700);
                        (child.material as THREE.MeshStandardMaterial).opacity = 0.3;
                    } else {
                        child.material = materials.winHighlight.clone();
                    }
                }
            });
            piece.userData.isWinning = true;
        }
    });
}

export function rebuildBoardFromState(
    boardGroup: THREE.Group,
    pieces: THREE.Group[],
    board: Board
): void {
    clearPieces(boardGroup, pieces);
    board.forEach((cell, index): void => {
        if (cell) {
            const piece = addPieceToBoard(boardGroup, pieces, index, cell);
            piece.scale.set(1, 1, 1);
        }
    });
}

// ============================================================================
// Particles
// ============================================================================

export interface ParticleData {
    particles: THREE.Points;
    particlePositions: Float32Array;
    particleCount: number;
    particleGeometry: THREE.BufferGeometry;
}

export function createParticles(scene: THREE.Scene): ParticleData {
    const particleCount = 150;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 30;
        particlePositions[i * 3 + 1] = Math.random() * 15;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
        particleSizes[i] = Math.random() * 0.05 + 0.02;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.StaticDrawUsage));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1).setUsage(THREE.StaticDrawUsage));

    const particleMaterial = new THREE.PointsMaterial({
        color: 0x00f5ff,
        size: 0.08,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    return { particles, particlePositions, particleCount, particleGeometry };
}

// ============================================================================
// Board Initialization
// ============================================================================

export function initializeBoard(boardGroup: THREE.Group, scene: THREE.Scene): BoardComponents {
    // Create platform
    const { group: platform, edgeMaterial, cornerMaterial } = createPlatform();
    boardGroup.add(platform);

    // Create grid lines
    const gridLines = createGridLines();
    boardGroup.add(gridLines);

    // Create click targets
    const clickTargets = createClickTargets(boardGroup);

    // Create particles
    const particleData = createParticles(scene);

    // Pieces array (will be populated as game is played)
    const pieces: THREE.Group[] = [];

    return {
        boardGroup,
        platform,
        gridLines,
        clickTargets,
        pieces,
        platformEdgeMaterial: edgeMaterial,
        platformCornerMaterial: cornerMaterial,
        particles: particleData.particles,
        particlePositions: particleData.particlePositions,
        particleCount: particleData.particleCount,
        particleGeometry: particleData.particleGeometry
    };
}

