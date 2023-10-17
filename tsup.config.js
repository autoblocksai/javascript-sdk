import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/langchain/index.ts'],
  format: ['cjs', 'esm'],
  external: ['openai', 'langchain'],
  sourcemap: true,
  clean: true,
  dts: true,
});
