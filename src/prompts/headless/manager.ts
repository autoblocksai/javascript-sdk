import type {
  __Autogenerated__PromptId,
  __Autogenerated__PromptMajorVersion,
  __Autogenerated__PromptMinorVersion,
  __Autogenerated__PromptModelParams,
  __Autogenerated__PromptTemplateId,
  __Autogenerated__PromptTemplateParams,
} from '../autogenerated';
import {
  zHeadlessPromptSchema,
  type TimeDelta,
  type PromptTracking,
  type HeadlessPrompt,
} from '../../types';
import {
  readEnv,
  AutoblocksEnvVar,
  convertTimeDeltaToMilliSeconds,
  HEADLESS_PROMPT_LATEST_VERSION,
} from '../../util';
import { renderTemplate } from '../util';

export class AutoblocksHeadlessPromptManager<
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
  private readonly apiBaseUrl: string = 'https://api.autoblocks.ai';

  // Map of minor version -> prompt
  private prompts: Record<string, HeadlessPrompt> = {};

  private readonly refreshIntervalTimer: NodeJS.Timer | undefined;
  private readonly refreshTimeout: TimeDelta;
  private readonly initTimeout: TimeDelta;

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
    this.minorVersionsToRequest = makeMinorVersionsToRequest(this.minorVersion);

    const apiKey = args.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
    if (!apiKey) {
      throw new Error(
        `You must either pass in the API key via 'apiKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable.`,
      );
    }
    this.apiKey = apiKey;

    if (
      this.minorVersionsToRequest.some(
        (version) => version === HEADLESS_PROMPT_LATEST_VERSION,
      )
    ) {
      const refreshInterval = args.refreshInterval || { seconds: 10 };
      console.log(
        `[${this.id}@v${this.majorVersion}] Refreshing latest prompt every ${refreshInterval.seconds} seconds`,
      );
      this.refreshIntervalTimer = setInterval(
        this.refreshLatest,
        convertTimeDeltaToMilliSeconds(refreshInterval),
      );
    }

    this.refreshTimeout = args.refreshTimeout || { seconds: 5 };
    this.initTimeout = args.initTimeout || { seconds: 5 };
  }

  private makeRequestUrl(args: { minorVersion: string }): string {
    const promptId = encodeURIComponent(this.id);
    const majorVersion = encodeURIComponent(this.majorVersion);
    const minorVersion = encodeURIComponent(args.minorVersion);
    return `${this.apiBaseUrl}/prompts/${promptId}/major/${majorVersion}/minor/${minorVersion}`;
  }

  private async getPrompt(args: {
    minorVersion: string;
    timeout: TimeDelta;
    throwOnError: boolean;
  }): Promise<HeadlessPrompt | undefined> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      convertTimeDeltaToMilliSeconds(args.timeout),
    );
    const url = this.makeRequestUrl({ minorVersion: args.minorVersion });

    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await resp.json();
      return zHeadlessPromptSchema.parse(data);
    } catch (err) {
      console.error(
        `[${this.id}@v${this.majorVersion}] Failed to fetch v${args.minorVersion}: ${err}`,
      );
      if (args.throwOnError) {
        throw err;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    return undefined;
  }

  private async refreshLatest(): Promise<void> {
    try {
      // Get the latest minor version within this prompt's major version
      const newLatest = await this.getPrompt({
        minorVersion: HEADLESS_PROMPT_LATEST_VERSION,
        timeout: this.refreshTimeout,
        throwOnError: false,
      });
      if (!newLatest) {
        console.warn(
          `[${this.id}@v${this.majorVersion}] Failed to refresh latest prompt`,
        );
        return;
      }

      // Get the prompt we're replacing
      const oldLatest = this.prompts[HEADLESS_PROMPT_LATEST_VERSION];

      // Update the prompt
      this.prompts[HEADLESS_PROMPT_LATEST_VERSION] = newLatest;

      // Log if we're replacing an older version of the prompt
      if (oldLatest && oldLatest.version !== newLatest.version) {
        console.log(
          `[${this.id}@${this.majorVersion}] Updated latest prompt from v${oldLatest.version} to v${newLatest.version}`,
        );
      }
    } catch (err) {
      console.warn(
        `[${this.id}@v${this.majorVersion}] Failed to refresh latest prompt: ${err}`,
      );
    }
  }

  async init(): Promise<void> {
    try {
      const prompts = await Promise.all(
        this.minorVersionsToRequest.map(async (minorVersion) => {
          const prompt = await this.getPrompt({
            minorVersion,
            timeout: this.initTimeout,
            throwOnError: true,
          });
          return [minorVersion, prompt] as const;
        }),
      );

      // Make the map of minor version -> prompt
      const promptsMap: Record<string, HeadlessPrompt> = {};
      prompts.forEach(([minorVersion, prompt]) => {
        if (prompt) {
          // NOTE: Use minorVersion from the `prompts` array, not `prompt.minorVersion`,
          // since for `minorVersion=latest`, `prompt.minorVersion` will be the actual
          // version of the prompt but we want to use `latest` as the key.
          promptsMap[minorVersion] = prompt;
        } else {
          throw new Error(
            `[${this.id}@${this.majorVersion}] Failed to fetch minor version v${minorVersion}`,
          );
        }
      });

      // Set the prompts
      this.prompts = promptsMap;
    } catch (err) {
      console.error(
        `[${this.id}@${this.majorVersion}] Failed to initialize prompt: ${err}`,
      );
      throw err;
    }
  }

  close(): void {
    if (this.refreshIntervalTimer) {
      clearInterval(this.refreshIntervalTimer);
    }
  }

  private choosePrompt(): HeadlessPrompt | undefined {
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
    fn: (args: { prompt: PromptRenderer<PromptId, MajorVersion> }) => T,
  ): T {
    const prompt = this.choosePrompt();
    if (!prompt) {
      throw new Error(
        `[${this.id}@${this.majorVersion}] Failed to choose execution prompt`,
      );
    }
    const renderer = new PromptRenderer<PromptId, MajorVersion>(prompt);
    return fn({ prompt: renderer });
  }
}

class PromptRenderer<
  PromptId extends __Autogenerated__PromptId,
  MajorVersion extends __Autogenerated__PromptMajorVersion<PromptId>,
> {
  private readonly prompt: HeadlessPrompt;

  constructor(prompt: HeadlessPrompt) {
    this.prompt = prompt;
  }

  get params(): __Autogenerated__PromptModelParams<PromptId, MajorVersion> {
    return this.prompt.params?.params as __Autogenerated__PromptModelParams<
      PromptId,
      MajorVersion
    >;
  }

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
    const template = this.prompt.templates.find((t) => t.id === args.template);
    if (!template) {
      throw new Error(
        `[${this.prompt.id}@${this.prompt.majorVersion}] Template '${args.template}' not found.`,
      );
    }

    return renderTemplate({
      template: template.template,
      params: args.params as Record<string, unknown>,
    });
  }

  track(): PromptTracking {
    return {
      id: this.prompt.id,
      version: this.prompt.version,
      templates: this.prompt.templates,
    };
  }
}

function makeMinorVersionsToRequest(
  minorVersion: string | { version: string }[],
): string[] {
  const versions: Set<string> = new Set();
  if (Array.isArray(minorVersion)) {
    minorVersion.forEach((minor) => {
      versions.add(minor.version);
    });
  } else {
    versions.add(minorVersion);
  }
  return Array.from(versions);
}
