// three.js demo scenes driven by Box3D physics (Erin Catto's engine, wasm
// build), in the spirit of the upstream Box3D samples.
//
// The default box3d-wasm import auto-detects thread support: it loads the
// threaded build when the page is cross-origin isolated (this demo's server
// sends the headers) and falls back to the single threaded build otherwise.
//
// ?scene=ragdolls  start on a specific scene (playground, pyramid, ragdolls)
// ?threads=4       solver worker count when the threaded build loads
// ?threads=0       force the single threaded build (skip auto-detection)
// click            scene action: rain shapes, fire cannonball, drop a ragdoll
// shift+click      always fires a cannonball from the camera
// double click     explosion at the clicked point
// b                another wave of the scene's spawnable

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const params = new URLSearchParams(location.search);
const threadsParam = params.get('threads');

const { default: Box3D } =
  threadsParam === '0' ? await import('box3d-wasm/standard') : await import('box3d-wasm');
const b3 = await Box3D();

const workerCount = b3.threaded
  ? Math.max(1, parseInt(threadsParam || '', 10) || Math.min(8, navigator.hardwareConcurrency || 4))
  : 1;

const DT = 1 / 60;
const SUBSTEPS = 4;

// ---------------------------------------------------------------------------
// three.js setup
// ---------------------------------------------------------------------------

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

// leave right-click alone: OrbitControls suppresses the context menu for
// right-drag panning, but people should be able to open devtools. The
// window-level capture listener runs before the canvas handler and stops
// the suppression; panning stays available on middle-drag and touch.
controls.mouseButtons.RIGHT = null;
addEventListener('contextmenu', (e) => e.stopPropagation(), true);

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

const palette = [0xf38ba8, 0xfab387, 0xf9e2af, 0xa6e3a1, 0x89b4fa, 0xcba6f7, 0x94e2d5];
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------------
// world lifecycle: one physics world per scene, meshes synced by userData tag
// ---------------------------------------------------------------------------

let world = null;
const meshByTag = new Map();
const bodyByTag = new Map();
const sceneMeshes = [];
let bodyCount = 0;

function track(body, mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  sceneMeshes.push(mesh);
  const p = body.getPosition();
  const q = body.getRotation();
  mesh.position.set(p.x, p.y, p.z);
  mesh.quaternion.set(q.x, q.y, q.z, q.w);
  meshByTag.set(body.getUserData(), mesh);
  bodyByTag.set(body.getUserData(), body);
  bodyCount++;
}

function addStaticMesh(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  sceneMeshes.push(mesh);
}

function resetWorld() {
  if (world) {
    world.destroy();
    world.delete();
  }
  for (const mesh of sceneMeshes) {
    scene.remove(mesh);
    mesh.geometry.dispose();
  }
  sceneMeshes.length = 0;
  meshByTag.clear();
  bodyByTag.clear();
  bodyCount = 0;

  world = new b3.World({ gravity: { x: 0, y: -10, z: 0 }, workerCount });

  const ground = world.createBody({ type: 'static', position: { x: 0, y: -1, z: 0 } });
  ground.createBox({ halfExtents: { x: 30, y: 1, z: 30 }, friction: 0.7 });
  const groundMesh = new THREE.Mesh(
    new THREE.BoxGeometry(60, 2, 60),
    new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 }),
  );
  groundMesh.position.set(0, -1, 0);
  addStaticMesh(groundMesh);
}

// ---------------------------------------------------------------------------
// spawnables
// ---------------------------------------------------------------------------

function spawnShape(x, y, z) {
  const body = world.createBody({ type: 'dynamic', position: { x, y, z } });
  const material = new THREE.MeshStandardMaterial({ color: pick(palette), roughness: 0.55 });

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

function rainShapes(at, count) {
  for (let i = 0; i < count; i++) {
    spawnShape(at.x + rand(-1.2, 1.2), 12 + rand(0, 3) + i * 0.8, at.z + rand(-1.2, 1.2));
  }
}

function shootBall(target) {
  const dir = new THREE.Vector3();
  if (target) {
    // aim from the camera at the clicked point (slightly above the ground
    // so the ball arcs into the target instead of skimming)
    dir.set(target.x, (target.y || 0) + 0.75, target.z).sub(camera.position).normalize();
  } else {
    camera.getWorldDirection(dir);
  }
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
}

// a jointed human, in the spirit of the upstream samples' ragdolls.
// Each ragdoll gets a unique negative filter group so it never collides
// with itself, which is exactly what Box3D's groupIndex is for.
let nextRagdollGroup = -1;
const qZtoX = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }; // hinge about world x
const qZtoNegY = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }; // cone about hanging limb

