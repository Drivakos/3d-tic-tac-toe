/**
 * StageColorManager - Timer-based visual effects for game urgency
 * Uses dependency injection to decouple from Three.js scene objects
 */

import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export interface StageColorDependencies {
    scene: THREE.Scene;
    ambientLight: THREE.AmbientLight;
    fillLight: THREE.PointLight | THREE.DirectionalLight;
    cyanLight: THREE.PointLight;
    magentaLight: THREE.PointLight;
    groundMaterial: THREE.MeshStandardMaterial;
    gridLineMaterial: THREE.MeshStandardMaterial;
    gridLines: THREE.Group;
    platformEdgeMaterial: THREE.MeshStandardMaterial | null;
    platformCornerMaterial: THREE.MeshPhysicalMaterial | null;
}

export interface StageColors {
    fog: THREE.Color;
    ground: THREE.Color;
    ambient: THREE.Color;
    platformAccent: THREE.Color;
    gridLine: THREE.Color;
    accentMultiplier: number;
}

// ============================================================================
// Constants
// ============================================================================

export const STAGE_COLOR_THRESHOLDS = {
    WARNING: 0.6,
    CRITICAL: 0.4,
    DANGER: 0.2
};

export const STAGE_COLORS: Record<string, StageColors> = {
    NORMAL: {
        fog: new THREE.Color(0x080808),
        ground: new THREE.Color(0x060606),
        ambient: new THREE.Color(0x1a1a1a),
        platformAccent: new THREE.Color(0x8a9a8a),
        gridLine: new THREE.Color(0x8a9a8a),
        accentMultiplier: 0.4
    },
    WARNING: {
        fog: new THREE.Color(0x121008),
        ground: new THREE.Color(0x0a0806),
        ambient: new THREE.Color(0x2e2a1a),
        platformAccent: new THREE.Color(0xccaa44),
        gridLine: new THREE.Color(0xccaa44),
        accentMultiplier: 0.5
    },
    CRITICAL: {
        fog: new THREE.Color(0x180a00),
        ground: new THREE.Color(0x100800),
        ambient: new THREE.Color(0x2e150a),
        platformAccent: new THREE.Color(0xff8800),
        gridLine: new THREE.Color(0xff8800),
        accentMultiplier: 0.4
    },
    DANGER: {
        fog: new THREE.Color(0x1a0000),
        ground: new THREE.Color(0x120000),
        ambient: new THREE.Color(0x2e0808),
        platformAccent: new THREE.Color(0xff2200),
        gridLine: new THREE.Color(0xff2200),
        accentMultiplier: 0.3
    }
};

const EXTREME_DANGER: StageColors = {
    fog: new THREE.Color(0x250000),
    ground: new THREE.Color(0x180000),
    ambient: new THREE.Color(0x350505),
    platformAccent: new THREE.Color(0xff0000),
    gridLine: new THREE.Color(0xff0000),
    accentMultiplier: 0.05
};

// Urgency colors
const urgencyColorRed = new THREE.Color(0xff2200);
const urgencyColorOrange = new THREE.Color(0xff6600);

// ============================================================================
// Utility Functions
// ============================================================================

function lerpColor(color1: THREE.Color, color2: THREE.Color, t: number): THREE.Color {
    const result = new THREE.Color();
    result.r = color1.r + (color2.r - color1.r) * t;
    result.g = color1.g + (color2.g - color1.g) * t;
    result.b = color1.b + (color2.b - color1.b) * t;
    return result;
}

// ============================================================================
// StageColorManager Class
// ============================================================================

export class StageColorManager {
    private deps: StageColorDependencies;
    private currentProgress: number = 1.0;

    private readonly originalColors = {
        fog: new THREE.Color(0x080808),
        ground: new THREE.Color(0x060606),
        ambient: new THREE.Color(0x1a1a1a),
        platformAccent: new THREE.Color(0x8a9a8a),
        gridLine: new THREE.Color(0x8a9a8a),
        cyanIntensity: 0.6,
        magentaIntensity: 0.5
    };

    constructor(deps: StageColorDependencies) {
        this.deps = deps;
    }

    /**
     * Update platform materials (call when they change)
     */
    updatePlatformMaterials(
        edgeMaterial: THREE.MeshStandardMaterial | null,
        cornerMaterial: THREE.MeshPhysicalMaterial | null
    ): void {
        this.deps.platformEdgeMaterial = edgeMaterial;
        this.deps.platformCornerMaterial = cornerMaterial;
    }

    /**
     * Get current progress value
     */
    getProgress(): number {
        return this.currentProgress;
    }

