import type {
  DatasetItem,
  DatasetName,
  DatasetSchemaVersion,
} from './datasets';
import type { HumanReviewFieldContentType, TimeDelta } from './types';
import {
  convertTimeDeltaToMilliSeconds,
  readEnv,
  AutoblocksEnvVar,
  AUTOBLOCKS_HEADERS,
  API_ENDPOINT,
} from './util';

export interface View {
  id: string;
  name: string;
}

export interface Event {
  id: string;
  traceId: string;
  message: string;
  timestamp: string;
  properties: Record<string, unknown>;
}

export interface Trace {
  id: string;
  events: Event[];
}

export interface ManagedTestCase<T> {
  id: string;
  body: T;
}

interface RelativeTimeFilter {
  type: 'relative';
  seconds?: number;
  minutes?: number;
  hours?: number;
  days?: number;
  weeks?: number;
  months?: number;
  years?: number;
}

interface AbsoluteTimeFilter {
  type: 'absolute';
  start: string;
  end: string;
}

interface TraceFilter {
  operator: 'CONTAINS' | 'NOT_CONTAINS';
  eventFilters: {
    key: string;
    value: string;
    operator:
      | 'CONTAINS'
      | 'NOT_CONTAINS'
      | 'EQUALS'
      | 'NOT_EQUALS'
      | 'LESS_THAN'
      | 'LESS_THAN_OR_EQUALS'
      | 'GREATER_THAN'
      | 'GREATER_THAN_OR_EQUALS';
  }[];
}

export enum SystemEventFilterKey {
  MESSAGE = 'SYSTEM:message',
  LABEL = 'SYSTEM:label',
}

export enum HumanReviewTestCaseStatus {
  SUBMITTED = 'Submitted',
  PENDING = 'Pending',
  DRAFT = 'Draft',
}

export interface HumanReviewJob {
  id: string;
  name: string;
  reviewer: { id: string; email: string };
}

export interface HumanReviewJobWithTestCases extends HumanReviewJob {
  testCases: { id: string; status: HumanReviewTestCaseStatus }[];
}

export interface HumanReviewJobTestCaseResult {
  id: string;
  reviewer: { id: string; email: string };
  status: HumanReviewTestCaseStatus;
  grades: { name: string; grade: number }[];
  automatedEvaluations: {
    id: string;
    originalScore: number;
    overrideScore: number;
    overrideReason?: string;
  }[];
  inputFields: {
    id: string;
    name: string;
    value: string;
    contentType: HumanReviewFieldContentType;
  }[];
  outputFields: {
    id: string;
    name: string;
    value: string;
    contentType: HumanReviewFieldContentType;
  }[];
  fieldComments: {
    fieldId: string;
    startIdx?: number;
    endIdx?: number;
    value: string;
    inRelationToGradeName?: string;
    inRelationToAutomatedEvaluationId?: string;
  }[];
  inputComments: {
    value: string;
    inRelationToGradeName?: string;
    inRelationToAutomatedEvaluationId?: string;
  }[];
  outputComments: {
    value: string;
    inRelationToGradeName?: string;
    inRelationToAutomatedEvaluationId?: string;
  }[];
}

interface ClientArgs {
  apiKey?: string;
  timeout?: TimeDelta;
}

interface ResultWithEvaluations {
  id: string;
  runId: string;
  hash: string;
  datasetItemId: string;
  durationMs: number;
  events?: Event[];
  body: {
    id: string;
    name: string;
    value: string;
    contentType: HumanReviewFieldContentType;
  }[];
  output: {
    id: string;
    name: string;
    value: string;
    contentType: HumanReviewFieldContentType;
  }[];
  evaluations: {
    evaluatorId: string;
    score: number;
    passed: boolean | null;
    threshold?: number;
    metadata?: Record<string, unknown>;
  }[];
}