function spawnRagdoll(x, y, z) {
  const group = nextRagdollGroup--;
  const skin = pick(palette);
  const material = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.5 });

  function part(px, py, pz, radius, height, density) {
    const body = world.createBody({
      type: 'dynamic',
      position: { x: x + px, y: y + py, z: z + pz },
    });
    body.createCapsule({ height, radius, density, friction: 0.5, filter: { groupIndex: group } });
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, height, 6, 12), material);
    track(body, mesh);
    return body;
  }

  // body parts, standing pose, feet at local y=0
  const pelvis = part(0, 1.0, 0, 0.14, 0.1, 1.2);
  const torso = part(0, 1.35, 0, 0.15, 0.3, 1.0);
  const head = part(0, 1.72, 0, 0.11, 0.05, 0.8);
  const upperLegL = part(-0.1, 0.72, 0, 0.07, 0.32, 1.0);
  const upperLegR = part(0.1, 0.72, 0, 0.07, 0.32, 1.0);
  const lowerLegL = part(-0.1, 0.32, 0, 0.06, 0.3, 1.0);
  const lowerLegR = part(0.1, 0.32, 0, 0.06, 0.3, 1.0);
  const upperArmL = part(-0.26, 1.38, 0, 0.05, 0.24, 0.8);
  const upperArmR = part(0.26, 1.38, 0, 0.05, 0.24, 0.8);
  const lowerArmL = part(-0.26, 1.05, 0, 0.045, 0.24, 0.8);
  const lowerArmR = part(0.26, 1.05, 0, 0.045, 0.24, 0.8);

  const socket = (a, b, anchorA, anchorB, cone) =>
    world.createSphericalJoint(a, b, {
      anchorA,
      anchorB,
      localFrameA: { rotation: qZtoNegY },
      localFrameB: { rotation: qZtoNegY },
      enableConeLimit: true,
      coneAngle: cone,
      enableTwistLimit: true,
      lowerTwistAngle: -0.3,
      upperTwistAngle: 0.3,
    });

  const hinge = (a, b, anchorA, anchorB, lo, hi) =>
    world.createRevoluteJoint(a, b, {
      anchorA,
      anchorB,
      localFrameA: { rotation: qZtoX },
      localFrameB: { rotation: qZtoX },
      enableLimit: true,
      lowerAngle: lo,
      upperAngle: hi,
    });

  // spine and neck
  socket(pelvis, torso, { x: 0, y: 0.15, z: 0 }, { x: 0, y: -0.2, z: 0 }, 0.4);
  socket(torso, head, { x: 0, y: 0.22, z: 0 }, { x: 0, y: -0.12, z: 0 }, 0.5);
  // hips and knees
  socket(pelvis, upperLegL, { x: -0.1, y: -0.1, z: 0 }, { x: 0, y: 0.2, z: 0 }, 0.7);
  socket(pelvis, upperLegR, { x: 0.1, y: -0.1, z: 0 }, { x: 0, y: 0.2, z: 0 }, 0.7);
  hinge(upperLegL, lowerLegL, { x: 0, y: -0.2, z: 0 }, { x: 0, y: 0.19, z: 0 }, 0, 2.2);
  hinge(upperLegR, lowerLegR, { x: 0, y: -0.2, z: 0 }, { x: 0, y: 0.19, z: 0 }, 0, 2.2);
  // shoulders and elbows
  socket(torso, upperArmL, { x: -0.18, y: 0.15, z: 0 }, { x: 0, y: 0.16, z: 0 }, 1.2);
  socket(torso, upperArmR, { x: 0.18, y: 0.15, z: 0 }, { x: 0, y: 0.16, z: 0 }, 1.2);
  hinge(upperArmL, lowerArmL, { x: 0, y: -0.16, z: 0 }, { x: 0, y: 0.16, z: 0 }, -2.2, 0);
  hinge(upperArmR, lowerArmR, { x: 0, y: -0.16, z: 0 }, { x: 0, y: 0.16, z: 0 }, -2.2, 0);

  // a tumble on the way down
  torso.setAngularVelocity({ x: rand(-3, 3), y: rand(-2, 2), z: rand(-3, 3) });
}

