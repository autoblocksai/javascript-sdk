import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'crypto';
import type { AutoblocksSpan, AutoblocksPlaceholderProps } from './types';
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

function makeTemplateString(span: AutoblocksSpan | string): string {
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

function makeMessageString(span: AutoblocksSpan | string): string {
  if (typeof span === 'string') {
    return span;
  } else {
    return span.children.map(makeMessageString).filter(Boolean).join('');
  }
}

function countMessageTokens(span: AutoblocksSpan | string): number {
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

function makeMessagesForCompletion(
  completionSpan: AutoblocksSpan,
): AIMessage[] {
  const messagesById = new Map<string, AIMessage>();

  const walk = (span: AutoblocksSpan) => {
    let content: string | undefined = undefined;
    let role: AIMessage['role'] | undefined = undefined;
    let tokens: number | undefined = undefined;

    switch (span.name) {
      case makeComponentName(SystemMessage):
        content = makeMessageString(span);
        role = 'system';
        break;
      case makeComponentName(UserMessage):
        content = makeMessageString(span);
        role = 'user';
        break;
      case makeComponentName(AssistantMessage):
        content = makeMessageString(span);
        role = 'assistant';
        tokens = countMessageTokens(span);
        break;
    }

    if (content && role) {
      const id = span.memoizedId || crypto.randomUUID();
      messagesById.set(id, { content, role, tokens });
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

  // Returns the values in insertion order
  return [...messagesById.values()];
}

function makeTemplatesForCompletion(
  trackerId: string,
  completionSpan: AutoblocksSpan,
): PromptTracking | undefined {
  const tracking: PromptTracking = {
    id: trackerId,
    templates: [],
  };

  const seenMemoizedIds = new Set<string>();

  const walk = (span: AutoblocksSpan) => {
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

function omit(
  obj: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keys.includes(key)),
  );
}

interface AutoblocksEvent {
  message: string;
  args: SendEventArgs;
}

function makeAutoblocksEventsForCompletion(args: {
  traceId: string;
  completionSpan: AutoblocksSpan;
  trackerId?: string;
  parentCompletionSpanId?: string;
}): AutoblocksEvent[] {
  if (!args.completionSpan.endTime) {
    console.warn(`Completion span ${args.completionSpan.id} has no end time.`);
    return [];
  }

  const messages = makeMessagesForCompletion(args.completionSpan);

  if (messages.length < 2) {
    console.warn(
      `Completion span ${args.completionSpan.id} has only ${messages.length} messages.`,
    );
    return [];
  }

  const lastMessage = messages[messages.length - 1];

  // The last message should be an assistant message
  if (!lastMessage || lastMessage.role !== 'assistant') {
    console.warn(
      `Completion span ${args.completionSpan.id}'s last message is not an assistant message.`,
    );
    return [];
  }

  // The request messages are all but the last message, and the response message
  // is the last message.
  const requestMessages = messages.slice(0, -1);
  const responseMessages = messages.slice(-1);

  const requestEvent = {
    message: 'ai.completion.request',
    args: {
      traceId: args.traceId,
      spanId: args.completionSpan.id,
      parentSpanId: args.parentCompletionSpanId,
      timestamp: args.completionSpan.startTime,
      properties: {
        ...omit(args.completionSpan.props, [
          'children',
          AUTOBLOCKS_TRACKER_ID_PROP_NAME,
        ]),
        messages: requestMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        provider: 'openai',
      },
    },
  };

  const responseEvent = {
    message: 'ai.completion.response',
    args: {
      traceId: args.traceId,
      spanId: args.completionSpan.id,
      parentSpanId: args.parentCompletionSpanId,
      timestamp: args.completionSpan.endTime,
      properties: {
        latency:
          new Date(args.completionSpan.endTime).getTime() -
          new Date(args.completionSpan.startTime).getTime(),
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
      promptTracking: args.trackerId
        ? makeTemplatesForCompletion(args.trackerId, args.completionSpan)
        : undefined,
    },
  };

  return [requestEvent, responseEvent];
}

export async function processCompletedRootSpan(rootSpan: AutoblocksSpan) {
  const traceId = rootSpan.id;
  const events: { message: string; args: SendEventArgs }[] = [];
  const seenTrackerIds = new Set<string>();

  const walk = (span: AutoblocksSpan, parentCompletionSpanId?: string) => {
    let completionSpanId: string | undefined = parentCompletionSpanId;

    if (span.name === makeComponentName(OpenAIChatModel)) {
      completionSpanId = span.id;
      const trackerId = parseTrackerIdFromProps(span.props);

      if (!trackerId || !seenTrackerIds.has(trackerId)) {
        events.push(
          ...makeAutoblocksEventsForCompletion({
            traceId,
            completionSpan: span,
            trackerId,
            parentCompletionSpanId,
          }),
        );
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
