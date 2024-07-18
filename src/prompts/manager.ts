import type {
  __Autogenerated__PromptId,
  __Autogenerated__PromptMajorVersion,
  __Autogenerated__PromptMinorVersion,
  __Autogenerated__PromptParams,
  __Autogenerated__PromptTemplateId,
  __Autogenerated__PromptTemplateParams,
  __Autogenerated__PromptToolName,
  __Autogenerated__PromptToolParams,
} from './autogenerated';
import {
  zPromptSchema,
  type TimeDelta,
  type PromptTracking,
  type Prompt,
} from '../types';
import {
  readEnv,
  AutoblocksEnvVar,
  convertTimeDeltaToMilliSeconds,
  RevisionSpecialVersionsEnum,
  AUTOBLOCKS_HEADERS,
  API_ENDPOINT,
  REVISION_UNDEPLOYED_VERSION,
} from '../util';
import { renderTemplateWithParams, renderToolWithParams } from './util';

/**
 * Note that we check for the presence of the CLI environment
 * variable and not the test case local storage because the
 * local storage vars aren't set until runTestSuite is called,
 * whereas a prompt manager might have already been imported
 * and initialized by the time runTestSuite is called.
 */
const isTestingContext = (): boolean => {
  return readEnv(AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS) !== undefined;
};

/**
 * The AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS environment variable is a JSON-stringified
 * map of prompt IDs to revision IDs. This is set in CI test runs triggered
 * from the UI.
 */
const promptRevisionsMap = (): Record<string, string> => {
  if (!isTestingContext()) {
    return {};
  }

  const promptRevisionsRaw = readEnv(
    AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES_PROMPT_REVISIONS,
  );
  if (!promptRevisionsRaw) {
    return {};
  }

  return JSON.parse(promptRevisionsRaw);
};

export class AutoblocksPromptManager<
  PromptId extends __Autogenerated__PromptId,
  MajorVersion extends __Autogenerated__PromptMajorVersion<PromptId>,
  MinorVersion extends __Autogenerated__PromptMinorVersion<
    PromptId,
    MajorVersion
  >,
