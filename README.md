# Autoblocks JavaScript SDK

## Installation

```bash
npm install @autoblocks/client
```

```bash
yarn add @autoblocks/client
```

```bash
pnpm add @autoblocks/client
```

## Send Events

```ts
import { AutoblocksTracer } from '@autoblocks/client';

const ab = new AutoblocksTracer(process.env.AUTOBLOCKS_INGESTION_KEY);

await ab.sendEvent('openai.chat.completion');
```
