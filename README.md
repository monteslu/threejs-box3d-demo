# threejs-box3d-demo

three.js demo scenes driven by [Box3D](https://github.com/erincatto/box3d), Erin Catto's 3D physics engine, running in the browser through the [box3d-wasm](https://github.com/monteslu/box3d-wasm) package.

The default box3d-wasm import auto-detects thread support at runtime: on a cross-origin isolated page (or in Node.js) it loads the threaded build, otherwise it falls back to the single threaded build. Both servers in this repo send the isolation headers, so you get threads.

## Scenes

- **Playground**: a pile of boxes, spheres, and capsules with joint toys: a motorized windmill, a wrecking ball on a chain of spherical joints, and a seesaw on a limited hinge. Click to rain more shapes.
- **Pyramid**: a 12 row box pyramid. Click to smash it with a cannonball.
- **Ragdolls**: jointed humans (capsules plus spherical and revolute joints, self-collision disabled per ragdoll via negative filter groups). Click to drop one where you clicked.

Everywhere: shift+click fires a cannonball, double click sets off an explosion, and b spawns another wave. Rendering syncs from Box3D body move events, so only bodies that moved are updated each frame.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:8973 and use the scene buttons, or jump straight in with URL parameters:

- `?scene=ragdolls` start on a scene (playground, pyramid, ragdolls)
- `?threads=4` solver worker count, `?threads=0` forces the single threaded build
- `?ff=600` fast-forward the simulation before the first render

## Deploy to Netlify

The repo includes `netlify.toml`. It builds a self-contained static site into `site/` (`node scripts/build-site.mjs`) and sends the two headers that make the page cross-origin isolated, which SharedArrayBuffer and therefore wasm threads require:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Point Netlify at the repo and it picks everything up from `netlify.toml`. To test the deployable site locally: `npm run build` then `npm run start:site`.

## Credits

- Physics: Box3D by Erin Catto, MIT licensed, https://github.com/erincatto/box3d
- Wasm build and bindings: [box3d-wasm](https://github.com/monteslu/box3d-wasm), on npm as `box3d-wasm`
- Rendering: three.js, MIT licensed, https://threejs.org
