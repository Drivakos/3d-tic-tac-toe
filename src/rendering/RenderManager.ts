import * as THREE from 'three';
import { initializeScene } from './SceneManager';
import {
    initializeBoard,
    addPieceToBoard as boardAddPiece,
    clearPieces as boardClearPieces,
    highlightWinningPieces as boardHighlightWinning,
    rebuildBoardFromState as boardRebuild
} from './BoardRenderer';
import { createStageColorManager, StageColorManager } from './StageColorManager';
import { materials } from './Materials';
import { Player } from '../types';

export class RenderManager {
    sceneComponents: ReturnType<typeof initializeScene>;
    boardComponents: ReturnType<typeof initializeBoard>;
    stageColorManager: StageColorManager;

    constructor(canvasId: string) {
        this.sceneComponents = initializeScene(canvasId);
        this.boardComponents = initializeBoard(this.sceneComponents.boardGroup, this.sceneComponents.scene);

        this.stageColorManager = createStageColorManager({
            scene: this.sceneComponents.scene,
            ambientLight: this.sceneComponents.lights.ambient,
            fillLight: this.sceneComponents.lights.fill,
            cyanLight: this.sceneComponents.lights.cyan,
            magentaLight: this.sceneComponents.lights.magenta,
            groundMaterial: materials.ground as THREE.MeshStandardMaterial,
            gridLineMaterial: materials.gridLine as THREE.MeshStandardMaterial,
            gridLines: this.boardComponents.gridLines,
            platformEdgeMaterial: this.boardComponents.platformEdgeMaterial,
            platformCornerMaterial: this.boardComponents.platformCornerMaterial
        });

        // Start animation loop
        this.animate();
    }

    private animate = () => {
        requestAnimationFrame(this.animate);
        this.sceneComponents.controls.update();
        this.sceneComponents.renderer.render(this.sceneComponents.scene, this.sceneComponents.camera);
    }

    public addPiece(cellIndex: number, player: Player): void {
        boardAddPiece(this.sceneComponents.boardGroup, this.boardComponents.pieces, cellIndex, player);
    }

    public clearPieces(): void {
        boardClearPieces(this.sceneComponents.boardGroup, this.boardComponents.pieces);
    }

    public highlightWinning(pattern: number[]): void {
        boardHighlightWinning(this.boardComponents.pieces, pattern);
    }

    public rebuildBoard(boardState: ReadonlyArray<Player | null>): void {
        boardRebuild(this.sceneComponents.boardGroup, this.boardComponents.pieces, boardState);
    }

    public updateStageColors(progress: number): void {
        this.stageColorManager.update(progress);
    }

    public resetStageColors(): void {
        this.stageColorManager.reset();
    }

    public handleWindowResize(): void {
        // SceneManager handles this via event listener usually, but we can expose it if needed.
        // The initializeScene function attaches the listener so it might be automatic.
    }
}
