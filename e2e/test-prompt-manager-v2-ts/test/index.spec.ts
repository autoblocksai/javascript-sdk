import { AutoblocksPromptManagerV2 } from '@autoblocks/client/prompts';
import { describe, it, expect,  } from 'vitest';

// Use a single app ID across all tests
const APP_ID = 'jqg74mpzzovssq38j055yien';

describe('Loop', () => {
  it('works', async () => {
    const iterations = Array.from({ length: 100 }).map(async (_, index) => {
      try {
        const resp = await fetch(`https://dev-api.autoblocks.ai/apps/jqg74mpzzovssq38j055yien/prompts/prompt-basic/major/undeployed/minor/cm6grg7lk0003rc2qzr9okfcd?index=${index}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.AUTOBLOCKS_V2_API_KEY}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) {

          throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`);
        }
        const data = await resp.json();
        return data;
      }
      catch (error) {
        console.log('Failed at', index);
        throw error;
      }
    });
    await Promise.all(iterations);
    expect(true).toBe(true);
  }, 30000);
});

// describe('AutoblocksPromptManagerV2', () => {
//   describe('AutoblocksPromptManagerV2 v1.0', () => {
//     const manager = new AutoblocksPromptManagerV2({
//       appId: APP_ID,
//       id: 'prompt-basic',
//       version: {
//         major: '1',
//         minor: '0',
//       },
//     });
  
//     beforeAll(async () => {
//       await manager.init();
//     });
  
//     afterAll(() => {
//       manager.close();
//     });
  
//     it('renders prompts', () => {
//       manager.exec(({ prompt }) => {
//         const rendered = prompt.renderTemplate({
//           template: 'template-a',
//           params: {
//             name: 'Alice',
//             weather: 'sunny',
//           },
//         });
//         expect(rendered).toEqual('Hello, Alice! The weather is sunny today.');
//       });
//     });
  
//     it('handles async exec functions', async () => {
//       const rendered = await manager.exec(async ({ prompt }) => {
//         const rendered = prompt.renderTemplate({
//           template: 'template-a',
//           params: {
//             name: 'Alice',
//             weather: 'sunny',
//           },
//         });
//         await new Promise((resolve) => setTimeout(resolve, 0));
//         return rendered;
//       });
  
//       expect(rendered).toEqual('Hello, Alice! The weather is sunny today.');
//     });
  
//     it('provides params', () => {
//       manager.exec(({ prompt }) => {
//         expect(prompt.params).toEqual({
//           frequencyPenalty: 0,
//           maxTokens: 256,
//           model: 'gpt-4o',
//           presencePenalty: 0,
//           stopSequences: [],
//           temperature: 0.7,
//           topP: 1,
//         });
//       });
//     });
  
//     it('provides tracking info', () => {
//       manager.exec(({ prompt }) => {
//         expect(prompt.track()).toEqual({
//           id: 'prompt-basic',
//           version: '1.0',
//           templates: [
//             {
//               id: 'template-a',
//               template: 'Hello, {{name}}! The weather is {{weather}} today.',
//             },
//             {
//               id: 'template-b',
//               template: 'Hello, {{ optional? }}! My name is {{ name }}.',
//             },
//           ],
//           params: {
//             params: {
//               frequencyPenalty: 0,
//               maxTokens: 256,
//               model: 'gpt-4o',
//               presencePenalty: 0,
//               stopSequences: [],
//               temperature: 0.7,
//               topP: 1,
//             },
//           },
//           tools: [],
//         });
//       });
//     });
//   });
  
  
//   describe('AutoblocksPromptManagerV2 v1 latest', () => {
//     const manager = new AutoblocksPromptManagerV2({
//       appId: APP_ID,
//       id: 'prompt-basic',
//       version: {
//         major: '1',
//         minor: 'latest',
//       },
//     });
  
//     beforeAll(async () => {
//       await manager.init();
//     });
  
//     afterAll(() => {
//       manager.close();
//     });
  
//     it('renders prompts', () => {
//       manager.exec(({ prompt }) => {
//         const rendered = prompt.renderTemplate({
//           template: 'template-a',
//           params: {
//             name: 'Alice',
//             weather: 'sunny',
//           },
//         });
//         expect(rendered).toEqual('Hello, Alice! The weather is sunny today.');
//       });
//     });
  
//     it('provides params', () => {
//       manager.exec(({ prompt }) => {
//         expect(prompt.params).toEqual({
//           frequencyPenalty: 0,
//           maxTokens: 256,
//           model: 'gpt-4o',
//           presencePenalty: 0,
//           stopSequences: [],
//           temperature: 0.7,
//           topP: 1,
//         });
//       });
//     });
  
