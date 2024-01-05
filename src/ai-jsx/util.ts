import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'crypto';
import type {
  AnyComponent,
  AutoblocksSpan,
  AutoblocksPlaceholderProps,
  AutoblocksTemplateSelectProps,
  AutoblocksTemplateSelectItemProps,
  AnyElement,
} from './types';
import type { PromptTracking, SendEventArgs } from '../types';
import {
  SystemMessage,
  UserMessage,
  AssistantMessage,
} from 'ai-jsx/core/completion';
import { OpenAIChatModel } from 'ai-jsx/lib/openai';
import { AnthropicChatModel } from 'ai-jsx/lib/anthropic';
import { AutoblocksTracer } from '../tracer';
import { readEnv, AUTOBLOCKS_INGESTION_KEY } from '../util';
import * as AIJSX from 'ai-jsx';

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokens?: number;
}

interface AutoblocksEvent {
  message: string;
  args: SendEventArgs;
}

type Provider = 'openai' | 'anthropic';

const AUTOBLOCKS_TRACKER_ID_PROP_NAME = 'autoblocks-tracker-id';

/**
 * Used to wrap a dynamic runtime variable so that the actual value is
 * replaced in the template with {{ name }}.
 */
export function AutoblocksPlaceholder(props: AutoblocksPlaceholderProps) {
  return props.children;
}

/**
 * Used to wrap templates that users want to choose between. This allows us to consider
 * all choices' templates as part of the same prompt tracking object regardless of which
 * one is chosen at runtime. Otherwise, users would have several active versions of their
 * prompts at one time (one for each choice).
 */
export function AutoblocksTemplateSelect(props: AutoblocksTemplateSelectProps) {
  if (Array.isArray(props.children)) {
    const selectedItem = props.children.find((child) => {
      return (
        AIJSX.isElement(child) &&
        child.tag === AutoblocksTemplateSelectItem &&
        (child.props as AutoblocksTemplateSelectItemProps).name ===
          props.selectedItemName
      );
    });
    if (selectedItem) {
      return selectedItem;
    }
  }
  return props.children;
}

/**
 * Should be a child of AutoblocksTemplateSelect.
 */
export function AutoblocksTemplateSelectItem(
  props: AutoblocksTemplateSelectItemProps,
) {
  return props.children;
}

export function makeComponentName(f: AnyComponent): string {
  return `<${f.name}>`;
}

export function isChatModelComponent(
  component: AnyComponent,
  customChatComponent: AnyComponent | undefined,
): boolean {
  const name = makeComponentName(component);
  return [
    name === makeComponentName(OpenAIChatModel),
    name === makeComponentName(AnthropicChatModel),
    customChatComponent && name === makeComponentName(customChatComponent),
  ].some((x) => Boolean(x));
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
  } else if (span.name === makeComponentName(AutoblocksTemplateSelect)) {
    const props = span.props as AutoblocksTemplateSelectProps;
    return `{{ ${props.name} }}`;
  } else if (span.isChatModel) {
    // There is a nested completion not wrapped in a placeholder
    const name = parseTrackerIdFromProps(span.props) || 'completion';
    return `{{ ${name} }}`;
  } else {
    return span.children.map(makeTemplateString).filter(Boolean).join('');
  }
}

function makeTemplateStringForNode(
  node: unknown,
  customChatModelComponent: AnyComponent | undefined,
): string {
  if (['string', 'boolean', 'number'].includes(typeof node)) {
    return `${node}`;
  } else if (AIJSX.isElement(node) && node.tag === AutoblocksPlaceholder) {
    const props = node.props as AutoblocksPlaceholderProps;
    return `{{ ${props.name} }}`;
  } else if (AIJSX.isElement(node) && node.tag === AutoblocksTemplateSelect) {
    const props = node.props as AutoblocksTemplateSelectProps;
    return `{{ ${props.name} }}`;
  } else if (
    AIJSX.isElement(node) &&
    isChatModelComponent(node.tag, customChatModelComponent)
  ) {
    const name = parseTrackerIdFromProps(node.props) || 'completion';
    return `{{ ${name} }}`;
  } else if (AIJSX.isElement(node)) {
    return makeTemplateStringForNode(
      node.props.children,
      customChatModelComponent,
    );
  } else if (Array.isArray(node)) {
    return node
      .map((n) => makeTemplateStringForNode(n, customChatModelComponent))
      .join('');
  } else {
    console.warn(`Unhandled node: ${node}`);
    return '';
  }
}

