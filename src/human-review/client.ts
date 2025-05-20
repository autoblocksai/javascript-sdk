import { BaseAppResourceClient } from '../api/base-app-resource-client';
import {
  HumanReviewJobListResponse,
  HumanReviewJobDetail,
  HumanReviewJobItemDetail,
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
  async getJobItem(
    jobId: string,
    itemId: string,
  ): Promise<HumanReviewJobItemDetail> {
    return this.get<HumanReviewJobItemDetail>(
      `/apps/${this.appSlug}/human-review/jobs/${jobId}/items/${itemId}`,
    );
  }
}