//     it('provides tracking info', () => {
//       manager.exec(({ prompt }) => {
//         expect(prompt.track()).toEqual({
//           id: 'prompt-basic',
//           version: '1.0',
//           templates: [
//             {
//               id: 'template-a',
//               template: 'Hello, {{name}}! The weather is {{weather}} today.',
//             },
//             {
//               id: 'template-b',
//               template: 'Hello, {{ optional? }}! My name is {{ name }}.',
//             },
//           ],
//           params: {
//             params: {
//               frequencyPenalty: 0,
//               maxTokens: 256,
//               model: 'gpt-4o',
//               presencePenalty: 0,
//               stopSequences: [],
//               temperature: 0.7,
//               topP: 1,
//             },
//           },
//           tools: [],
//         });
//       });
//     });
//   });
  
//   describe('AutoblocksPromptManagerV2 v2.1', () => {
//     const manager = new AutoblocksPromptManagerV2({
//       appId: APP_ID,
//       id: 'prompt-basic',
//       version: {
//         major: '2',
//         minor: '1',
//       },
//     });
  
//     beforeAll(async () => {
//       await manager.init();
//     });
  
//     afterAll(() => {
//       manager.close();
//     });
  
//     it('renders prompts', () => {
//       manager.exec(({ prompt }) => {
//         const rendered = prompt.renderTemplate({
//           template: 'template-c',
//           params: {
//             first_name: 'Alice',
//           },
//         });
//         expect(rendered).toEqual('Hello, Alice!');
//       });
//     });
  
//     it('provides params', () => {
//       manager.exec(({ prompt }) => {
//         expect(prompt.params).toEqual({
//           model: 'gpt-4o',
//           seed: -7324655555050587,
//           topK: 0,
//         });
//       });
//     });
  
//     it('provides tracking info', () => {
//       manager.exec(({ prompt }) => {
//         expect(prompt.track()).toEqual({
//           id: 'prompt-basic',
//           version: '2.1',
//           templates: [
//             {
//               id: 'template-c',
//               template: 'Hello, {{ first_name }}!',
//             },
//           ],
//           params: {
//             params: {
//               model: 'gpt-4o',
//               seed: -7324655555050587,
//               topK: 0,
//             },
//           },
//           tools: [],
//         });
//       });
//     });
//   });
  
//   describe('AutoblocksPromptManagerV2 v1 weighted', () => {
//     const manager = new AutoblocksPromptManagerV2({
//       appId: APP_ID,
//       id: 'prompt-basic',
//       version: {
//         major: '1',
//         minor: [
//           {
//             version: 'latest',
//             weight: 10,
//           },
//           {
//             version: '0',
//             weight: 90,
//           },
//         ],
//       },
//     });
  
//     beforeAll(async () => {
//       await manager.init();
//     });
  
//     afterAll(() => {
//       manager.close();
//     });
  
//     it('provides tracking info', () => {
//       manager.exec(({ prompt }) => {
//         const tracking = prompt.track();
//         // Either 1.0 or 1.1 should be chosen based on their weights
//         expect(['1.0', '1.1'].includes(tracking.version)).toBe(true);
//       });
//     });
//   });
  
//   describe('Latest Undeployed V2', () => {
//     const manager = new AutoblocksPromptManagerV2({
//       appId: APP_ID,
//       id: 'prompt-basic',
//       version: {
//         major: 'dangerously-use-undeployed',
//         minor: 'latest',
//       },
//       initTimeout: { seconds: 5 },
//     });
  
//     beforeAll(async () => {
//       await manager.init();
//     });
  
//     afterAll(() => {
//       manager.close();
//     });
  
//     it('works', () => {
//       manager.exec(({ prompt }) => {
//         expect(prompt.track().id).toEqual('prompt-basic');
//         expect(prompt.track().version.startsWith('revision:')).toBe(true);
//       });
//     });
//   });
  
//   describe('Pinned Undeployed V2', () => {
//     const manager = new AutoblocksPromptManagerV2({
//       appId: APP_ID,
//       id: 'prompt-basic',
//       version: {
//         major: 'dangerously-use-undeployed',
//         minor: 'cm6grg7lk0003rc2qzr9okfcd',
//       },
//       initTimeout: { seconds: 5 },
//     });
  
//     beforeAll(async () => {
//       await manager.init();
//     });
  
//     afterAll(() => {
//       manager.close();
//     });
  
//     it('works', () => {
//       manager.exec(({ prompt }) => {
//         expect(prompt.track()).toEqual({
//           id: 'prompt-basic',
//           version: 'revision:etv6z712691iu8qawrwnqnl9',
//           templates: [
//             {
//               id: 'template-c',
//               template: 'Hello, {{ first_name }}!',
//             },
//           ],
//           params: {
//             params: {
//               model: 'gpt-4o',
//               seed: -7324655555050587,
//               topK: 0,
//             },
//           },
//           tools: [],
//         });
//       });
//     });
//   });
// });