function makeTemplatesFromSelectProps(args: {
  trackerId: string;
  props: AutoblocksTemplateSelectProps;
  customChatModelComponent: AnyComponent | undefined;
}): { id: string; template: string }[] {
  const templates: { id: string; template: string }[] = [];

  // Find all of the <AutoblocksTemplateSelectItem> children
  const items: AnyElement[] = [];
  if (Array.isArray(args.props.children)) {
    for (const child of args.props.children) {
      if (
        AIJSX.isElement(child) &&
        child.tag === AutoblocksTemplateSelectItem
      ) {
        items.push(child);
      }
    }
  } else if (
    AIJSX.isElement(args.props.children) &&
    args.props.children.tag === AutoblocksTemplateSelectItem
  ) {
    items.push(args.props.children);
  }

  // Get the template for each <AutoblocksTemplateSelectItem> and
  // add it to the list of templates
  for (const item of items) {
    const template = makeTemplateStringForNode(
      item,
      args.customChatModelComponent,
    );
    if (template) {
      const props = item.props as AutoblocksTemplateSelectItemProps;
      templates.push({
        id: `${args.trackerId}/${args.props.name}/${props.name}`,
        template,
      });
    }
  }

  return templates;
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

function makeMessagesForCompletion(
  completionSpan: AutoblocksSpan,
  provider: Provider,
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

    // For Anthropic requests, AI.JSX replaces the system message with a user and
    // assistant message, so we omit the system message here since it's redundant
    // with the user and assistant message added by AI.JSX.
    // https://github.com/fixie-ai/ai-jsx/blob/4cd5eaf88de844d99d93216f199e9334f603a7ae/packages/ai-jsx/src/lib/anthropic.tsx#L109-L124
    if (content && role && !(provider === 'anthropic' && role === 'system')) {
      const id = span.memoizedId || crypto.randomUUID();
      messagesById.set(id, { content, role, tokens });
    }

    for (const child of span.children) {
      if (typeof child === 'string') {
        continue;
      }

      // Stop if we encounter another chat component
      if (child.isChatModel) {
        continue;
      }

      walk(child);
    }
  };

  walk(completionSpan);

  // Returns the values in insertion order
  return [...messagesById.values()];
}

export function makeTemplatesForCompletion(
  completionSpan: AutoblocksSpan,
): PromptTracking | undefined {
  const trackerId = parseTrackerIdFromProps(completionSpan.props);
  if (!trackerId) {
    return undefined;
  }

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

    if (
      span.children.length > 0 &&
      span.name === makeComponentName(AutoblocksTemplateSelect)
    ) {
      tracking.templates.push(
        ...makeTemplatesFromSelectProps({
          trackerId,
          props: span.props as AutoblocksTemplateSelectProps,
          customChatModelComponent: completionSpan.customChatModelComponent,
        }),
      );
    }

    for (const child of span.children) {
      if (typeof child === 'string') {
        continue;
      }

      // Stop if we encounter another chat component
      if (child.isChatModel) {
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

function chatComponentNameToProvider(name: string): Provider | undefined {
  switch (name) {
    case makeComponentName(OpenAIChatModel):
      return 'openai';
    case makeComponentName(AnthropicChatModel):
      return 'anthropic';
  }
  return undefined;
}

function makeAutoblocksEventsForCompletion(args: {
  traceId: string;
  completionSpan: AutoblocksSpan;
  parentCompletionSpanId?: string;
}): AutoblocksEvent[] {
  if (!args.completionSpan.endTime) {
    console.warn(`Completion span ${args.completionSpan.id} has no end time.`);
    return [];
  }

  const provider = chatComponentNameToProvider(args.completionSpan.name);

  if (!provider) {
    console.warn(
      `Couldn't determine provider from completion span ${args.completionSpan.id}.`,
    );
    return [];
  }

  const messages = makeMessagesForCompletion(args.completionSpan, provider);

  const lastMessage = messages[messages.length - 1];

  // The last message should be an assistant message
  if (!lastMessage || lastMessage.role !== 'assistant') {
    console.warn(
      `Completion span ${args.completionSpan.id}'s last message is not an assistant message.`,
    );
  }

  // The request messages are all but the last message, and the response message
  // is the last message.
  const requestMessages = messages.slice(0, -1);
  const responseMessages = messages.slice(-1);

  const events: AutoblocksEvent[] = [];

  events.push({
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
        provider,
      },
    },
  });

  const latency =
    new Date(args.completionSpan.endTime).getTime() -
    new Date(args.completionSpan.startTime).getTime();

  if (args.completionSpan.error) {
    events.push({
      message: 'ai.completion.error',
      args: {
        traceId: args.traceId,
        spanId: args.completionSpan.id,
        parentSpanId: args.parentCompletionSpanId,
        timestamp: args.completionSpan.endTime,
        properties: {
          latency,
          error: args.completionSpan.error,
        },
      },
    });
  } else {
    events.push({
      message: 'ai.completion.response',
      args: {
        traceId: args.traceId,
        spanId: args.completionSpan.id,
        parentSpanId: args.parentCompletionSpanId,
        timestamp: args.completionSpan.endTime,
        properties: {
          latency,
          choices: responseMessages.map((m) => ({
            message: { role: m.role, content: m.content },
          })),
          usage: {
            completion_tokens: responseMessages.reduce(
              (acc, m) => acc + (m.tokens || 0),
              0,
            ),
          },
          provider,
        },
        promptTracking: makeTemplatesForCompletion(args.completionSpan),
      },
    });
  }

  return events;
}

export async function sendAutoblocksEventsForCompletedRootSpan(
  rootSpan: AutoblocksSpan,
) {
  const traceId = rootSpan.id;
  const events: { message: string; args: SendEventArgs }[] = [];
  const seenMemoizedIds = new Set<string>();

  const walk = (span: AutoblocksSpan, parentCompletionSpanId?: string) => {
    let completionSpanId: string | undefined = parentCompletionSpanId;

    if (span.isChatModel) {
      completionSpanId = span.id;
      const { memoizedId } = span;

      if (!memoizedId || !seenMemoizedIds.has(memoizedId)) {
        events.push(
          ...makeAutoblocksEventsForCompletion({
            traceId,
            completionSpan: span,
            parentCompletionSpanId,
          }),
        );
      }

      if (memoizedId) {
        seenMemoizedIds.add(memoizedId);
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

  const tracer = new AutoblocksTracer({ ingestionKey });
  await Promise.all(
    events.map((event) => tracer.sendEvent(event.message, event.args)),
  );
}