    /**
     * Update stage colors based on timer progress (0-1)
     */
    update(progress: number): void {
        this.currentProgress = progress;

        let targetColors: StageColors;
        let fromColors: StageColors;
        let lerpT: number;

        if (progress > STAGE_COLOR_THRESHOLDS.WARNING) {
            const range = 1.0 - STAGE_COLOR_THRESHOLDS.WARNING;
            lerpT = (progress - STAGE_COLOR_THRESHOLDS.WARNING) / range;
            fromColors = STAGE_COLORS.WARNING;
            targetColors = STAGE_COLORS.NORMAL;
        } else if (progress > STAGE_COLOR_THRESHOLDS.CRITICAL) {
            const range = STAGE_COLOR_THRESHOLDS.WARNING - STAGE_COLOR_THRESHOLDS.CRITICAL;
            lerpT = (progress - STAGE_COLOR_THRESHOLDS.CRITICAL) / range;
            fromColors = STAGE_COLORS.CRITICAL;
            targetColors = STAGE_COLORS.WARNING;
        } else if (progress > STAGE_COLOR_THRESHOLDS.DANGER) {
            const range = STAGE_COLOR_THRESHOLDS.CRITICAL - STAGE_COLOR_THRESHOLDS.DANGER;
            lerpT = (progress - STAGE_COLOR_THRESHOLDS.DANGER) / range;
            fromColors = STAGE_COLORS.DANGER;
            targetColors = STAGE_COLORS.CRITICAL;
        } else {
            const range = STAGE_COLOR_THRESHOLDS.DANGER;
            lerpT = Math.max(0, progress / range);
            fromColors = EXTREME_DANGER;
            targetColors = STAGE_COLORS.DANGER;
        }

        const fogColor = lerpColor(fromColors.fog, targetColors.fog, lerpT);
        const groundColor = lerpColor(fromColors.ground, targetColors.ground, lerpT);
        const ambientColor = lerpColor(fromColors.ambient, targetColors.ambient, lerpT);
        const platformAccentColor = lerpColor(fromColors.platformAccent, targetColors.platformAccent, lerpT);
        const gridLineColor = lerpColor(fromColors.gridLine, targetColors.gridLine, lerpT);
        const accentMult = fromColors.accentMultiplier +
            (targetColors.accentMultiplier - fromColors.accentMultiplier) * lerpT;

        // Apply colors to scene elements
        if (this.deps.scene.fog) {
            (this.deps.scene.fog as THREE.FogExp2).color.copy(fogColor);
        }
        this.deps.groundMaterial.color.copy(groundColor);
        this.deps.ambientLight.color.copy(ambientColor);

        // Platform materials
        if (this.deps.platformEdgeMaterial) {
            this.deps.platformEdgeMaterial.color.copy(platformAccentColor);
            this.deps.platformEdgeMaterial.emissive.copy(platformAccentColor);
        }
        if (this.deps.platformCornerMaterial) {
            this.deps.platformCornerMaterial.color.copy(platformAccentColor);
            this.deps.platformCornerMaterial.emissive.copy(platformAccentColor);
        }

        // Grid lines
        this.deps.gridLineMaterial.color.copy(gridLineColor);
        this.deps.gridLineMaterial.emissive.copy(gridLineColor);

        this.updateGridLineChildren(gridLineColor);

        // Accent lights
        this.deps.cyanLight.intensity = this.originalColors.cyanIntensity * accentMult;
        this.deps.magentaLight.intensity = this.originalColors.magentaIntensity * accentMult;

        // Urgency effects
        this.applyUrgencyEffects(progress, gridLineColor);
    }

