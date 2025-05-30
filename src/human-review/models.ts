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