> {
  private readonly id: PromptId;
  private readonly majorVersion: string;
  private readonly minorVersion: string | { version: string; weight: number }[];
  private readonly minorVersionsToRequest: string[];

  private readonly apiKey: string;

  // Map of minor version -> prompt
  private prompts: Record<string, Prompt> = {};

  // Used in a testing context to override the prompt with
  // a revision if AUTOBLOCKS_PROMPT_REVISIONS is set for this
  // prompt ID.
  private promptRevisionOverride: Prompt | undefined = undefined;

  private readonly refreshIntervalTimer: NodeJS.Timer | undefined;
  private readonly refreshTimeoutMs: number;
  private readonly initTimeoutMs: number;

  constructor(args: {
    id: PromptId;
    version: {
      major: MajorVersion;
      minor:
        | MinorVersion
        | [
            { version: MinorVersion; weight: number },
            ...{ version: MinorVersion; weight: number }[],
          ];
    };
    apiKey?: string;
    refreshInterval?: TimeDelta;
    refreshTimeout?: TimeDelta;
    initTimeout?: TimeDelta;
  }) {
    this.id = args.id;
    this.majorVersion = args.version.major;
    this.minorVersion = args.version.minor;
    this.minorVersionsToRequest = makeMinorVersionsToRequest({
      minorVersion: this.minorVersion,
    });

    const apiKey = args.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
    if (!apiKey) {
      throw new Error(
        `You must either pass in the API key via 'apiKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable.`,
      );
    }
    this.apiKey = apiKey;

    this.refreshTimeoutMs = convertTimeDeltaToMilliSeconds(
      args.refreshTimeout || { seconds: 30 },
    );
    this.initTimeoutMs = convertTimeDeltaToMilliSeconds(
      args.initTimeout || { seconds: 30 },
    );

    if (
      this.minorVersionsToRequest.includes(RevisionSpecialVersionsEnum.LATEST)
    ) {
      if (isTestingContext()) {
        this.logger.info(
          'Prompt refreshing is disabled when in a testing context.',
        );
        return;
      }

      const refreshInterval = args.refreshInterval || { seconds: 10 };
      const refreshIntervalMs = convertTimeDeltaToMilliSeconds(refreshInterval);
      if (refreshIntervalMs < 1000) {
        throw new Error(
          `Refresh interval can't be shorter than 1 second (got ${refreshIntervalMs}ms)`,
        );
      }
      this.logger.info(
        `Refreshing latest prompt every ${Math.round(
          refreshIntervalMs / 1000,
        )} seconds`,
      );
      this.refreshIntervalTimer = setInterval(
        this.refreshLatest.bind(this),
        refreshIntervalMs,
      );
    }
  }

  private get logger() {
    const prefix = `[${this.id}@v${this.majorVersion}]`;
    return {
      info: (message: string) => console.info(`${prefix} ${message}`),
      warn: (message: string) => console.warn(`${prefix} ${message}`),
      error: (message: string) => console.error(`${prefix} ${message}`),
    };
  }

  private makeRequestUrl(args: { minorVersion: string }): string {
    const promptId = encodeURIComponent(this.id);

    let majorVersion: string;
    let minorVersion: string = args.minorVersion;

    if (
      this.majorVersion ===
      RevisionSpecialVersionsEnum.DANGEROUSLY_USE_UNDEPLOYED
    ) {
      majorVersion = REVISION_UNDEPLOYED_VERSION;
    } else {
      majorVersion = this.majorVersion;
    }

    majorVersion = encodeURIComponent(majorVersion);
    minorVersion = encodeURIComponent(minorVersion);

    return `${API_ENDPOINT}/prompts/${promptId}/major/${majorVersion}/minor/${minorVersion}`;
  }

  private makeRevisionValidateOverrideRequestUrl(args: {
    revisionId: string;
  }): string {
    const promptId = encodeURIComponent(this.id);
    const revisionId = encodeURIComponent(args.revisionId);

    return `${API_ENDPOINT}/prompts/${promptId}/revisions/${revisionId}/validate`;
  }

  private async getPrompt(args: {
    minorVersion: string;
    timeoutMs: number;
    throwOnError: boolean;
  }): Promise<Prompt | undefined> {
    const url = this.makeRequestUrl({ minorVersion: args.minorVersion });

    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          ...AUTOBLOCKS_HEADERS,
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(args.timeoutMs),
      });
      const data = await resp.json();
      return zPromptSchema.parse(data);
    } catch (err) {
      this.logger.error(
        `Failed to fetch version v${this.majorVersion}.${args.minorVersion}: ${err}`,
      );
      if (args.throwOnError) {
        throw err;
      }
    }

    return undefined;
  }

  /**
   * If this prompt has a revision override set, use the /validate endpoint to check if the
   * major version this prompt manager is configured to use is compatible to be
   * overridden with the revision.
   */
  private async setPromptRevisionOverride(args: {
    revisionId: string;
  }): Promise<void> {
    // Double check we're in a testing context
    if (!isTestingContext()) {
      this.logger.error(
        "Can't set prompt revision unless in a testing context.",
      );
      return;
    }

    // Double check the given revisionId belongs to this prompt manager
    const expectedRevisionId = promptRevisionsMap()[this.id];
    if (args.revisionId !== expectedRevisionId) {
      throw new Error(
        `Revision ID '${args.revisionId}' does not match the revision ID for this prompt manager '${expectedRevisionId}'.`,
      );
    }

    if (
      this.majorVersion ===
      RevisionSpecialVersionsEnum.DANGEROUSLY_USE_UNDEPLOYED
    ) {
      throw new Error(
        `Prompt revision overrides are not yet supported for prompt managers using 'dangerously-use-undeployed'.
        Reach out to support@autoblocks.ai for more details.`,
      );
    }

    const url = this.makeRevisionValidateOverrideRequestUrl({
      revisionId: args.revisionId,
    });
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        majorVersion: parseInt(this.majorVersion, 10),
      }),
      signal: AbortSignal.timeout(this.initTimeoutMs),
    });

    if (resp.status === 409) {
      // The /validate endpoint returns this status code when the revision is
      // not compatible with the major version this prompt manager
      // is configured to use.
      throw new Error(
        `Can't override prompt '${this.id}' with revision '${args.revisionId}' because it is not compatible with major version '${this.majorVersion}'.`,
      );
    }

    const data = await resp.json();

    // Throw for any unexpected errors
    if (!resp.ok) {
      throw new Error(`HTTP Error: ${JSON.stringify(data)}`);
    }

    this.logger.warn(
      `Overriding prompt '${this.id}' with revision '${args.revisionId}'!`,
    );
    this.promptRevisionOverride = zPromptSchema.parse(data);
  }

  private async refreshLatest(): Promise<void> {
    try {
      // Get the latest minor version within this prompt's major version
      const newLatest = await this.getPrompt({
        minorVersion: RevisionSpecialVersionsEnum.LATEST,
        timeoutMs: this.refreshTimeoutMs,
        throwOnError: false,
      });
      if (!newLatest) {
        this.logger.warn(`Failed to refresh latest prompt`);
        return;
      }

      // Get the prompt we're replacing
      const oldLatest = this.prompts[RevisionSpecialVersionsEnum.LATEST];

      // Update the prompt
      this.prompts[RevisionSpecialVersionsEnum.LATEST] = newLatest;

      // Log if we're replacing an older version of the prompt
      if (oldLatest && oldLatest.version !== newLatest.version) {
        this.logger.info(
          `Updated latest prompt from v${oldLatest.version} to v${newLatest.version}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to refresh latest prompt: ${err}`);
    }
  }

  private async initUnsafe(): Promise<void> {
    if (isTestingContext() && promptRevisionsMap()[this.id]) {
      // Set the prompt revision override if we're in a testing context and a
      // revision is set for this manager's prompt ID
      const revisionId = promptRevisionsMap()[this.id];
      await this.setPromptRevisionOverride({ revisionId });
      return;
    }

    // Not in testing context or no revision override set, proceed as configured
    const prompts = await Promise.all(
      this.minorVersionsToRequest.map(async (minorVersion) => {
        const prompt = await this.getPrompt({
          minorVersion,
          timeoutMs: this.initTimeoutMs,
          throwOnError: true,
        });
        return [minorVersion, prompt] as const;
      }),
    );

    // Make the map of minor version -> prompt
    const promptsMap: Record<string, Prompt> = {};
    prompts.forEach(([minorVersion, prompt]) => {
      if (prompt) {
        // NOTE: Use minorVersion from the `prompts` array, not `prompt.minorVersion`,
        // since for `minorVersion=latest`, `prompt.minorVersion` will be the actual
        // version of the prompt but we want to use `latest` as the key.
        promptsMap[minorVersion] = prompt;
      } else {
        throw new Error(
          `Failed to fetch version v${this.majorVersion}.${minorVersion}`,
        );
      }
    });

    // Set the prompts
    this.prompts = promptsMap;
  }

  async init(): Promise<void> {
    try {
      await this.initUnsafe();
    } catch (err) {
      this.logger.error(`Failed to initialize prompt manager: ${err}`);
      throw err;
    }
    this.logger.info('Successfully initialized prompt manager!');
  }

  close(): void {
    if (this.refreshIntervalTimer) {
      clearInterval(this.refreshIntervalTimer);
    }
  }

  private chooseExecutionPrompt(): Prompt | undefined {
    if (isTestingContext() && this.promptRevisionOverride) {
      // Always use the prompt revision override if it is set
      return this.promptRevisionOverride;
    }
    if (Array.isArray(this.minorVersion)) {
      const weightTotal = this.minorVersion.reduce(
        (acc, cur) => acc + cur.weight,
        0,
      );
      const rand = Math.random() * weightTotal;
      let cur = 0;
      for (const minor of this.minorVersion) {
        cur += minor.weight;
        if (rand < cur) {
          return this.prompts[minor.version];
        }
      }

      // We shouldn't reach this point, but just in case,
      // return first in the weighted list.
      return this.prompts[this.minorVersion[0].version];
    } else {
      return this.prompts[this.minorVersion];
    }
  }

  exec<T = unknown>(
    fn: (args: { prompt: PromptExecutionContext<PromptId, MajorVersion> }) => T,
  ): T {
    const prompt = this.chooseExecutionPrompt();
    if (!prompt) {
      throw new Error(
        `[${this.id}@${this.majorVersion}] Failed to choose execution prompt. Did you initialize the prompt manager?`,
      );
    }
    const ctx = new PromptExecutionContext<PromptId, MajorVersion>(prompt);
    return fn({ prompt: ctx });
  }
}