// ---------------------------------------------------------------------------
// joint toys for the playground
// ---------------------------------------------------------------------------

function buildToys() {
  // quarter turn about x: maps the joint frame z-axis onto world y, so a
  // revolute joint spins in the horizontal plane
  const qZtoY = { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };

  // motorized windmill that flings whatever lands near it
  const post = world.createBody({ type: 'static', position: { x: -8, y: 1.1, z: 0 } });
  post.createBox({ halfExtents: { x: 0.25, y: 1.1, z: 0.25 } });
  const postMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 2.2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.6 }),
  );
  postMesh.position.set(-8, 1.1, 0);
  addStaticMesh(postMesh);

  const rotor = world.createBody({ type: 'dynamic', position: { x: -8, y: 2.4, z: 0 } });
  rotor.createBox({ halfExtents: { x: 4, y: 0.15, z: 0.35 }, density: 2 });
  const rotorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.3, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xf9e2af, roughness: 0.4 }),
  );
  track(rotor, rotorMesh);

  world.createRevoluteJoint(post, rotor, {
    localFrameA: { position: { x: 0, y: 1.3, z: 0 }, rotation: qZtoY },
    localFrameB: { position: { x: 0, y: 0, z: 0 }, rotation: qZtoY },
    enableMotor: true,
    motorSpeed: 2.0,
    maxMotorTorque: 800,
  });

  // wrecking ball on a chain of spherical joints, released with a swing
  const anchor = world.createBody({ type: 'static', position: { x: 8, y: 12, z: 0 } });
  const linkCount = 6;
  let prev = anchor;
  for (let i = 0; i < linkCount; i++) {
    const link = world.createBody({ type: 'dynamic', position: { x: 8, y: 11.5 - i, z: 0 } });
    link.createCapsule({ height: 0.7, radius: 0.15, density: 2 });
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.15, 0.7, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x9399b2, roughness: 0.4, metalness: 0.5 }),
    );
    track(link, mesh);
    world.createSphericalJoint(prev, link, {
      anchorA: prev === anchor ? { x: 0, y: 0, z: 0 } : { x: 0, y: -0.5, z: 0 },
      anchorB: { x: 0, y: 0.5, z: 0 },
    });
    prev = link;
  }
  const ball = world.createBody({
    type: 'dynamic',
    position: { x: 8, y: 11.5 - linkCount - 0.6, z: 0 },
    linearVelocity: { x: -8, y: 0, z: 0 },
  });
  ball.createSphere({ radius: 0.9, density: 12, friction: 0.4 });
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xb4befe, roughness: 0.25, metalness: 0.7 }),
  );
  track(ball, ballMesh);
  world.createSphericalJoint(prev, ball, {
    anchorA: { x: 0, y: -0.5, z: 0 },
    anchorB: { x: 0, y: 0.9, z: 0 },
  });

  // seesaw on a limited revolute hinge
  const pivot = world.createBody({ type: 'static', position: { x: 0, y: 0.6, z: -9 } });
  pivot.createBox({ halfExtents: { x: 0.3, y: 0.6, z: 0.3 } });
  const pivotMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.2, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.6 }),
  );
  pivotMesh.position.set(0, 0.6, -9);
  addStaticMesh(pivotMesh);

  const plank = world.createBody({ type: 'dynamic', position: { x: 0, y: 1.35, z: -9 } });
  plank.createBox({ halfExtents: { x: 4, y: 0.15, z: 1 }, density: 1, friction: 0.7 });
  const plankMesh = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.3, 2),
    new THREE.MeshStandardMaterial({ color: 0xa6e3a1, roughness: 0.5 }),
  );
  track(plank, plankMesh);

  world.createRevoluteJoint(pivot, plank, {
    localFrameA: { position: { x: 0, y: 0.75, z: 0 } },
    localFrameB: { position: { x: 0, y: 0, z: 0 } },
    enableLimit: true,
    lowerAngle: -0.35,
    upperAngle: 0.35,
  });

  for (let i = 0; i < 3; i++) {
    spawnShape(3 + rand(-0.2, 0.2), 3 + i * 1.2, -9 + rand(-0.2, 0.2));
  }
}