export class AutoblocksAPIClient {
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  // Deprecated constructor
  constructor(apiKey: string, args?: ClientArgs);
  // Current constructor
  constructor(args?: ClientArgs);
  constructor(keyOrArgs?: string | ClientArgs, maybeArgs?: ClientArgs) {
    const args = typeof keyOrArgs === 'string' ? maybeArgs : keyOrArgs;
    const key =
      typeof keyOrArgs === 'string'
        ? keyOrArgs
        : args?.apiKey || readEnv(AutoblocksEnvVar.AUTOBLOCKS_API_KEY);
    if (!key) {
      throw new Error(
        `You must either pass in the API key via 'apiKey' or set the '${AutoblocksEnvVar.AUTOBLOCKS_API_KEY}' environment variable.`,
      );
    }
    this.apiKey = key;
    this.timeoutMs = convertTimeDeltaToMilliSeconds(
      args?.timeout || { seconds: 60 },
    );
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!resp.ok) {
      throw new Error(
        `HTTP Request Error: GET ${url} "${resp.status} ${resp.statusText}"`,
      );
    }
    return resp.json();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!resp.ok) {
      throw new Error(
        `HTTP Request Error: POST ${url} "${resp.status} ${resp.statusText}"`,
      );
    }
    return resp.json();
  }

  public async getViews(): Promise<View[]> {
    return this.get('/views');
  }

  public async getTracesFromView(args: {
    viewId: string;
    pageSize: number;
    cursor?: string;
  }): Promise<{ nextCursor?: string; traces: Trace[] }> {
    const params = new URLSearchParams({
      pageSize: args.pageSize.toString(),
    });
    if (args.cursor) {
      params.set('cursor', args.cursor);
    }
    return this.get(
      `/views/${encodeURIComponent(args.viewId)}/traces?${params.toString()}`,
    );
  }

  public async searchTraces(args: {
    pageSize: number;
    timeFilter: RelativeTimeFilter | AbsoluteTimeFilter;
    traceFilters?: TraceFilter[];
    query?: string;
    cursor?: string;
  }): Promise<{ nextCursor?: string; traces: Trace[] }> {
    return this.post(`/traces/search`, {
      pageSize: args.pageSize,
      timeFilter: args.timeFilter,
      traceFilters: args.traceFilters,
      query: args.query,
      cursor: args.cursor,
    });
  }

  public async getTestCases<T>(args: {
    testSuiteId: string;
  }): Promise<{ testCases: ManagedTestCase<T>[] }> {
    return this.get(`/test-suites/${args.testSuiteId}/test-cases`);
  }

  public async getHumanReviewJobs(): Promise<{ jobs: HumanReviewJob[] }> {
    return this.get('/human-review/jobs');
  }

  public async getTestCasesForHumanReviewJob(args: {
    jobId: string;
  }): Promise<HumanReviewJobWithTestCases> {
    return this.get(
      `/human-review/jobs/${encodeURIComponent(args.jobId)}/test-cases`,
    );
  }

  public async getTestCaseResultForHumanReviewJob(args: {
    jobId: string;
    testCaseId: string;
  }): Promise<HumanReviewJobTestCaseResult> {
    return this.get(
      `/human-review/jobs/${encodeURIComponent(args.jobId)}/test-cases/${encodeURIComponent(
        args.testCaseId,
      )}`,
    );
  }

  public async getLocalRuns(testExternalId: string): Promise<{
    runs: {
      id: string;
    }[];
  }> {
    return this.get(
      `/testing/local/tests/${encodeURIComponent(testExternalId)}/runs`,
    );
  }

  public async getCIRuns(testExternalId: string): Promise<{
    runs: {
      id: string;
    }[];
  }> {
    return this.get(
      `/testing/ci/tests/${encodeURIComponent(testExternalId)}/runs`,
    );
  }

  public async getLocalResults(runId: string): Promise<{
    results: {
      id: string;
    }[];
  }> {
    return this.get(`/testing/local/runs/${encodeURIComponent(runId)}/results`);
  }

  public async getCIResults(runId: string): Promise<{
    results: {
      id: string;
    }[];
  }> {
    return this.get(`/testing/ci/runs/${encodeURIComponent(runId)}/results`);
  }

  public async getLocalResultWithEvaluations(
    testCaseResultId: string,
  ): Promise<ResultWithEvaluations> {
    return this.get(
      `/testing/local/results/${encodeURIComponent(testCaseResultId)}/evaluations`,
    );
  }

  public async getCIResultWithEvaluations(
    testCaseResultId: string,
  ): Promise<ResultWithEvaluations> {
    return this.get(
      `/testing/ci/results/${encodeURIComponent(testCaseResultId)}/evaluations`,
    );
  }

  public async getDataset<
    T extends DatasetName,
    U extends DatasetSchemaVersion<T>,
  >(args: {
    name: T;
    schemaVersion: U;
    revisionId?: string;
    splits?: string[];
  }): Promise<{
    name: T;
    schemaVersion: U;
    revisionId: string;
    items: {
      id: string;
      splits: string[];
      data: DatasetItem<T, U>;
    }[];
  }> {
    const encodedName = encodeURIComponent(args.name);
    const encodedSchemaVersion = encodeURIComponent(args.schemaVersion);
    const splitsQueryParam = args.splits
      ? `?splits=${args.splits?.map(encodeURIComponent).join(',')}`
      : '';
    if (args.revisionId) {
      return this.get(
        `/datasets/${encodedName}/schema-versions/${encodedSchemaVersion}/revisions/${encodeURIComponent(
          args.revisionId,
        )}${splitsQueryParam}`,
      );
    }

    return this.get(
      `/datasets/${encodedName}/schema-versions/${encodedSchemaVersion}${splitsQueryParam}`,
    );
  }
}
