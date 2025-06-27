import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/prompts/index.ts',
    'src/prompts-cli/index.ts',
    'src/testing/index.ts',
    'src/configs/index.ts',
    'src/datasets/index.ts',
    'src/datasets-cli/index.ts',
    'src/testing/v2/index.ts',
  ],
  format: ['cjs', 'esm'],
  sourcemap: true,
  clean: true,
  dts: true,
});