// ---------------------------------------------------------------------------
// scenes
// ---------------------------------------------------------------------------

const SCENES = {
  playground: {
    label: 'Playground',
    help: 'click: rain shapes',
    build() {
      buildToys();
      const side = 6;
      for (let i = 0; i < 150; i++) {
        const gx = (i % side) - side / 2;
        const gz = (Math.floor(i / side) % side) - side / 2;
        const gy = Math.floor(i / (side * side));
        spawnShape(gx * 1.3 + rand(-0.1, 0.1), 6 + gy * 1.3, gz * 1.3 + rand(-0.1, 0.1));
      }
    },
    onClick(at) {
      rainShapes(at, 8);
    },
    onWave() {
      rainShapes({ x: 0, z: 0 }, 50);
    },
  },

  pyramid: {
    label: 'Pyramid',
    help: 'click: cannonball',
    build() {
      const h = 0.5;
      const rows = 12;
      for (let row = 0; row < rows; row++) {
        const cols = rows - row;
        for (let c = 0; c < cols; c++) {
          const body = world.createBody({
            type: 'dynamic',
            position: { x: (c - cols / 2) * (h * 2 + 0.02) + h, y: h + row * h * 2, z: 0 },
          });
          body.createBox({ halfExtents: { x: h, y: h, z: h }, density: 1, friction: 0.6 });
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(h * 2, h * 2, h * 2),
            new THREE.MeshStandardMaterial({ color: palette[row % palette.length], roughness: 0.55 }),
          );
          track(body, mesh);
        }
      }
    },
    onClick(at) {
      shootBall(at);
    },
    onWave() {
      rainShapes({ x: 0, z: 0 }, 25);
    },
  },

  ragdolls: {
    label: 'Ragdolls',
    help: 'click: drop a ragdoll',
    build() {
      for (let i = 0; i < 8; i++) {
        spawnRagdoll(rand(-6, 6), 6 + i * 2.5, rand(-4, 4));
      }
    },
    onClick(at) {
      spawnRagdoll(at.x, 10, at.z);
    },
    onWave() {
      for (let i = 0; i < 5; i++) {
        spawnRagdoll(rand(-6, 6), 8 + i * 3, rand(-4, 4));
      }
    },
  },
};

// drivable buggy state (Driving scene)
const drive = { active: false, wheels: [], steer: [] };
const pressed = new Set();

function buildBuggy(x, y, z) {
  // chassis faces +x; wheel joints: suspension along frame A x (mapped to
  // world y), spin about frame B z (the axle, world z)
  const qXtoY = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };

  // sleep stays off so motor changes always take effect immediately
  const chassis = world.createBody({ type: 'dynamic', position: { x, y, z }, enableSleep: false });
  chassis.createBox({ halfExtents: { x: 0.9, y: 0.2, z: 0.5 }, density: 4, friction: 0.3 });
  const chassisMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.4, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xf38ba8, roughness: 0.35, metalness: 0.3 }),
  );
  track(chassis, chassisMesh);

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e1e2e, roughness: 0.9 });
  for (const [wx, wz, steers] of [
    [0.7, 0.62, true],
    [0.7, -0.62, true],
    [-0.7, 0.62, false],
    [-0.7, -0.62, false],
  ]) {
    const wheel = world.createBody({
      type: 'dynamic',
      position: { x: x + wx, y: y - 0.25, z: z + wz },
      allowFastRotation: true,
      enableSleep: false,
    });
    wheel.createSphere({ radius: 0.35, density: 2, friction: 1.2, rollingResistance: 0.05 });
    track(wheel, new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), wheelMat));

    const joint = world.createWheelJoint(chassis, wheel, {
      localFrameA: { position: { x: wx, y: -0.25, z: wz }, rotation: qXtoY },
      localFrameB: { position: { x: 0, y: 0, z: 0 } },
      enableSuspensionSpring: true,
      suspensionHertz: 4,
      suspensionDampingRatio: 0.7,
      enableSuspensionLimit: true,
      lowerSuspensionLimit: -0.25,
      upperSuspensionLimit: 0.1,
      enableSpinMotor: true,
      maxSpinTorque: 60,
      enableSteering: steers,
      steeringHertz: 8,
      steeringDampingRatio: 1,
      maxSteeringTorque: 80,
      enableSteeringLimit: true,
      lowerSteeringLimit: -0.5,
      upperSteeringLimit: 0.5,
    });
    drive.wheels.push(joint);
    if (steers) drive.steer.push(joint);
  }
}

