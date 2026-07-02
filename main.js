// three.js scene driven by Box3D physics (Erin Catto's engine, wasm build).
//
// ?threads=4     use the threaded box3d build with 4 solver workers
// ?bodies=500    initial pile size
// click          shoot a heavy ball from the camera
// b              drop another wave of bodies

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = new URLSearchParams(location.search);
const workerCount = Math.max(0, parseInt(params.get('threads') || '0', 10));
const initialBodies = Math.max(1, parseInt(params.get('bodies') || '400', 10));

const { default: Box3D } = workerCount > 0 ? await import('box3d/deluxe') : await import('box3d');
const b3 = await Box3D();

const DT = 1 / 60;
const SUBSTEPS = 4;

// physics world
const world = new b3.World({
  gravity: { x: 0, y: -10, z: 0 },
  workerCount: workerCount || 1,
});

// three.js boilerplate
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e14);
scene.fog = new THREE.Fog(0x0b0e14, 60, 140);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
camera.position.set(18, 14, 22);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0x8899cc, 0x223311, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(25, 40, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.camera.far = 120;
scene.add(sun);

// tag -> mesh, updated from body move events
const meshByTag = new Map();
let bodyCount = 0;

function track(body, mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const p = body.getPosition();
  const q = body.getRotation();
  mesh.position.set(p.x, p.y, p.z);
  mesh.quaternion.set(q.x, q.y, q.z, q.w);
  meshByTag.set(body.getUserData(), mesh);
  bodyCount++;
}

// ground
{
  const ground = world.createBody({ type: 'static', position: { x: 0, y: -1, z: 0 } });
  ground.createBox({ halfExtents: { x: 30, y: 1, z: 30 }, friction: 0.7 });
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(60, 2, 60),
    new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 }),
  );
  mesh.position.set(0, -1, 0);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

const palette = [0xf38ba8, 0xfab387, 0xf9e2af, 0xa6e3a1, 0x89b4fa, 0xcba6f7, 0x94e2d5];
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

function spawnBody(x, y, z) {
  const body = world.createBody({ type: 'dynamic', position: { x, y, z } });
  const material = new THREE.MeshStandardMaterial({
    color: palette[Math.floor(Math.random() * palette.length)],
    roughness: 0.55,
  });

  const kind = Math.random();
  let mesh;
  if (kind < 0.45) {
    const hx = rand(0.25, 0.6), hy = rand(0.25, 0.6), hz = rand(0.25, 0.6);
    body.createBox({ halfExtents: { x: hx, y: hy, z: hz }, density: 1, friction: 0.5 });
    mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), material);
  } else if (kind < 0.8) {
    const r = rand(0.25, 0.5);
    body.createSphere({ radius: r, density: 1, friction: 0.4, restitution: 0.3 });
    mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), material);
  } else {
    const r = rand(0.2, 0.35);
    const h = rand(0.5, 1.0);
    body.createCapsule({ height: h, radius: r, density: 1, friction: 0.5 });
    mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 8, 16), material);
  }
  track(body, mesh);
}

function spawnWave(count) {
  const side = Math.ceil(Math.cbrt(count));
  let n = 0;
  for (let i = 0; i < count; i++) {
    const gx = (i % side) - side / 2;
    const gz = (Math.floor(i / side) % side) - side / 2;
    const gy = Math.floor(i / (side * side));
    spawnBody(gx * 1.4 + rand(-0.1, 0.1), 6 + gy * 1.4, gz * 1.4 + rand(-0.1, 0.1));
    n++;
  }
  return n;
}

spawnWave(initialBodies);

// click to shoot a heavy ball from the camera
addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const from = camera.position.clone().addScaledVector(dir, 2);
  const body = world.createBody({
    type: 'dynamic',
    position: { x: from.x, y: from.y, z: from.z },
    linearVelocity: { x: dir.x * 40, y: dir.y * 40, z: dir.z * 40 },
    isBullet: true,
  });
  body.createSphere({ radius: 0.6, density: 8, friction: 0.4, restitution: 0.4 });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.6 }),
  );
  track(body, mesh);
});

addEventListener('keydown', (e) => {
  if (e.key === 'b') spawnWave(50);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// main loop: fixed physics timestep, render whenever
const hud = document.getElementById('hud');
let accumulator = 0;
let last = performance.now();
let physicsMs = 0;
let frames = 0;
let fps = 0;
let fpsLast = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, 0.1);
  last = now;

  const t0 = performance.now();
  let stepped = false;
  while (accumulator >= DT) {
    world.step(DT, SUBSTEPS);
    accumulator -= DT;
    stepped = true;
  }
  if (stepped) {
    physicsMs = physicsMs * 0.9 + (performance.now() - t0) * 0.1;
    for (const e of world.getBodyEvents()) {
      const mesh = meshByTag.get(e.userData);
      if (mesh) {
        mesh.position.set(e.position.x, e.position.y, e.position.z);
        mesh.quaternion.set(e.rotation.x, e.rotation.y, e.rotation.z, e.rotation.w);
      }
    }
  }

  controls.update();
  renderer.render(scene, camera);

  frames++;
  if (now - fpsLast > 500) {
    fps = Math.round((frames * 1000) / (now - fpsLast));
    frames = 0;
    fpsLast = now;
    const mode = b3.threaded ? `threads: ${world.getWorkerCount()}` : 'single threaded';
    hud.textContent =
      `Box3D by Erin Catto, wasm build (${mode})\n` +
      `bodies: ${bodyCount}  awake: ${world.getAwakeBodyCount()}\n` +
      `physics: ${physicsMs.toFixed(2)} ms/frame  render: ${fps} fps\n` +
      `click: shoot ball   b: drop 50 more`;
  }
}

requestAnimationFrame(frame);
