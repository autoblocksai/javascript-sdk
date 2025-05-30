import type {
  DatasetItem,
  DatasetName,
  DatasetSchemaVersion,
} from '../datasets';
import type { HumanReviewFieldContentType, TimeDelta } from '../types';
import {
  convertTimeDeltaToMilliSeconds,
  readEnv,
  AutoblocksEnvVar,
  AUTOBLOCKS_HEADERS,
  API_ENDPOINT,
} from '../util';

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

interface TestResultWithEvaluations<T = unknown, U = unknown> {
  id: string;
  runId: string;
  hash: string;
  datasetItemId?: string;
  durationMs?: number;
  events?: Event[];
  body: T;
  output: U;
  evaluations: {
    evaluatorId: string;
    score: number;
    passed?: boolean;
    threshold?: {
      lt?: number;
      lte?: number;
      gt?: number;
      gte?: number;
      assertions: {
        passed: boolean;
        required: boolean;
        criterion: string;
        metadata?: Record<string, unknown>;
      }[];
    };
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

  private async delete<T>(path: string): Promise<T> {
    const url = `${API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!resp.ok) {
      throw new Error(
        `HTTP Request Error: DELETE ${url} "${resp.status} ${resp.statusText}"`,
      );
    }
    return resp.json();
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const url = `${API_ENDPOINT}${path}`;
    const resp = await fetch(url, {
      method: 'PUT',
      headers: {
        ...AUTOBLOCKS_HEADERS,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!resp.ok) {
      throw new Error(
        `HTTP Request Error: PUT ${url} "${resp.status} ${resp.statusText}"`,
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

  public async getHumanReviewJobPairs(args: {
    jobId: string;
  }): Promise<{ pairs: { id: string }[] }> {
    return this.get(
      `/human-review/jobs/${encodeURIComponent(args.jobId)}/pairs`,
    );
  }

  public async getHumanReviewJobPair(args: {
    jobId: string;
    pairId: string;
  }): Promise<{
    pair: {
      pairId: string;
      chosenId?: string;
      testCases: {
        id: string;
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
      }[];
    };
  }> {
    return this.get(
      `/human-review/jobs/${encodeURIComponent(args.jobId)}/pairs/${encodeURIComponent(
        args.pairId,
      )}`,
    );
  }

  public async getLocalTestRuns(testExternalId: string): Promise<{
    runs: {
      id: string;
    }[];
  }> {
    return this.get(
      `/testing/local/tests/${encodeURIComponent(testExternalId)}/runs`,
    );
  }

  public async getCITestRuns(testExternalId: string): Promise<{
    runs: {
      id: string;
    }[];
  }> {
    return this.get(
      `/testing/ci/tests/${encodeURIComponent(testExternalId)}/runs`,
    );
  }

  public async getLocalTestResults(runId: string): Promise<{
    results: {
      id: string;
    }[];
  }> {
    return this.get(`/testing/local/runs/${encodeURIComponent(runId)}/results`);
  }

  public async getCITestResults(runId: string): Promise<{
    results: {
      id: string;
    }[];
  }> {
    return this.get(`/testing/ci/runs/${encodeURIComponent(runId)}/results`);
  }

  public async getLocalTestResult<
    ResultBodyType = unknown,
    ResultOutputType = unknown,
  >(
    testCaseResultId: string,
  ): Promise<TestResultWithEvaluations<ResultBodyType, ResultOutputType>> {
    return this.get(
      `/testing/local/results/${encodeURIComponent(testCaseResultId)}`,
    );
  }

  public async getCITestResult<
    ResultBodyType = unknown,
    ResultOutputType = unknown,
  >(
    testCaseResultId: string,
  ): Promise<TestResultWithEvaluations<ResultBodyType, ResultOutputType>> {
    return this.get(
      `/testing/ci/results/${encodeURIComponent(testCaseResultId)}`,
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

  public async createDatasetItem(args: {
    name: string;
    data: Record<string, unknown>;
    splits?: string[];
  }): Promise<{ revisionId: string }> {
    const response: { id: string } = await this.post(
      `/datasets/${encodeURIComponent(args.name)}/items`,
      {
        data: args.data,
        splitNames: args.splits ?? [],
      },
    );

    return { revisionId: response.id };
  }

  public async deleteDatasetItem(args: {
    name: string;
    itemId: string;
  }): Promise<{ revisionId: string }> {
    const response: { id: string } = await this.delete(
      `/datasets/${encodeURIComponent(args.name)}/items/${encodeURIComponent(args.itemId)}`,
    );

    return { revisionId: response.id };
  }

  public async updateDatasetItem(args: {
    name: string;
    itemId: string;
    data: Record<string, unknown>;
    splits?: string[];
  }): Promise<{ revisionId: string }> {
    const response: { id: string } = await this.put(
      `/datasets/${encodeURIComponent(args.name)}/items/${encodeURIComponent(args.itemId)}`,
      { data: args.data, splitNames: args.splits ?? [] },
    );

    return { revisionId: response.id };
  }
}
