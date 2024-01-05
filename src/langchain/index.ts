import { BaseCallbackHandler } from 'langchain/callbacks';
import { Document } from 'langchain/dist/document';
import { Serialized } from 'langchain/dist/load/serializable';
import {
  AgentAction,
  AgentFinish,
  BaseMessage,
  ChainValues,
  LLMResult,
} from 'langchain/dist/schema';
import { AutoblocksTracer } from '../tracer';
import { AutoblocksEnvVar, readEnv } from '../util';
import type { ArbitraryProperties } from '../types';

export class AutoblocksCallbackHandler extends BaseCallbackHandler {
  name = 'autoblocks_handler';

  private readonly _tracer: AutoblocksTracer;
  private traceId: string | undefined = undefined;

  private readonly messagePrefix: string = 'langchain';
  private readonly messageSeparator: string = '.';

  constructor(args?: { messagePrefix?: string; messageSeparator?: string }) {
    super();

    const ingestionKey = readEnv(AutoblocksEnvVar.AUTOBLOCKS_INGESTION_KEY);
    if (!ingestionKey) {
      throw new Error(
        `You must set the ${AutoblocksEnvVar.AUTOBLOCKS_INGESTION_KEY} environment variable in order to use AutoblocksCallbackHandler.`,
      );
    }

    let langchainVersion: string | undefined = undefined;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      langchainVersion = require('langchain/package.json').version;
    } catch {
      // Couldn't determine version
    }

    this._tracer = new AutoblocksTracer({
      ingestionKey,
      properties: {
        __langchainVersion: langchainVersion,
        __langchainLanguage: 'javascript',
      },
    });

    // Allow messagePrefix to be an empty string (which will mean there is no prefix)
    if (typeof args?.messagePrefix === 'string') {
      this.messagePrefix = args.messagePrefix;
    }
    // Require messageSeparator to be a non-empty string
    if (typeof args?.messageSeparator === 'string') {
      if (args.messageSeparator.length === 0) {
        console.warn(
          `Ignoring empty messageSeparator; defaulting to "${this.messageSeparator}"`,
        );
      } else {
        this.messageSeparator = args.messageSeparator;
      }
    }
  }

  private onStart(runId: string) {
    if (this.tracer.traceId) {
      // Trace ID is being managed by the user
      return;
    } else if (this.traceId) {
      // Trace ID has already been set by this handler
      return;
    }

    this.traceId = runId;
  }

  private onEnd(runId: string) {
    if (this.traceId === runId) {
      this.traceId = undefined;
    }
  }

  private async sendEvent(
    messageParts: string[],
    properties: ArbitraryProperties,
  ) {
    const message = [this.messagePrefix, ...messageParts]
      .filter(Boolean)
      .join(this.messageSeparator);
    await this.tracer.sendEvent(message, {
      traceId: this.traceId,
      properties,
    });
  }

  get tracer(): AutoblocksTracer {
    return this._tracer;
  }

  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined,
  ) {
    this.onStart(runId);

    await this.sendEvent(['chatmodel', 'start'], {
      llm,
      messages,
      runId,
      parentRunId,
      extraParams,
      tags,
      metadata,
      name,
    });
  }

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined,
  ) {
    this.onStart(runId);

    await this.sendEvent(['llm', 'start'], {
      llm,
      prompts,
      runId,
      parentRunId,
      extraParams,
      tags,
      metadata,
      name,
    });
  }

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
  ) {
    await this.sendEvent(['llm', 'end'], {
      output,
      runId,
      parentRunId,
      tags,
    });

    this.onEnd(runId);
  }

  async handleLLMError(
    err: unknown,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
  ) {
    await this.sendEvent(['llm', 'error'], {
      err,
      runId,
      parentRunId,
      tags,
    });

    this.onEnd(runId);
  }

  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    runType?: string | undefined,
    name?: string | undefined,
  ) {
    this.onStart(runId);

    await this.sendEvent(['chain', 'start'], {
      chain,
      inputs,
      runId,
      parentRunId,
      tags,
      metadata,
      runType,
      name,
    });
  }

  async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    kwargs?: { inputs?: Record<string, unknown> | undefined } | undefined,
  ) {
    await this.sendEvent(['chain', 'end'], {
      outputs,
      runId,
      parentRunId,
      tags,
      kwargs,
    });

    this.onEnd(runId);
  }

  async handleChainError(
    err: unknown,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    kwargs?: { inputs?: Record<string, unknown> | undefined } | undefined,
  ) {
    await this.sendEvent(['chain', 'error'], {
      err,
      runId,
      parentRunId,
      tags,
      kwargs,
    });

    this.onEnd(runId);
  }

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined,
  ) {
    this.onStart(runId);

    await this.sendEvent(['tool', 'start'], {
      tool,
      input,
      runId,
      parentRunId,
      tags,
      metadata,
      name,
    });
  }

  async handleToolEnd(
    output: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
  ) {
    await this.sendEvent(['tool', 'end'], {
      output,
      runId,
      parentRunId,
      tags,
    });

    this.onEnd(runId);
  }

  async handleToolError(
    err: unknown,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
  ) {
    await this.sendEvent(['tool', 'error'], {
      err,
      runId,
      parentRunId,
      tags,
    });

    this.onEnd(runId);
  }

  async handleAgentAction(
    action: AgentAction,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
  ) {
    // Agent callbacks are only called within a chain run so we don't call onStart within this handler

    await this.sendEvent(['agent', 'action'], {
      action,
      runId,
      parentRunId,
      tags,
    });
  }

  async handleAgentEnd(
    action: AgentFinish,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
  ) {
    await this.sendEvent(['agent', 'end'], {
      action,
      runId,
      parentRunId,
      tags,
    });

    // Agent callbacks are only called within a chain run so we don't call onEnd within this handler
  }

  async handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string | undefined,
  ) {
    this.onStart(runId);

    await this.sendEvent(['retriever', 'start'], {
      retriever,
      query,
      runId,
      parentRunId,
      tags,
      metadata,
      name,
    });
  }

  async handleRetrieverEnd(
    documents: Document<Record<string, unknown>>[],
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
  ) {
    await this.sendEvent(['retriever', 'end'], {
      documents,
      runId,
      parentRunId,
      tags,
    });

    this.onEnd(runId);
  }

  async handleRetrieverError(
    err: unknown,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
  ) {
    await this.sendEvent(['retriever', 'error'], {
      err,
      runId,
      parentRunId,
      tags,
    });

    this.onEnd(runId);
  }
}
