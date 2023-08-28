<p align="center">
  <img src="https://app.autoblocks.ai/images/logo.png" width="300px">
</p>
<p align="center">
  <img src="assets/js-logo-128.png" width="64px">
  <img src="assets/ts-logo-128.png" width="64px">
</p>
<p align="center">
  <a href="https://github.com/autoblocksai/javascript-sdk/actions/workflows/ci.yml">
    <img src="https://github.com/autoblocksai/javascript-sdk/actions/workflows/ci.yml/badge.svg?branch=main">
  </a>
</p>

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

## Quickstart

```ts
import { AutoblocksTracer } from '@autoblocks/client';

const ab = new AutoblocksTracer('my-ingestion-key');
await ab.sendEvent('my-first-event');
```

## Documentation

See [the full documentation](https://docs.autoblocks.ai/sdks/javascript).

## Issues / Questions

Please [open an issue](https://github.com/autoblocksai/javascript-sdk/issues/new) if you encounter any bugs, have any questions, or have any feature requests.
