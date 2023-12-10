import { AsyncLocalStorage } from 'node:async_hooks';
import * as AIJSX from 'ai-jsx';
import crypto from 'crypto';
import {
  findMemoizedId,
  bindAsyncGenerator,
  sendAutoblocksEventsForCompletedRootSpan,
  makeComponentName,
  isChatModelComponent,
  makeTemplatesForCompletion,
} from './util';
import type { AnyComponent, AnyElement, AutoblocksSpan } from './types';
import { AutoblocksLoggerAttribute } from './enum';

export function AutoblocksJsxTracer(
  props: {
    children: AIJSX.Node;
    skipSendingEvents?: boolean;
    customChatModelComponent?: AnyComponent;
  },
  { wrapRender }: AIJSX.ComponentContext,
) {
  const currentSpanStorage = new AsyncLocalStorage<AutoblocksSpan>();
  const elementToRenderId = new WeakMap<AnyElement, string>();

  /**
   * Wrap setAttribute so we can track the render ID for each element.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeSetAttributeWrapper(func: any): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function wrapper(this: any, ...args: any[]): any {
      const [element, renderId] = args;
      elementToRenderId.set(element, renderId);
      return func.apply(this, args);
    };
  }

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
          isChatModel: isChatModelComponent(
            renderable.tag,
            props.customChatModelComponent,
          ),
          customChatModelComponent: props.customChatModelComponent,
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

            // Get the logger for this render context and apply the setAttribute wrapper
            const logger = renderContext.getContext(AIJSX.LoggerContext);
            logger.setAttribute = makeSetAttributeWrapper(logger.setAttribute);

            try {
              return yield* render(
                renderContext,
                renderable,
                shouldStop,
                appendOnly,
              );
            } catch (err) {
              if (currentSpan) {
                currentSpan.error = `${err}`;
              }

              throw err;
            } finally {
              try {
                if (currentSpan) {
                  currentSpan.endTime = new Date().toISOString();
                  if (!parentSpan) {
                    // If there is no parent span, the current span is the root span and is complete
                    if (!props.skipSendingEvents) {
                      await sendAutoblocksEventsForCompletedRootSpan(
                        currentSpan,
                      );
                    }
                  }

                  if (AIJSX.isElement(renderable) && currentSpan.isChatModel) {
                    // A chat model component just finished rendering; determine the templates
                    // used within the component and set them as an attribute on the logger.
                    // Logger attributes are how AI.JSX has decided to expose internal details
                    // for observability purposes, so some users rely on these attributes:
                    // https://github.com/search?q=repo%3Afixie-ai%2Fai-jsx%20setAttribute&type=code
                    const renderId = elementToRenderId.get(renderable);
                    const promptTracking =
                      makeTemplatesForCompletion(currentSpan);
                    if (
                      renderId &&
                      promptTracking &&
                      promptTracking.templates.length > 0
                    ) {
                      logger.setAttribute(
                        renderable,
                        renderId,
                        AutoblocksLoggerAttribute.PROMPT_TRACKING,
                        JSON.stringify(promptTracking),
                      );
                    }
                  }
                }
              } catch (err) {
                console.error(`Error processing span: ${err}`);
              }
            }
          }

          return bindAsyncGenerator(gen());
        });
      },
    ),
  );
}
