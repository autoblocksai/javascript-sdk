import { BaseAppResourceClient } from '../api/base-app-resource-client';
import {
  HumanReviewJobListResponse,
  HumanReviewJobDetail,
  HumanReviewJobItemDetail,
  GetJobTestCasesResponse,
  GetJobTestCaseResultResponse,
  GetJobPairsResponse,
  GetJobPairResponse,
} from './models';

export class HumanReviewClient extends BaseAppResourceClient {
  /**
   * Get all jobs for the app
   */
  async listJobs(): Promise<HumanReviewJobListResponse> {
    return this.get<HumanReviewJobListResponse>(
      `/apps/${this.appSlug}/human-review/jobs`,
    );
  }

  /**
   * Get a specific job by ID
   */
  async getJob(jobId: string): Promise<HumanReviewJobDetail> {
    return this.get<HumanReviewJobDetail>(
      `/apps/${this.appSlug}/human-review/jobs/${jobId}`,
    );
  }

  /**
   * Get a specific job item by ID
   */
  async getJobItem(args: {
    jobId: string;
    itemId: string;
  }): Promise<HumanReviewJobItemDetail> {
    return this.get<HumanReviewJobItemDetail>(
      `/apps/${this.appSlug}/human-review/jobs/${args.jobId}/items/${args.itemId}`,
    );
  }

  /**
   * Get all test cases for a job
   */
  async getJobTestCases(jobId: string): Promise<GetJobTestCasesResponse> {
    return this.get<GetJobTestCasesResponse>(
      `/apps/${this.appSlug}/human-review/jobs/${jobId}/test_cases`,
    );
  }

  /**
   * Get the result for a specific test case
   */
  async getJobTestCaseResult(args: {
    jobId: string;
    testCaseId: string;
  }): Promise<GetJobTestCaseResultResponse> {
    return this.get<GetJobTestCaseResultResponse>(
      `/apps/${this.appSlug}/human-review/jobs/${args.jobId}/test_cases/${args.testCaseId}/result`,
    );
  }

  /**
   * Get all comparison pairs for a job
   */
  async getJobPairs(jobId: string): Promise<GetJobPairsResponse> {
    return this.get<GetJobPairsResponse>(
      `/apps/${this.appSlug}/human-review/jobs/${jobId}/pairs`,
    );
  }

  /**
   * Get a specific comparison pair
   */
  async getJobPair(args: {
    jobId: string;
    pairId: string;
  }): Promise<GetJobPairResponse> {
    return this.get<GetJobPairResponse>(
      `/apps/${this.appSlug}/human-review/jobs/${args.jobId}/pairs/${args.pairId}`,
    );
  }
}