class PromptExecutionContext<
  PromptId extends __Autogenerated__PromptId,
  MajorVersion extends __Autogenerated__PromptMajorVersion<PromptId>,
> {
  private readonly prompt: Prompt;

  constructor(prompt: Prompt) {
    this.prompt = prompt;
  }

  get params(): __Autogenerated__PromptParams<PromptId, MajorVersion> {
    return this.prompt.params?.params as __Autogenerated__PromptParams<
      PromptId,
      MajorVersion
    >;
  }

  /**
   * @deprecated use 'renderTemplate' instead
   */
  render<
    TemplateID extends __Autogenerated__PromptTemplateId<
      PromptId,
      MajorVersion
    >,
  >(args: {
    template: TemplateID;
    params: __Autogenerated__PromptTemplateParams<
      PromptId,
      MajorVersion,
      TemplateID
    >;
  }): string {
    return this.renderTemplate(args);
  }

  renderTemplate<
    TemplateID extends __Autogenerated__PromptTemplateId<
      PromptId,
      MajorVersion
    >,
  >(args: {
    template: TemplateID;
    params: __Autogenerated__PromptTemplateParams<
      PromptId,
      MajorVersion,
      TemplateID
    >;
  }): string {
    const template = this.prompt.templates.find((t) => t.id === args.template);
    if (!template) {
      throw new Error(
        `[${this.prompt.id}@${this.prompt.version}] Template '${args.template}' not found.`,
      );
    }

    return renderTemplateWithParams({
      template: template.template,
      params: args.params as Record<string, unknown>,
    });
  }

  renderTool<
    ToolName extends __Autogenerated__PromptToolName<PromptId, MajorVersion>,
  >(args: {
    tool: ToolName;
    params: __Autogenerated__PromptToolParams<PromptId, MajorVersion, ToolName>;
  }): Record<string, unknown> {
    if (!this.prompt.tools) {
      throw new Error(
        `[${this.prompt.id}@${this.prompt.version}] Tool '${args.tool}' not found. No tools defined.`,
      );
    }
    const tool = this.prompt.tools.find((t) => t.name === args.tool);
    if (!tool) {
      throw new Error(
        `[${this.prompt.id}@${this.prompt.version}] Tool '${args.tool}' not found.`,
      );
    }

    return renderToolWithParams({
      tool,
      params: args.params as Record<string, unknown>,
    });
  }

  track(): PromptTracking {
    return {
      id: this.prompt.id,
      version: this.prompt.version,
      templates: this.prompt.templates,
      params: this.prompt.params ?? undefined,
    };
  }
}

function makeMinorVersionsToRequest(args: {
  minorVersion: string | { version: string }[];
}): string[] {
  const versions: Set<string> = new Set();
  if (Array.isArray(args.minorVersion)) {
    args.minorVersion.forEach((minor) => {
      versions.add(minor.version);
    });
  } else {
    versions.add(args.minorVersion);
  }
  return Array.from(versions);
}
