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
import { AUTOBLOCKS_INGESTION_KEY, readEnv } from '../util';

export class AutoblocksCallbackHandler extends BaseCallbackHandler {
  name = 'autoblocks_handler';

  private _tracer: AutoblocksTracer;
  private traceId: string | undefined = undefined;

  constructor() {
    super();

    const ingestionKey = readEnv(AUTOBLOCKS_INGESTION_KEY);
    if (!ingestionKey) {
      throw new Error(
        `You must set the ${AUTOBLOCKS_INGESTION_KEY} environment variable in order to use AutoblocksCallbackHandler.`,
      );
    }

    let langchainVersion: string | undefined = undefined;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      langchainVersion = require('langchain/package.json').version;
    } catch {
      // Couldn't determine version
    }

    this._tracer = new AutoblocksTracer(ingestionKey, {
      properties: {
        __langchainVersion: langchainVersion,
        __langchainLanguage: 'javascript',
      },
    });
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
    message: string,
    properties: Record<string, unknown>,
  ) {
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

    await this.sendEvent('langchain.chatmodel.start', {
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

    await this.sendEvent('langchain.llm.start', {
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
    await this.sendEvent('langchain.llm.end', {
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
    await this.sendEvent('langchain.llm.error', {
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

    await this.sendEvent('langchain.chain.start', {
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
    await this.sendEvent('langchain.chain.end', {
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
    await this.sendEvent('langchain.chain.error', {
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

    await this.sendEvent('langchain.tool.start', {
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
    await this.sendEvent('langchain.tool.end', {
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
    await this.sendEvent('langchain.tool.error', {
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

    await this.sendEvent('langchain.agent.action', {
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
    await this.sendEvent('langchain.agent.end', {
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

    await this.sendEvent('langchain.retriever.start', {
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
    await this.sendEvent('langchain.retriever.end', {
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
    await this.sendEvent('langchain.retriever.error', {
      err,
      runId,
      parentRunId,
      tags,
    });

    this.onEnd(runId);
  }
}
