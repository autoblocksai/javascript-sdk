import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/browser/tracer/index.ts',
    'src/server/prompts/index.ts',
    'src/server/prompts-cli/index.ts',
    'src/server/testing/index.ts',
  ],
  format: ['cjs', 'esm'],
  sourcemap: true,
  clean: true,
  dts: true,
});
