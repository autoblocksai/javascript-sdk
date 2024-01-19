import * as AI from 'ai-jsx';
import {
  ChatCompletion,
  UserMessage,
  SystemMessage,
} from 'ai-jsx/core/completion';
import { AnthropicChatModel } from 'ai-jsx/lib/anthropic';
import {
  AutoblocksJsxTracer,
  AutoblocksLoggerAttribute,
  AutoblocksPlaceholder,
  AutoblocksTemplateSelect,
  AutoblocksTemplateSelectItem,
} from '../src/ai-jsx/index';
import { OpenAIChatModel } from 'ai-jsx/lib/openai';
import { LogImplementation } from 'ai-jsx/core/log';

interface SentEvent {
  message: string;
  traceId: string;
  timestamp: string;
  properties: {
    spanId: string;
    parentSpanId?: string;
    latency?: number;
    [key: string]: unknown;
  };
}

jest.setTimeout(100000);

const expectAllEqualAndDefined = (xs: string[]) => {
  expect(xs.every((x) => x === xs[0])).toBe(true);
  expect(xs.every(Boolean)).toBe(true);
};

describe('ai-jsx', () => {
  beforeAll(() => {
    process.env.AUTOBLOCKS_INGESTION_KEY = 'test';
  });

  afterAll(() => {
    process.env.AUTOBLOCKS_INGESTION_KEY = undefined;
  });

  let mockFetch: jest.SpyInstance;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockFetch = jest
      .spyOn(global, 'fetch')
      .mockImplementation((...args) => originalFetch(...args));
  });

  const sentEvents = () =>
    mockFetch.mock.calls
      .filter((c) => c[0].startsWith('https://ingest-event.autoblocks.ai'))
      .map((c) => JSON.parse(c[1].body)) as SentEvent[];

  const makeSpanPairs = (events: SentEvent[]) => {
    const pairs: Record<string, SentEvent[]> = {};
    for (const event of events) {
      if (!pairs[event.properties.spanId]) {
        pairs[event.properties.spanId] = [];
      }
      pairs[event.properties.spanId].push(event);
    }
    return pairs;
  };

  // This needs to return a function b/c ???
  const makeAssertions = () => () => {
    const events = sentEvents();

    // All events should have the same trace id
    expectAllEqualAndDefined(events.map((r) => r.traceId));

    // There should be an even amount of events since each completion
    // sends a request and response event
    expect(events.length).toBeGreaterThan(0);
    expect(events.length % 2).toBe(0);

    const pairs = makeSpanPairs(events);
    expect(Object.keys(pairs).length).toEqual(events.length / 2);

    for (const pair of Object.values(pairs)) {
      expect(pair.length).toEqual(2);
      expect(pair[0].message).toEqual('ai.completion.request');
      expect(
        ['ai.completion.response', 'ai.completion.error'].includes(
          pair[1].message,
        ),
      ).toBe(true);
      expect(pair[0].timestamp < pair[1].timestamp).toBe(true);
      expect(pair[1].properties.latency).toBeDefined();
      expect(pair[1].properties.latency).toBeGreaterThan(0);
    }

    for (const request of events) {
      const matchers = {
        traceId: expect.any(String),
        timestamp: expect.any(String),
        properties: {
          latency: expect.any(Number),
          spanId: expect.any(String),
          parentSpanId: expect.any(String),
        },
      };

      if (request.properties.parentSpanId === undefined) {
        delete matchers.properties.parentSpanId;
      }
      if (request.properties.latency === undefined) {
        delete matchers.properties.latency;
      }

      expect(request).toMatchSnapshot(matchers);
    }
  };

  it('works with no tracker id', async () => {
    await AI.createRenderContext().render(
      <AutoblocksJsxTracer>
        <ChatCompletion temperature={0} model="gpt-3.5-turbo">
          <SystemMessage>
            You are a helpful assistant. Always respond with one word in all
            lowercase letters and no punctuation.
          </SystemMessage>
          <UserMessage>What color is the sky?</UserMessage>
        </ChatCompletion>
      </AutoblocksJsxTracer>,
    );

    makeAssertions()();
  });

  it('handles placeholders', async () => {
    await AI.createRenderContext().render(
      <AutoblocksJsxTracer>
        <ChatCompletion
          temperature={0}
          model="gpt-3.5-turbo"
          autoblocks-tracker-id="my-tracker-id"
        >
          <SystemMessage>
            You are a helpful assistant. Always respond with one word in all
            lowercase letters and no punctuation.
          </SystemMessage>
          <UserMessage>
            What color is the{' '}
            <AutoblocksPlaceholder name="thing">sky</AutoblocksPlaceholder>?
          </UserMessage>
        </ChatCompletion>
      </AutoblocksJsxTracer>,
    );

    makeAssertions()();
  });

  it('handles selects', async () => {
    enum Select {
      A = 'A',
      B = 'B',
    }

    const runtime = () => 'runtime';

    await AI.createRenderContext().render(
      <AutoblocksJsxTracer>
        <ChatCompletion
          temperature={0}
          model="gpt-3.5-turbo"
          autoblocks-tracker-id="my-tracker-id"
        >
          <SystemMessage>
            <AutoblocksTemplateSelect
              name="instructions"
              selectedItemName={Select.A}
            >
              <AutoblocksTemplateSelectItem name={Select.A}>
                You are a helpful assistant. Always respond with one word in all
                lowercase letters and no punctuation.
              </AutoblocksTemplateSelectItem>
              <AutoblocksTemplateSelectItem name={Select.B}>
                <>
                  This template won't be chosen at {runtime()}, but it should
                  still be included in the list of{' '}
                  <AutoblocksPlaceholder name="templates">
                    templates
                  </AutoblocksPlaceholder>
                  .
                </>
              </AutoblocksTemplateSelectItem>
            </AutoblocksTemplateSelect>
          </SystemMessage>
          <UserMessage>
            What color is the{' '}
            <AutoblocksPlaceholder name="thing">sky</AutoblocksPlaceholder>?
          </UserMessage>
        </ChatCompletion>
      </AutoblocksJsxTracer>,
    );

    makeAssertions()();
  });

  it('handles nested completions', async () => {
    const GetThingColor = (props: { thing: string }) => {
      return (
        <ChatCompletion
          temperature={0}
          model="gpt-3.5-turbo"
          autoblocks-tracker-id="get-thing-color"
        >
          <SystemMessage>
            You are a helpful assistant. Always respond with one word in all
            lowercase letters and no punctuation.
          </SystemMessage>
          <UserMessage>
            What color is the{' '}
            <AutoblocksPlaceholder name="thing">
              {props.thing}
            </AutoblocksPlaceholder>
            ?
          </UserMessage>
        </ChatCompletion>
      );
    };

    await AI.createRenderContext().render(
      <AutoblocksJsxTracer>
        <ChatCompletion
          temperature={0}
          model="gpt-3.5-turbo"
          autoblocks-tracker-id="determine-color-combination"
        >
          <SystemMessage>
            You are an expert in colors. Always respond with one word in all
            lowercase letters and no punctuation.
          </SystemMessage>
          <UserMessage>
            What do you get when you mix red with <GetThingColor thing="sky" />?
          </UserMessage>
        </ChatCompletion>
      </AutoblocksJsxTracer>,
    );

    const events = sentEvents();
    expect(events.map((e) => e.message)).toEqual([
      'ai.completion.request',
      'ai.completion.response',
      'ai.completion.request',
      'ai.completion.response',
    ]);

    expect(events.map((e) => e.properties.spanId)).toEqual([
      events[0].properties.spanId,
      events[0].properties.spanId,
      events[2].properties.spanId,
      events[2].properties.spanId,
    ]);

    expect(events.map((e) => e.properties.parentSpanId)).toEqual([
      undefined,
      undefined,
      events[0].properties.spanId,
      events[0].properties.spanId,
    ]);

    makeAssertions()();
  });

  it('handles nested completions w/o tracking IDs', async () => {
    const GetThingColor = (props: { thing: string }) => {
      return (
        <ChatCompletion temperature={0} model="gpt-3.5-turbo">
          <SystemMessage>
            You are a helpful assistant. Always respond with one word in all
            lowercase letters and no punctuation.
          </SystemMessage>
          <UserMessage>
            What color is the{' '}
            <AutoblocksPlaceholder name="thing">
              {props.thing}
            </AutoblocksPlaceholder>
            ?
          </UserMessage>
        </ChatCompletion>
      );
    };

    await AI.createRenderContext().render(
      <AutoblocksJsxTracer>
        <ChatCompletion temperature={0} model="gpt-3.5-turbo">
          <SystemMessage>
            You are an expert in colors. Always respond with one word in all
            lowercase letters and no punctuation.
          </SystemMessage>
          <UserMessage>
            What do you get when you mix red with <GetThingColor thing="sky" />?
          </UserMessage>
        </ChatCompletion>
      </AutoblocksJsxTracer>,
    );

    const events = sentEvents();
    expect(events.map((e) => e.message)).toEqual([
      'ai.completion.request',
      'ai.completion.response',
      'ai.completion.request',
      'ai.completion.response',
    ]);

    expect(events.map((e) => e.properties.spanId)).toEqual([
      events[0].properties.spanId,
      events[0].properties.spanId,
      events[2].properties.spanId,
      events[2].properties.spanId,
    ]);

    expect(events.map((e) => e.properties.parentSpanId)).toEqual([
      undefined,
      undefined,
      events[0].properties.spanId,
      events[0].properties.spanId,
    ]);

    makeAssertions()();
  });

  it('handles anthropic chat models', async () => {
    await AI.createRenderContext().render(
      <AutoblocksJsxTracer>
        <AnthropicChatModel temperature={0} model="claude-instant-1">
          <SystemMessage>
            You are a helpful assistant. Always respond with one word in all
            lowercase letters and no punctuation.
          </SystemMessage>
          <UserMessage>What color is the sky?</UserMessage>
        </AnthropicChatModel>
      </AutoblocksJsxTracer>,
    );

    makeAssertions()();
  });

  it('handles errors', async () => {
    try {
      await AI.createRenderContext().render(
        <AutoblocksJsxTracer>
          <ChatCompletion temperature={0} model="unsupported-model">
            <SystemMessage>
              You are a helpful assistant. Always respond with one word in all
              lowercase letters and no punctuation.
            </SystemMessage>
            <UserMessage>What color is the sky?</UserMessage>
          </ChatCompletion>
        </AutoblocksJsxTracer>,
      );
    } catch {
      // expected
    }

    makeAssertions()();
  });

  it('sets prompt tracking attributes on the logger', async () => {
    const mockSetAttribute = jest.fn();

    class MockLogger extends LogImplementation {
      log() {}

      setAttribute(
        _element: AI.Element<any>,
        _renderId: string,
        _key: string,
        _value: string,
      ): void {
        mockSetAttribute(_element, _renderId, _key, _value);
      }
    }

    const MyCustomChatModel = OpenAIChatModel;

    const GetThingColor = (props: { thing: string }) => {
      return (
        <MyCustomChatModel
          temperature={0}
          model="gpt-3.5-turbo"
          autoblocks-tracker-id="get-thing-color"
        >
          <SystemMessage>
            You are a helpful assistant. Always respond with one word in all
            lowercase letters and no punctuation.
          </SystemMessage>
          <UserMessage>
            What color is the{' '}
            <AutoblocksPlaceholder name="thing">
              {props.thing}
            </AutoblocksPlaceholder>
            ?
          </UserMessage>
        </MyCustomChatModel>
      );
    };

    const GetColorCombo = (props: { color: string; thing: string }) => {
      return (
        <MyCustomChatModel
          temperature={0}
          model="gpt-3.5-turbo"
          autoblocks-tracker-id="determine-color-combination"
        >
          <SystemMessage>
            You are an expert in colors. Always respond with one word in all
            lowercase letters and no punctuation.
          </SystemMessage>
          <UserMessage>
            What do you get when you mix{' '}
            <AutoblocksPlaceholder name="color">
              {props.color}
            </AutoblocksPlaceholder>{' '}
            with <GetThingColor thing={props.thing} />?
          </UserMessage>
        </MyCustomChatModel>
      );
    };

    await AI.createRenderContext({ logger: new MockLogger() }).render(
      <AutoblocksJsxTracer
        skipSendingEvents={true}
        customChatModelComponent={MyCustomChatModel}
      >
        <GetColorCombo color="red" thing="sky" />
      </AutoblocksJsxTracer>,
    );

    const promptTrackingCalls = mockSetAttribute.mock.calls.filter(
      (c) => c[2] === AutoblocksLoggerAttribute.PROMPT_TRACKING,
    );

    // There should be two prompt tracking setAttribute calls,
    // one for each chat model component with an autoblocks-tracker-id
    // property
    expect(promptTrackingCalls.length).toEqual(2);

    // The render IDs should both be defined and be different
    const renderIds = promptTrackingCalls.map((c) => c[1]);
    expect(renderIds.every(Boolean)).toBe(true);
    expect(new Set(renderIds).size).toEqual(2);

    // We should have logged the templates for each chat model component
    expect(JSON.parse(promptTrackingCalls[0][3])).toEqual({
      id: 'get-thing-color',
      templates: [
        {
          id: 'get-thing-color/system',
          template:
            'You are a helpful assistant. Always respond with one word in all lowercase letters and no punctuation.',
        },
        {
          id: 'get-thing-color/user',
          template: 'What color is the {{ thing }}?',
        },
      ],
    });

    expect(JSON.parse(promptTrackingCalls[1][3])).toEqual({
      id: 'determine-color-combination',
      templates: [
        {
          id: 'determine-color-combination/system',
          template:
            'You are an expert in colors. Always respond with one word in all lowercase letters and no punctuation.',
        },
        {
          id: 'determine-color-combination/user',
          template:
            'What do you get when you mix {{ color }} with {{ get-thing-color }}?',
        },
      ],
    });
  });
});