function updateDrive() {
  if (!drive.active) return;
  const forward = (pressed.has('ArrowUp') || pressed.has('w') ? 1 : 0) -
    (pressed.has('ArrowDown') || pressed.has('s') ? 1 : 0);
  const turn = (pressed.has('ArrowLeft') || pressed.has('a') ? 1 : 0) -
    (pressed.has('ArrowRight') || pressed.has('d') ? 1 : 0);
  for (const joint of drive.wheels) {
    // negative spin drives the chassis toward +x (its nose)
    joint.setSpinMotorSpeed(forward * -25);
  }
  for (const joint of drive.steer) {
    joint.setTargetSteeringAngle(turn * 0.45);
  }
}

SCENES.dominoes = {
  label: 'Dominoes',
  help: 'click: cannonball',
  build() {
    // constant arc-length spacing along the spiral so every domino is within
    // toppling reach of the next; thin axis (local z) along the tangent so
    // each domino faces the next one and the chain propagates
    const totalAngle = Math.PI * 5;
    const spacing = 1.1;
    let angle = 0;
    let i = 0;
    while (angle < totalAngle && i < 200) {
      const radius = 14 - (angle / totalAngle) * 10;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;
      const body = world.createBody({
        type: 'dynamic',
        position: { x: px, y: 0.75, z: pz },
        rotation: { x: 0, y: Math.sin(-angle / 2), z: 0, w: Math.cos(-angle / 2) },
      });
      body.createBox({ halfExtents: { x: 0.45, y: 0.75, z: 0.09 }, density: 1, friction: 0.4 });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.5, 0.18),
        new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 0.5 }),
      );
      track(body, mesh);
      angle += spacing / radius;
      i++;
    }
  },
  onClick(at) {
    shootBall(at);
  },
  onWave() {
    rainShapes({ x: 0, z: 0 }, 20);
  },
};

SCENES.bridge = {
  label: 'Bridge',
  help: 'click: rain shapes on the bridge',
  build() {
    const plankCount = 14;
    const plankHalf = 0.55;
    const gapStart = -plankCount * plankHalf;
    const deckY = 5;

    const makeTower = (tx) => {
      const tower = world.createBody({ type: 'static', position: { x: tx, y: deckY / 2, z: 0 } });
      tower.createBox({ halfExtents: { x: 1, y: deckY / 2, z: 2 } });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2, deckY, 4),
        new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.7 }),
      );
      mesh.position.set(tx, deckY / 2, 0);
      addStaticMesh(mesh);
      return tower;
    };
    const towerA = makeTower(gapStart - 1);
    const towerB = makeTower(-gapStart + 1);

    let prev = towerA;
    let prevAnchor = { x: 1, y: deckY / 2, z: 0 };
    for (let i = 0; i < plankCount; i++) {
      const px = gapStart + plankHalf + i * plankHalf * 2;
      const plank = world.createBody({ type: 'dynamic', position: { x: px, y: deckY, z: 0 } });
      plank.createBox({ halfExtents: { x: plankHalf - 0.03, y: 0.1, z: 1.5 }, density: 1.5, friction: 0.7 });
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry((plankHalf - 0.03) * 2, 0.2, 3),
        new THREE.MeshStandardMaterial({ color: 0xfab387, roughness: 0.6 }),
      );
      track(plank, mesh);
      world.createRevoluteJoint(prev, plank, {
        anchorA: prevAnchor,
        anchorB: { x: -plankHalf, y: 0, z: 0 },
      });
      prev = plank;
      prevAnchor = { x: plankHalf, y: 0, z: 0 };
    }
    world.createRevoluteJoint(prev, towerB, {
      anchorA: { x: plankHalf, y: 0, z: 0 },
      anchorB: { x: -1, y: deckY / 2, z: 0 },
    });
  },
  onClick(at) {
    rainShapes({ x: at.x, z: at.z }, 6);
  },
  onWave() {
    rainShapes({ x: 0, z: 0 }, 25);
  },
};

