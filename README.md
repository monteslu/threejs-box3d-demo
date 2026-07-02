# threejs-box3d-demo

A three.js scene driven by [Box3D](https://github.com/erincatto/box3d), Erin Catto's 3D physics engine, running in the browser through the [box3d](https://github.com/monteslu/box3d-wasm) wasm package.

A pile of boxes, spheres, and capsules drops onto the ground. Click to shoot a heavy ball from the camera. Press b to drop 50 more bodies. Rendering syncs from Box3D body move events, so only bodies that actually moved are updated each frame.

## Run

```bash
npm install
npm start
```

Then open:

- http://localhost:8973 for the single threaded build
- http://localhost:8973/?threads=4 for the threaded build (4 solver workers)

Extra URL parameters: `bodies=800` sets the initial pile size.

The bundled server sends the Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers that SharedArrayBuffer needs, which is what makes the threaded build possible.

## Credits

- Physics: Box3D by Erin Catto, MIT licensed, https://github.com/erincatto/box3d
- Rendering: three.js, MIT licensed, https://threejs.org
