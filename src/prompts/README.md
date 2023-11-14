# Autoblocks Prompt SDK

The Autoblocks Prompt SDK is an auto-generated and type-safe prompt builder for TypeScript applications.
It provides several advantages over traditional prompt building techniques:

## 1. Prompts are kept in text files

Prompts are kept in text files, not code, so you don't need to awkwardly indent multiline strings within objects and functions

:x:

```ts
const makePrompt = () => {
  return `First line has to be here so that we don't have a newline

and further content needs to be indented
to the left so that we don't have extra
whitespace before each line`;
};
```

:white_check_mark:

```txt
I can write things normally in a text file!

I don't have to awkwardly indent my text to the left!
```

## 2. Prompt building is type-safe, so you don't have to worry about typos or missing placeholder values

The placeholders in your prompt templates are automatically extracted and turned into TypeScript types, so you don't have to worry about typos or missing placeholder values.

If you have the below template in a file called `feature-a/system`:

```txt
This template expects a {{ name }} and {{ age }} property.
```

Then your builder will be aware of both its path and its expected properties:

```ts
builder.build('feature-a/system', {
  name: 'Alice',
  age: '43',
});
```

<img width="551" alt="Screenshot 2023-11-14 at 3 00 52 PM" src="https://github.com/autoblocksai/javascript-sdk/assets/7498009/488d2143-53b7-4d40-b317-fa3afcc2c9a5">

<img width="272" alt="Screenshot 2023-11-14 at 3 06 44 PM" src="https://github.com/autoblocksai/javascript-sdk/assets/7498009/cd0d8c08-6542-45ca-a209-8400d3ae46af">

<img width="270" alt="Screenshot 2023-11-14 at 3 03 44 PM" src="https://github.com/autoblocksai/javascript-sdk/assets/7498009/c009eff2-f481-469f-b806-4f255532cfe7">

<img width="886" alt="Screenshot 2023-11-14 at 3 03 01 PM" src="https://github.com/autoblocksai/javascript-sdk/assets/7498009/7c19e0af-e238-4d1e-8cdf-59377b6af0f7">

## 3. Auto-versioning

The most powerful feature of the Autoblocks Prompt SDK is the automated versioning based on which templates you used in the process of building prompt(s) for a given LLM request.

For each component of your application that makes an LLM request, choose a unique, human-readable identifier to represent that task.
When you use this identifier to initialize a new builder instance, the SDK will keep track of which templates you used in the process of building the prompt(s) for that request.

This means you can make **any change** and it will result in a new version for that feature or task.

```ts
enum PromptTrackingId {
  FEATURE_A = 'feature-a',
  FEATURE_B = 'feature-b',
}

// Create the template manager once
const mgr = new PromptTemplateManager();

// Create a new builder anytime you're about to build
// prompt(s) for an LLM request. Use the unique identifier
// that represents the task you're performing. Autoblocks
// will automatically track version changes and how LLM
// performance is changing over time
const builder = mgr.makeBuilder(PromptTrackingId.FEATURE_A);

// Use the builder to build prompt(s) programatically
// using any combination of templates you want
const messages = [
  {
    role: 'system',
    content: builder.build('feature-a/system', {
      languageRequirement: builder.build('common/language', {
        language: 'Spanish',
      }),
    }),
  },
  {
    role: 'user',
    content: builder.build('feature-a/user', {
      name: 'Alice',
    }),
  },
];

const response = await openai.chat.completions.create({
  messages,
  model: 'gpt-3.5-turbo',
});

// Record response + template usage to Autoblocks
await tracer.sendEvent('ai.response', {
  properties: { response },
  promptTracking: builder.usage(),
});
```

If you make a change to **any** of the below templates, it will result in a new version for `PromptTrackingId.FEATURE_A`:

- `feature-a/system`
- `feature-a/user`
- `common/language`

Additionally, if you introduce a new template, it would also result in a new version:

```ts
const builder = mgr.makeBuilder(PromptTrackingId.FEATURE_A);

const messages = [
  {
    role: 'system',
    content: builder.build('feature-a/system', {
      languageRequirement: builder.build('common/language', {
        language: 'Spanish',
      }),
      toneRequirement: builder.build('common/tone', {
        tone: 'friendly',
      }),
    }),
  },
  {
    role: 'user',
    content: builder.build('feature-a/user', {
      name: 'Alice',
    }),
  },
];
```

## Getting Started

### Install

```bash
npm install @autoblocks/client
```

```bash
yarn add @autoblocks/client
```

```bash
pnpm add @autoblocks/client
```

### Configure your templates directory

Tell us where your templates directory is:

`package.json`:

```json
"autoblocks": {
  "templatesDirectory": "autoblocks-templates"
}
```

### Create templates

Add templates to your templates directory.

```
package.json
autoblocks-templates/
  common/
    language
    tone
  feature-a/
    system
    user
  feature-b/
    system
    user
```

These are just plain text files with placeholders. Placeholders should be surrounded by double curly braces.

```txt
This is a template with a {{ placeholder }}.
```

Placeholders can have arbitrary whitespace, so this is also valid:

```txt
My name is {{name}}.
My age is {{      age       }}
```

### Run the CLI to generate the types and templates

```bash
autoblocks prompts generate
```

Note: You will probably need to run this with `npm exec` or `yarn run`. You'll likely want to add it to your `package.json` scripts so that it is easier to run:

`package.json`:

```json
"scripts": {
  "ab-prompts-gen": "autoblocks prompts generate"
}
```

### Initialize the template manager

```ts
import { PromptTemplateManager } from '@autoblocks/client/prompts';

const promptManager = new PromptTemplateManager();
```

### Initialize a builder

Like explained above, you should initialize a new builder any time you're making an LLM request. Use an identifier to represent the task you're performing when initializing the builder.

```ts
const builder = promptManager.makeBuilder('feature-a');

// Use the builder however you want to compose your prompt(s)
```

### Send usage data with LLM response event

When you send an LLM response event, you should include the usage data from the builder:

```ts
const response = await openai.chat.completions.create({
  messages,
  model: 'gpt-3.5-turbo',
});

await tracer.sendEvent('ai.response', {
  properties: { response },
  promptTracking: builder.usage(),
});
```

Autoblocks will show you how your LLM performance changes over time based on which templates you used in the process of building the prompt(s) for that request.