SCENES.driving = {
  label: 'Driving',
  help: 'drive: arrows or wasd   click: rain obstacles',
  build() {
    drive.active = true;
    buildBuggy(0, 1.2, 6);
    // ramp
    const ramp = world.createBody({
      type: 'static',
      position: { x: -8, y: 0.8, z: -4 },
      rotation: { x: 0, y: 0, z: Math.sin(0.15), w: Math.cos(0.15) },
    });
    ramp.createBox({ halfExtents: { x: 4, y: 0.15, z: 3 } });
    const rampMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.3, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.7 }),
    );
    rampMesh.position.set(-8, 0.8, -4);
    rampMesh.setRotationFromQuaternion(new THREE.Quaternion(0, 0, Math.sin(0.15), Math.cos(0.15)));
    addStaticMesh(rampMesh);
    // obstacles to plow through
    for (let i = 0; i < 40; i++) {
      spawnShape(rand(-10, 10), 1 + (i % 4), rand(-12, 2));
    }
  },
  onClick(at) {
    rainShapes(at, 6);
  },
  onWave() {
    rainShapes({ x: 0, z: 0 }, 20);
  },
};

let currentScene = SCENES[params.get('scene')] ? params.get('scene') : 'playground';

function loadScene(name) {
  currentScene = name;
  drive.active = false;
  drive.wheels.length = 0;
  drive.steer.length = 0;
  resetWorld();
  SCENES[name].build();
  for (const btn of document.querySelectorAll('#menu button')) {
    btn.classList.toggle('active', btn.dataset.scene === name);
  }
}

// scene menu
const menu = document.getElementById('menu');
for (const [name, def] of Object.entries(SCENES)) {
  const btn = document.createElement('button');
  btn.textContent = def.label;
  btn.dataset.scene = name;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    loadScene(name);
  });
  menu.appendChild(btn);
}
{
  const btn = document.createElement('button');
  btn.textContent = 'Reset';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    loadScene(currentScene);
  });
  menu.appendChild(btn);
}

loadScene(currentScene);

// ?ff=600 steps the simulation before the first render, handy for jumping
// straight to a settled pile (and for headless screenshot verification)
const fastForward = Math.min(3600, parseInt(params.get('ff') || '0', 10) || 0);
if (fastForward > 0) {
  for (let i = 0; i < fastForward; i++) {
    world.step(DT, SUBSTEPS);
  }
  for (const [tag, body] of bodyByTag) {
    const mesh = meshByTag.get(tag);
    const t = body.getTransform();
    mesh.position.set(t.position.x, t.position.y, t.position.z);
    mesh.quaternion.set(t.rotation.x, t.rotation.y, t.rotation.z, t.rotation.w);
  }
}

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function groundPoint(e) {
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, point) ? point : null;
}

// distinguish clicks from orbit drags
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 0) downAt = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.button !== 0 || !downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return; // camera drag, not a click

  if (e.shiftKey) {
    shootBall();
    return;
  }
  const at = groundPoint(e);
  if (at) SCENES[currentScene].onClick(at);
});

renderer.domElement.addEventListener('dblclick', (e) => {
  const at = groundPoint(e);
  if (!at) return;
  world.explode({
    position: { x: at.x, y: at.y + 0.5, z: at.z },
    radius: 5,
    falloff: 4,
    impulsePerArea: 25,
  });
});

addEventListener('keydown', (e) => {
  pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if (e.key === 'b') SCENES[currentScene].onWave();
  if (e.key === 'r') loadScene(currentScene);
});

addEventListener('keyup', (e) => {
  pressed.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
// main loop: fixed physics timestep, meshes synced from body move events
// ---------------------------------------------------------------------------

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
    updateDrive();
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
      `${SCENES[currentScene].help}   shift+click: cannonball   dblclick: explode   b: more   r: reset`;
  }
}

requestAnimationFrame(frame);