    /**
     * Apply pulsing urgency effects for critical/danger states
     */
    private applyUrgencyEffects(progress: number, gridLineColor: THREE.Color): void {
        if (progress < STAGE_COLOR_THRESHOLDS.CRITICAL) {
            const urgencyIntensity = 1.0 - (progress / STAGE_COLOR_THRESHOLDS.CRITICAL);
            const urgencyColor = progress < STAGE_COLOR_THRESHOLDS.DANGER
                ? urgencyColorRed
                : urgencyColorOrange;

            if (progress < STAGE_COLOR_THRESHOLDS.DANGER) {
                // Extreme danger - pulsing effects
                const pulseIntensity = 0.3 + Math.sin(Date.now() * 0.01) * 0.2;
                this.deps.fillLight.color.copy(urgencyColor);
                this.deps.fillLight.intensity = pulseIntensity * urgencyIntensity;

                const edgePulse = 0.3 + Math.sin(Date.now() * 0.015) * 0.25;
                if (this.deps.platformEdgeMaterial) {
                    this.deps.platformEdgeMaterial.emissiveIntensity = edgePulse;
                }
                if (this.deps.platformCornerMaterial) {
                    this.deps.platformCornerMaterial.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.015) * 0.3;
                }

                const gridPulse = 0.5 + Math.sin(Date.now() * 0.012) * 0.3;
                this.deps.gridLineMaterial.emissiveIntensity = gridPulse;
                this.updateGridLineEmissive(gridPulse);
            } else {
                // Critical - steady urgency
                this.deps.fillLight.color.copy(urgencyColorOrange);
                this.deps.fillLight.intensity = 0.2 * urgencyIntensity;

                if (this.deps.platformEdgeMaterial) {
                    this.deps.platformEdgeMaterial.emissiveIntensity = 0.15;
                }
                if (this.deps.platformCornerMaterial) {
                    this.deps.platformCornerMaterial.emissiveIntensity = 0.3;
                }
                this.deps.gridLineMaterial.emissiveIntensity = 0.4;
                this.updateGridLineEmissive(0.4);
            }
        } else {
            // Normal state
            this.deps.fillLight.color.set(0x4466aa);
            this.deps.fillLight.intensity = 0.4;

            if (this.deps.platformEdgeMaterial) {
                this.deps.platformEdgeMaterial.emissiveIntensity = 0.15;
            }
            if (this.deps.platformCornerMaterial) {
                this.deps.platformCornerMaterial.emissiveIntensity = 0.3;
            }
            this.deps.gridLineMaterial.emissiveIntensity = 0.4;
            this.updateGridLineEmissive(0.4);
        }
    }

    /**
     * Update grid line children colors
     */
    private updateGridLineChildren(color: THREE.Color): void {
        if (this.deps.gridLines) {
            this.deps.gridLines.children.forEach((line): void => {
                if (line instanceof THREE.Mesh && line.material) {
                    (line.material as THREE.MeshStandardMaterial).color.copy(color);
                    (line.material as THREE.MeshStandardMaterial).emissive.copy(color);
                }
            });
        }
    }

    /**
     * Update grid line emissive intensity
     */
    private updateGridLineEmissive(intensity: number): void {
        if (this.deps.gridLines) {
            this.deps.gridLines.children.forEach((line): void => {
                if (line instanceof THREE.Mesh && line.material) {
                    (line.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
                }
            });
        }
    }

    /**
     * Reset all stage colors to original state
     */
    reset(): void {
        this.currentProgress = 1.0;

        if (this.deps.scene.fog) {
            (this.deps.scene.fog as THREE.FogExp2).color.copy(this.originalColors.fog);
        }
        this.deps.groundMaterial.color.copy(this.originalColors.ground);
        this.deps.ambientLight.color.copy(this.originalColors.ambient);
        this.deps.cyanLight.intensity = this.originalColors.cyanIntensity;
        this.deps.magentaLight.intensity = this.originalColors.magentaIntensity;
        this.deps.fillLight.color.set(0x4466aa);
        this.deps.fillLight.intensity = 0.4;

        if (this.deps.platformEdgeMaterial) {
            this.deps.platformEdgeMaterial.color.copy(this.originalColors.platformAccent);
            this.deps.platformEdgeMaterial.emissive.copy(this.originalColors.platformAccent);
            this.deps.platformEdgeMaterial.emissiveIntensity = 0.15;
        }
        if (this.deps.platformCornerMaterial) {
            this.deps.platformCornerMaterial.color.copy(this.originalColors.platformAccent);
            this.deps.platformCornerMaterial.emissive.copy(this.originalColors.platformAccent);
            this.deps.platformCornerMaterial.emissiveIntensity = 0.3;
        }

        this.deps.gridLineMaterial.color.copy(this.originalColors.gridLine);
        this.deps.gridLineMaterial.emissive.copy(this.originalColors.gridLine);
        this.deps.gridLineMaterial.emissiveIntensity = 0.4;

        if (this.deps.gridLines) {
            this.deps.gridLines.children.forEach((line): void => {
                if (line instanceof THREE.Mesh && line.material) {
                    (line.material as THREE.MeshStandardMaterial).color.copy(this.originalColors.gridLine);
                    (line.material as THREE.MeshStandardMaterial).emissive.copy(this.originalColors.gridLine);
                    (line.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;
                }
            });
        }
    }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createStageColorManager(deps: StageColorDependencies): StageColorManager {
    return new StageColorManager(deps);
}
