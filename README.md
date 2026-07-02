# threejs-box3d-demo

**Live demo: https://box3d.netlify.app/**

three.js demo scenes driven by [Box3D](https://github.com/erincatto/box3d), Erin Catto's 3D physics engine, running in the browser through the [box3d-wasm](https://github.com/monteslu/box3d-wasm) package.

The default box3d-wasm import auto-detects thread support at runtime: on a cross-origin isolated page (or in Node.js) it loads the threaded build, otherwise it falls back to the single threaded build. The Vite dev server, preview server, and the Netlify config all send the isolation headers, so you get threads everywhere.

## Scenes

Patterned on the upstream Box3D samples:

- **Playground**: a pile of boxes, spheres, and capsules with joint toys: a motorized windmill, a wrecking ball on a chain of spherical joints, and a seesaw on a limited hinge. Click to rain more shapes.
- **Pyramid**: a 12 row box pyramid. Click to fire a cannonball at that spot.
- **Ragdolls**: jointed humans (capsules plus spherical and revolute joints, self-collision disabled per ragdoll via negative filter groups). Click to drop one where you clicked.
- **Dominoes**: a spiral of dominoes with constant arc spacing. Click to fire a cannonball at that spot and start the chain.
- **Bridge**: a plank bridge on revolute joints. Click to rain shapes on it.
- **Driving**: a buggy on four wheel joints (suspension, spin motors, front steering). Drive with arrows or WASD, click to rain obstacles.

Everywhere: shift+click fires a cannonball along the view direction, double click sets off an explosion, b spawns another wave, r (or the Reset button) restarts the scene. Rendering syncs from Box3D body move events, so only bodies that moved are updated each frame.

## Run locally

```bash
npm install
npm run dev
```

Vite serves it at http://localhost:8973 with hot reload, so edit main.js and play. URL parameters:

- `?scene=ragdolls` start on a scene (playground, pyramid, ragdolls, dominoes, bridge, driving)
- `?threads=4` solver worker count, `?threads=0` forces the single threaded build
- `?ff=600` fast-forward the simulation before the first render

## Deploy to Netlify

The repo includes `netlify.toml`: `vite build` publishes `dist/` and Netlify sends the two headers that make the page cross-origin isolated, which SharedArrayBuffer and therefore wasm threads require:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Point Netlify at the repo and it picks everything up. To check the production build locally: `npm run build` then `npm run preview`.

## Credits

- Physics: Box3D by Erin Catto, MIT licensed, https://github.com/erincatto/box3d
- Wasm build and bindings: [box3d-wasm](https://github.com/monteslu/box3d-wasm), on npm as `box3d-wasm`
- Rendering: three.js, MIT licensed, https://threejs.org
