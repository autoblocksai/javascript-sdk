// Job list response
export interface HumanReviewJobListResponse {
  jobs: HumanReviewJobSummary[];
}

export interface HumanReviewJobSummary {
  id: string;
  name: string;
  reviewer: HumanReviewUser;
}

export interface HumanReviewUser {
  email: string;
}

// Job detail response
export interface HumanReviewJobDetail {
  id: string;
  name: string;
  reviewer: HumanReviewUser;
  scores: HumanReviewScore[];
  items: HumanReviewJobItemSummary[];
}

export interface HumanReviewScore {
  id: string;
  name: string;
  description: string;
  options: HumanReviewScoreOptions;
}

export type HumanReviewScoreOptions =
  | { type: 'binary' }
  | {
      type: 'discreteRange';
      min: number;
      max: number;
      description?: Record<string, string>;
    }
  | { type: 'tag' };

export interface HumanReviewJobItemSummary {
  id: string;
  executionId?: string;
  executionTimestamp?: string;
}

// Job item detail response
export interface HumanReviewJobItemDetail {
  id: string;
  grades: HumanReviewGrade[];
  inputFields: HumanReviewField[];
  outputFields: HumanReviewField[];
  fieldComments: HumanReviewFieldComment[];
  inputComments: HumanReviewGeneralComment[];
  outputComments: HumanReviewGeneralComment[];
  executionId?: string;
  executionTimestamp?: string;
}

export interface HumanReviewGrade {
  scoreId: string;
  grade: number;
  user: HumanReviewUser;
}

export interface HumanReviewField {
  id: string;
  name: string;
  value: string;
  contentType: 'TEXT' | 'MARKDOWN' | 'HTML' | 'LINK';
}

export interface HumanReviewFieldComment {
  fieldId: string;
  value: string;
  startIdx?: number;
  endIdx?: number;
  inRelationToScoreName?: string;
  user: HumanReviewUser;
}

export interface HumanReviewGeneralComment {
  value: string;
  inRelationToScoreName?: string;
  user: HumanReviewUser;
}

// Job test cases response
export interface GetJobTestCasesResponse {
  testCases: {
    id: string;
    input: Record<string, string>;
    output: Record<string, string>;
  }[];
}

// Job test case result response
export interface TestCaseResult {
  id: string;
  result: Record<string, unknown>;
}

export type GetJobTestCaseResultResponse = TestCaseResult;

// Job pairs response
export interface OutputField {
  name: string;
  value: string;
  idx?: number;
  contentType?: string;
}

export interface PairItem {
  itemId: string;
  outputFields: OutputField[];
}

// Job pair response
export interface Pair {
  id: string;
  items: PairItem[]; // always 2
}

export interface PairDetail extends Pair {
  chosenItemId?: string | null;
}

export interface GetJobPairsResponse {
  pairs: Pair[];
}

export type GetJobPairResponse = PairDetail;
