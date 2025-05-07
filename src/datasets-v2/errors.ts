/**
 * API error handling utilities
 */

/**
 * API validation issue structure
 */
export interface ValidationIssue {
  code: string;
  message: string;
  path?: string[];
  expected?: string;
  received?: string;
  options?: string[];
}

/**
 * API error structure
 */
export interface ApiErrorResponse {
  success: boolean;
  error?: {
    message?: string;
    issues?: ValidationIssue[];
    name?: string;
  };
}

/**
 * Custom error class for API errors
 *
 * @example
 * ```typescript
 * try {
 *   await client.create({ name: "My Dataset", schema: [...] });
 * } catch (error) {
 *   if (error instanceof ApiError) {
 *     // Log the detailed error message with formatted validation issues
 *     console.error(error.message);
 *
 *     // You can also programmatically access validation issues
 *     if (error.validationIssues.length > 0) {
 *       // Take action based on specific validation errors
 *       const hasSchemaIssues = error.validationIssues.some(issue =>
 *         issue.path.startsWith('schema'));
 *
 *       if (hasSchemaIssues) {
 *         // Handle schema-specific validation issues
 *       }
 *     }
 *
 *     // Access other error details
 *     console.error(`Status: ${error.status}`);
 *     console.error(`URL: ${error.url}`);
 *   }
 * }
 * ```
 */
export class ApiError extends Error {
  status: number;
  statusText: string;
  url: string;
  method: string;
  rawResponse?: ApiErrorResponse;
  validationIssues: {
    path: string;
    message: string;
    code: string;
    options?: string[];
  }[] = [];

  constructor({
    status,
    statusText,
    url,
    method,
    message,
    errorResponse,
  }: {
    status: number;
    statusText: string;
    url: string;
    method: string;
    message: string;
    errorResponse?: ApiErrorResponse;
  }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.method = method;
    this.rawResponse = errorResponse;

    // Extract validation issues if present
    if (errorResponse?.error?.issues?.length) {
      this.validationIssues = errorResponse.error.issues.map((issue) => ({
        path: issue.path?.join('.') || '(root)',
        message: issue.message,
        code: issue.code,
        options: issue.options,
      }));
    }
  }
}
