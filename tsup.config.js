import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/prompts/index.ts',
    'src/prompts-cli/index.ts',
    'src/langchain/index.ts',
    'src/openai/index.ts',
    'src/ai-jsx/index.ts',
  ],
  external: ['langchain', 'openai', 'ai-jsx'],
  format: ['cjs', 'esm'],
  sourcemap: true,
  clean: true,
  dts: true,
});
