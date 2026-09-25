import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/extension', { recursive: true });
await Promise.all([
  build({ entryPoints: ['src/extension/content.ts'], outfile: 'dist/extension/content.js', bundle: true, platform: 'browser', format: 'iife', target: 'chrome120' }),
  build({ entryPoints: ['src/extension/background.ts'], outfile: 'dist/extension/background.js', bundle: true, platform: 'browser', format: 'iife', target: 'chrome120' }),
  build({ entryPoints: ['src/extension/popup.ts'], outfile: 'dist/extension/popup.js', bundle: true, platform: 'browser', format: 'iife', target: 'chrome120' }),
  build({ entryPoints: ['src/server/index.ts'], outfile: 'dist/server.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node20', packages: 'external' })
]);
await cp('public', 'dist/extension', { recursive: true });
console.log('Built extension in dist/extension and helper in dist/server.mjs');
