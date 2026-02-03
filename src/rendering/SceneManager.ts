/**
 * SceneManager - Three.js scene setup, camera, lights, and controls
 * Centralized scene management for the 3D Tic-Tac-Toe game
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { materials } from './Materials';

// ============================================================================
// Types
// ============================================================================

export interface CameraPosition {
    y: number;
    z: number;
    fov: number;
    minDist: number;
}

export interface SceneComponents {
    canvas: HTMLCanvasElement;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    lights: {
        ambient: THREE.AmbientLight;
        hemi: THREE.HemisphereLight;
        main: THREE.DirectionalLight;
        fill: THREE.DirectionalLight;
        cyan: THREE.PointLight;
        magenta: THREE.PointLight;
        rim: THREE.SpotLight;
        top: THREE.SpotLight;
    };
    boardGroup: THREE.Group;
    groundPlane: THREE.Mesh;
}

// ============================================================================
// Camera Configuration
// ============================================================================

export const CAMERA_POSITIONS: {
    desktop: CameraPosition;
    mobile: CameraPosition;
} = {
    desktop: { y: 8, z: 10, fov: 45, minDist: 8 },
    mobile: { y: 12, z: 18, fov: 55, minDist: 12 }
};

// ============================================================================
// Helper Functions
// ============================================================================

export function createGradientDataURL(color1: number, color2: number): string {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const gradient = ctx.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, `#${color1.toString(16).padStart(6, '0')}`);
    gradient.addColorStop(1, `#${color2.toString(16).padStart(6, '0')}`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL();
}

export function isMobileDevice(): boolean {
    return window.innerWidth < 768 || window.innerWidth < window.innerHeight;
}

// ============================================================================
// Scene Initialization
// ============================================================================

export function initializeScene(canvasId: string = 'game-canvas'): SceneComponents {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    // Initial camera position
    const isMobile = isMobileDevice();
    const pos = isMobile ? CAMERA_POSITIONS.mobile : CAMERA_POSITIONS.desktop;
    camera.position.set(0, pos.y, pos.z);
    camera.fov = pos.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = pos.minDist;

    // Lights
    const lights = createLights(scene);

    // Environment map
    setupEnvironment(scene, renderer);

    // Fog
    scene.fog = new THREE.FogExp2(0x050510, 0.025);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundPlane = new THREE.Mesh(groundGeometry, materials.ground);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.5;
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    // Board group
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    return {
        canvas,
        scene,
        camera,
        renderer,
        controls,
        lights,
        boardGroup,
        groundPlane
    };
}

// ============================================================================
// Lighting Setup
// ============================================================================

function createLights(scene: THREE.Scene) {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x1a1a2e, 0.4);
    scene.add(ambient);

    // Hemisphere light
    const hemi = new THREE.HemisphereLight(0x0a0a1a, 0x000000, 0.3);
    scene.add(hemi);

    // Main directional light
    const main = new THREE.DirectionalLight(0xffffff, 1.2);
    main.position.set(5, 12, 7);
    main.castShadow = true;
    main.shadow.mapSize.width = 4096;
    main.shadow.mapSize.height = 4096;
    main.shadow.camera.near = 0.5;
    main.shadow.camera.far = 50;
    main.shadow.camera.left = -10;
    main.shadow.camera.right = 10;
    main.shadow.camera.top = 10;
    main.shadow.camera.bottom = -10;
    main.shadow.bias = -0.0001;
    main.shadow.normalBias = 0.02;
    main.shadow.radius = 2;
    scene.add(main);

    // Fill light
    const fill = new THREE.DirectionalLight(0x4466aa, 0.4);
    fill.position.set(-5, 8, -5);
    scene.add(fill);

    // Cyan accent light
    const cyan = new THREE.PointLight(0x00f5ff, 0.6, 25);
    cyan.position.set(-4, 4, -4);
    cyan.castShadow = true;
    cyan.shadow.mapSize.width = 1024;
    cyan.shadow.mapSize.height = 1024;
    cyan.shadow.bias = -0.001;
    scene.add(cyan);

    // Magenta accent light
    const magenta = new THREE.PointLight(0xff00aa, 0.5, 25);
    magenta.position.set(4, 4, 4);
    magenta.castShadow = true;
    magenta.shadow.mapSize.width = 1024;
    magenta.shadow.mapSize.height = 1024;
    magenta.shadow.bias = -0.001;
    scene.add(magenta);

    // Rim light
    const rim = new THREE.SpotLight(0x6644ff, 0.8, 30, Math.PI / 6, 0.5);
    rim.position.set(0, 8, -8);
    rim.target.position.set(0, 0, 0);
    scene.add(rim);
    scene.add(rim.target);

    // Top spotlight
    const top = new THREE.SpotLight(0xffeedd, 8.0, 40, Math.PI / 5, 0.25, 1.0);
    top.position.set(8, 10, 8);
    top.target.position.set(0, 0, 0);
    top.castShadow = true;
    top.shadow.mapSize.width = 2048;
    top.shadow.mapSize.height = 2048;
    top.shadow.bias = -0.0001;
    scene.add(top);
    scene.add(top.target);

    return { ambient, hemi, main, fill, cyan, magenta, rim, top };
}

// ============================================================================
// Environment Setup
// ============================================================================

function setupEnvironment(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
    // Create environment cube map (used for reflections)
    new THREE.CubeTextureLoader().load([
        createGradientDataURL(0x0a0a1a, 0x00f5ff),
        createGradientDataURL(0x0a0a1a, 0xff00aa),
        createGradientDataURL(0x1a1a3a, 0x2a2a4a),
        createGradientDataURL(0x000000, 0x0a0a1a),
        createGradientDataURL(0x0a0a1a, 0x00f5ff),
        createGradientDataURL(0x0a0a1a, 0xff00aa)
    ]);

    // PMREM environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    const envGeometry = new THREE.SphereGeometry(50, 32, 32);
    const envMaterial = new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        vertexColors: true
    });

    const colors: number[] = [];
    const positions = envGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        const t = (y + 50) / 100;
        colors.push(
            THREE.MathUtils.lerp(0.02, 0.04, t),
            THREE.MathUtils.lerp(0.02, 0.03, t),
            THREE.MathUtils.lerp(0.05, 0.12, t)
        );
    }
    envGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const envMesh = new THREE.Mesh(envGeometry, envMaterial);
    envScene.add(envMesh);

    const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
}

// ============================================================================
// Camera Utilities
// ============================================================================

export function adjustCameraForDevice(
    camera: THREE.PerspectiveCamera,
    controls?: OrbitControls
): void {
    const isMobile = isMobileDevice();
    const pos = isMobile ? CAMERA_POSITIONS.mobile : CAMERA_POSITIONS.desktop;

    camera.position.set(0, pos.y, pos.z);
    camera.fov = pos.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);

    if (controls && controls.minDistance !== undefined) {
        controls.minDistance = pos.minDist;
    }
}

export function handleWindowResize(
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    controls?: OrbitControls
): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    adjustCameraForDevice(camera, controls);
}
