// Assemble the static site for deployment (Netlify publishes the site/ dir).
// Keeps the same /node_modules/... URL layout the dev server uses, so
// index.html works identically locally and deployed.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'site');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const copies = [
  'index.html',
  'main.js',
  'node_modules/box3d-wasm/dist',
  'node_modules/three/build/three.module.js',
  'node_modules/three/build/three.core.js',
  'node_modules/three/examples/jsm/controls/OrbitControls.js',
];

for (const rel of copies) {
  const from = path.join(root, rel);
  const to = path.join(out, rel);
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`copied ${rel}`);
}

console.log(`site assembled in ${out}`);
