<p align="center">
  <img src="https://app.autoblocks.ai/images/logo.png" width="300px">
</p>
<p align="center">
  📚
  <a href="https://docs.autoblocks.ai/">Documentation</a>
  &nbsp;
  •
  &nbsp;
  🖥️
  <a href="https://app.autoblocks.ai/">Application</a>
  &nbsp;
  •
  &nbsp;
  🏠
  <a href="https://www.autoblocks.ai/">Home</a>
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

## Examples

See our [JavaScript](https://github.com/autoblocksai/autoblocks-examples#javascript) examples.

## Quickstart

```ts
import crypto from 'crypto';
import OpenAI from 'openai';
import { AutoblocksTracer } from '@autoblocks/client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const tracer = new AutoblocksTracer(process.env.AUTOBLOCKS_INGESTION_KEY, {
  // All events sent below will have this trace ID
  traceId: crypto.randomUUID(),
  // All events sent below will include this property
  // alongside any other properties set in the sendEvent call
  properties: {
    provider: 'openai',
  },
});

const requestParams = {
  model: 'gpt-3.5-turbo',
  messages: [
    {
      role: 'system',
      content:
        'You are a helpful assistant.' +
        'You answer questions about a software product named Acme.',
    },
    {
      role: 'user',
      content: 'How do I sign up?',
    },
  ],
  temperature: 0.7,
};

async function run() {
  await tracer.sendEvent('ai.request', {
    properties: requestParams,
  });

  try {
    const now = Date.now();
    const response = await openai.chat.completions.create(requestParams);
    await tracer.sendEvent('ai.response', {
      properties: {
        response,
        latencyMs: Date.now() - now,
      },
    });
  } catch (error) {
    await tracer.sendEvent('ai.error', {
      properties: {
        error,
      },
    });
  }

  // Simulate user feedback
  await ab.sendEvent('user.feedback', {
    properties: {
      feedback: 'good',
    },
  });
}

run();
```

## Documentation

See [the full documentation](https://docs.autoblocks.ai/sdks/javascript).

## Issues / Questions

Please [open an issue](https://github.com/autoblocksai/javascript-sdk/issues/new) if you encounter any bugs, have any questions, or have any feature requests.
