import axios from 'axios';
import * as AI from 'ai-jsx';
import {
  ChatCompletion,
  UserMessage,
  SystemMessage,
} from 'ai-jsx/core/completion';
import {
  AutoblocksJsxTracer,
  AutoblocksPlaceholder,
} from '../src/ai-jsx/index';

interface SentEvent {
  message: string;
  traceId: string;
  timestamp: string;
  properties: {
    spanId: string;
    parentSpanId?: string;
    [key: string]: unknown;
  };
}

jest.setTimeout(100000);
jest.mock('axios');

const axiosCreateMock = axios.create as jest.Mock;

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

  let mockPost: jest.Mock;

  beforeEach(() => {
    mockPost = jest
      .fn()
      .mockResolvedValue({ data: { traceId: 'mock-trace-id' } });
    axiosCreateMock.mockReturnValueOnce({ post: mockPost });
  });

  const sentEvents = () => mockPost.mock.calls.map((c) => c[1]) as SentEvent[];

  const makeSpanPairs = () => {
    const events = sentEvents();
    const pairs: Record<string, SentEvent[]> = {};
    for (const event of events) {
      if (!pairs[event.properties.spanId]) {
        pairs[event.properties.spanId] = [];
      }
      pairs[event.properties.spanId].push(event);
    }
    return pairs;
  };

  afterEach(() => {
    const events = sentEvents();

    // All events should have the same trace id
    expectAllEqualAndDefined(events.map((r) => r.traceId));

    // There should be an even amount of events since each completion
    // sends a request and response event
    expect(events.length).toBeGreaterThan(0);
    expect(events.length % 2).toBe(0);

    const pairs = makeSpanPairs();
    expect(Object.keys(pairs).length).toEqual(events.length / 2);

    for (const pair of Object.values(pairs)) {
      expect(pair.length).toEqual(2);
      expect(pair[0].message).toEqual('ai.completion.request');
      expect(pair[1].message).toEqual('ai.completion.response');
      expect(pair[0].timestamp < pair[1].timestamp).toBe(true);
    }

    for (const request of events) {
      if (!request.properties.parentSpanId) {
        // Make this a string since expect.any(String) doesn't match on undefined
        // and there is no matcher for "string | undefined"
        request.properties.parentSpanId = 'undefined';
      }

      expect(request).toMatchSnapshot({
        traceId: expect.any(String),
        timestamp: expect.any(String),
        properties: {
          spanId: expect.any(String),
          parentSpanId: expect.any(String),
        },
      });
    }
  });

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
  });
});
