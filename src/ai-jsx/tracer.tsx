import { AsyncLocalStorage } from 'node:async_hooks';
import * as AIJSX from 'ai-jsx';
import crypto from 'crypto';
import {
  findMemoizedId,
  bindAsyncGenerator,
  processCompletedRootSpan,
  makeComponentName,
} from './util';
import type { AutoblocksSpan } from './types';

export function AutoblocksJsxTracer(
  props: {
    children: AIJSX.Node;
  },
  { wrapRender }: AIJSX.ComponentContext,
) {
  const currentSpanStorage = new AsyncLocalStorage<AutoblocksSpan>();

  return AIJSX.withContext(
    <>{props.children}</>,
    wrapRender(
      (render) => (renderContext, renderable, shouldStop, appendOnly) => {
        const parentSpan = currentSpanStorage.getStore();

        if (!AIJSX.isElement(renderable)) {
          if (
            parentSpan &&
            ['string', 'boolean', 'number'].includes(typeof renderable)
          ) {
            parentSpan.children.push(`${renderable}`);
          }

          return render(renderContext, renderable, shouldStop, appendOnly);
        }

        const newSpan = {
          id: crypto.randomUUID(),
          parentId: parentSpan?.id,
          memoizedId: findMemoizedId(renderable.props),
          name: makeComponentName(renderable.tag),
          props: renderable.props,
          startTime: new Date().toISOString(),
          endTime: undefined,
          children: [],
        };

        if (parentSpan) {
          parentSpan.children.push(newSpan);
        }

        return currentSpanStorage.run(newSpan, () => {
          async function* gen() {
            const currentSpan = currentSpanStorage.getStore();
            try {
              return yield* render(
                renderContext,
                renderable,
                shouldStop,
                appendOnly,
              );
            } finally {
              if (currentSpan) {
                currentSpan.endTime = new Date().toISOString();
                if (!parentSpan) {
                  // The current span is the root span and is complete
                  try {
                    await processCompletedRootSpan(currentSpan);
                  } catch (e) {
                    console.error(`Error processing completed span: ${e}`);
                  }
                }
              }
            }
          }

          return bindAsyncGenerator(gen());
        });
      },
    ),
  );
}
