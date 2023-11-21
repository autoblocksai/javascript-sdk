import { AsyncLocalStorage } from 'node:async_hooks';
import type { ABSpan, AutoblocksPlaceholderProps } from './types';
import type { PromptTracking, SendEventArgs } from '../types';
import { Component } from 'ai-jsx';
import {
  SystemMessage,
  UserMessage,
  AssistantMessage,
} from 'ai-jsx/core/completion';
import { OpenAIChatModel } from 'ai-jsx/lib/openai';
import { AutoblocksTracer } from '../tracer';
import { readEnv, AUTOBLOCKS_INGESTION_KEY } from '../util';

export const AUTOBLOCKS_TRACKER_ID_PROP_NAME = 'autoblocks-tracker-id';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = Component<any>;

/**
 * Used to wrap a dynamic runtime variable so that the actual value is
 * replaced in the template with {{ name }}.
 */
export function AutoblocksPlaceholder(props: AutoblocksPlaceholderProps) {
  return props.children;
}

export function makeComponentName(f: AnyComponent): string {
  return `<${f.name}>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function bindAsyncGenerator<T = unknown, TReturn = any, TNext = unknown>(
  generator: AsyncGenerator<T, TReturn, TNext>,
): AsyncGenerator<T, TReturn, TNext> {
  const result = {
    next: AsyncLocalStorage.bind(generator.next.bind(generator)),
    return: AsyncLocalStorage.bind(generator.return.bind(generator)),
    throw: AsyncLocalStorage.bind(generator.throw.bind(generator)),

    [Symbol.asyncIterator]() {
      return result;
    },
  };

  return result;
}

/**
 * Long story
 *
 * https://github.com/fixie-ai/ai-jsx/blob/4c67d845f48585dc3f26e90a9a656471f40c82ed/packages/ai-jsx/src/core/opentelemetry.ts#L91-L95
 *
 * This will break if AI.JSX changes the symbol name. 🤡
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findMemoizedId(o: any): string | undefined {
  try {
    const symbols = Object.getOwnPropertySymbols(o);
    const memoizedIdSymbol = symbols.find(
      (s) => s.toString() === 'Symbol(memoizedId)',
    );

    if (memoizedIdSymbol) {
      return `${o[memoizedIdSymbol]}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function parseTrackerIdFromProps(props: unknown): string | undefined {
  try {
    const trackerId = (props as Record<string, unknown>)[
      AUTOBLOCKS_TRACKER_ID_PROP_NAME
    ];
    if (typeof trackerId === 'string') {
      return trackerId;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function makeTemplateString(span: ABSpan | string): string {
  if (typeof span === 'string') {
    return span;
  } else if (span.name === makeComponentName(AutoblocksPlaceholder)) {
    const props = span.props as AutoblocksPlaceholderProps;
    return `{{ ${props.name} }}`;
  } else if (span.name === makeComponentName(OpenAIChatModel)) {
    // There is a nested completion not wrapped in a placeholder
    const name = parseTrackerIdFromProps(span.props) || 'completion';
    return `{{ ${name} }}`;
  } else {
    return span.children.map(makeTemplateString).filter(Boolean).join('');
  }
}

function makeMessageString(span: ABSpan | string): string {
  if (typeof span === 'string') {
    return span;
  } else {
    return span.children.map(makeMessageString).filter(Boolean).join('');
  }
}

function countMessageTokens(span: ABSpan | string): number {
  let tokens = 0;
  if (typeof span === 'string') {
    tokens++;
  } else {
    span.children.forEach((child) => {
      tokens += countMessageTokens(child);
    });
  }
  return tokens;
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokens?: number;
}

interface MemoizedMessage {
  memoizedId: string | undefined;
  message: AIMessage;
}

function makeMemoizedMessagesArray(
  span: ABSpan,
  components: AnyComponent[],
): MemoizedMessage[] {
  const componentNames = components.map(makeComponentName);
  const messages: MemoizedMessage[] = [];

  let content: string | undefined = undefined;
  let role: AIMessage['role'] | undefined = undefined;
  let tokens: number | undefined = undefined;

  if (componentNames.includes(span.name)) {
    content = makeMessageString(span);

    switch (span.name) {
      case makeComponentName(SystemMessage):
        role = 'system';
        break;
      case makeComponentName(UserMessage):
        role = 'user';
        break;
      case makeComponentName(AssistantMessage):
        role = 'assistant';
        tokens = countMessageTokens(span);
        break;
    }
  }

  if (content && role) {
    messages.push({
      memoizedId: span.memoizedId,
      message: { content, role, tokens },
    });
  }

  for (const child of span.children) {
    if (typeof child === 'string') {
      continue;
    }

    // Stop if we encounter another chat component
    if (child.name === makeComponentName(OpenAIChatModel)) {
      continue;
    }

    messages.push(...makeMemoizedMessagesArray(child, components));
  }

  return messages;
}

/**
 * Keep the last message from each memoizedId.
 */
function makeMessagesArrayFrom(
  span: ABSpan,
  components: AnyComponent[],
): AIMessage[] {
  const memoized = makeMemoizedMessagesArray(span, components);

  const seenMemoizedIds = new Set<string>();
  const dedupedMessages: AIMessage[] = [];

  for (const memo of memoized.reverse()) {
    if (memo.memoizedId === undefined) {
      dedupedMessages.push(memo.message);
      continue;
    }

    if (seenMemoizedIds.has(memo.memoizedId)) {
      continue;
    }

    seenMemoizedIds.add(memo.memoizedId);
    dedupedMessages.push(memo.message);
  }

  return dedupedMessages.reverse();
}

function makeTemplatesForCompletion(
  trackerId: string,
  completionSpan: ABSpan,
): PromptTracking | undefined {
  const tracking: PromptTracking = {
    id: trackerId,
    templates: [],
  };

  const seenMemoizedIds = new Set<string>();

  const walk = (span: ABSpan) => {
    if (
      span.children.length > 0 &&
      (span.name === makeComponentName(SystemMessage) ||
        span.name === makeComponentName(UserMessage))
    ) {
      if (span.memoizedId !== undefined) {
        if (seenMemoizedIds.has(span.memoizedId)) {
          return;
        }
        seenMemoizedIds.add(span.memoizedId);
      }

      const suffix =
        span.name === makeComponentName(SystemMessage) ? 'system' : 'user';

      tracking.templates.push({
        id: `${trackerId}/${suffix}`,
        template: makeTemplateString(span),
      });
    }

    for (const child of span.children) {
      if (typeof child === 'string') {
        continue;
      }

      // Stop if we encounter another chat component
      if (child.name === makeComponentName(OpenAIChatModel)) {
        continue;
      }

      walk(child);
    }
  };

  walk(completionSpan);

  return tracking;
}

export async function processCompletedRootSpan(rootSpan: ABSpan) {
  const traceId = rootSpan.id;
  const events: { message: string; args: SendEventArgs }[] = [];
  const seenTrackerIds = new Set<string>();

  const walk = (span: ABSpan, parentCompletionSpanId?: string) => {
    let completionSpanId: string | undefined = parentCompletionSpanId;

    if (span.name === makeComponentName(OpenAIChatModel)) {
      completionSpanId = span.id;
      const trackerId = parseTrackerIdFromProps(span.props);

      if (!trackerId || !seenTrackerIds.has(trackerId)) {
        // TODO: Need to figure out how to differentiate between which messages were
        // sent in the request and which were part of the response, since they're all
        // rendered together as children under <ChatCompletion>. For now just assuming
        // that all system and user messages are part of the request and all assistant
        // messages are part of the response.
        const requestMessages = makeMessagesArrayFrom(span, [
          SystemMessage,
          UserMessage,
        ]);
        const responseMessages = makeMessagesArrayFrom(span, [
          AssistantMessage,
        ]);

        events.push({
          message: 'ai.completion.request',
          args: {
            traceId,
            spanId: completionSpanId,
            parentSpanId: parentCompletionSpanId,
            timestamp: span.startTime,
            properties: {
              ...Object.fromEntries(
                Object.entries(span.props as Record<string, unknown>).filter(
                  ([k]) => k !== AUTOBLOCKS_TRACKER_ID_PROP_NAME,
                ),
              ),
              messages: requestMessages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              provider: 'openai',
            },
          },
        });

        events.push({
          message: 'ai.completion.response',
          args: {
            traceId,
            spanId: completionSpanId,
            parentSpanId: parentCompletionSpanId,
            timestamp: span.endTime,
            properties: {
              choices: responseMessages.map((m) => ({
                message: { role: m.role, content: m.content },
              })),
              usage: {
                completion_tokens: responseMessages.reduce(
                  (acc, m) => acc + (m.tokens || 0),
                  0,
                ),
              },
              provider: 'openai',
            },
            promptTracking: trackerId
              ? makeTemplatesForCompletion(trackerId, span)
              : undefined,
          },
        });
      }

      if (trackerId) {
        seenTrackerIds.add(trackerId);
      }
    }

    for (const child of span.children) {
      if (typeof child === 'string') {
        continue;
      }

      walk(child, completionSpanId);
    }
  };

  walk(rootSpan);

  const ingestionKey = readEnv(AUTOBLOCKS_INGESTION_KEY);

  if (!ingestionKey) {
    console.error(
      `No ${AUTOBLOCKS_INGESTION_KEY} environment variable set, not sending ${events.length} events.`,
    );
    return;
  }

  const tracer = new AutoblocksTracer(ingestionKey);
  await Promise.all(
    events.map((event) => tracer.sendEvent(event.message, event.args)),
  );
}
