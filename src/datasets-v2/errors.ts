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

/**
 * Parses an error response from the API and generates a structured error object
 */
export async function formatErrorResponse(
  response: Response,
  url: string,
  method: string,
): Promise<never> {
  let errorResponse: ApiErrorResponse | undefined;
  let responseText = '';

  try {
    // Try to get the text content of the response
    const clone = response.clone();
    responseText = await clone.text();

    // Try to parse as JSON if content type indicates JSON
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        errorResponse = JSON.parse(responseText) as ApiErrorResponse;
      } catch {
        // If JSON parsing fails, we'll use the text response
      }
    }
  } catch {
    // If we can't get the text for some reason, continue with empty text
  }

  // Create a developer-friendly error message with details
  const baseMessage = `API Error: ${response.status} ${response.statusText}`;
  let message = baseMessage;

  // Add validation error context if available
  if (errorResponse?.error?.issues?.length) {
    const issues = errorResponse.error.issues;
    const issuesByPath: Record<string, ValidationIssue[]> = {};

    // Group issues by path for better readability
    issues.forEach((issue) => {
      const path = issue.path?.length ? issue.path.join('.') : '(root)';
      if (!issuesByPath[path]) {
        issuesByPath[path] = [];
      }
      issuesByPath[path].push(issue);
    });

    message += `\n\nValidation errors (${issues.length} total):`;

    Object.entries(issuesByPath).forEach(([path, pathIssues]) => {
      message += `\n- Field: ${path}`;

      pathIssues.forEach((issue) => {
        message += `\n  • ${issue.message}`;

        if (
          issue.code === 'invalid_union_discriminator' &&
          issue.options?.length
        ) {
          message += `\n    Valid options: ${issue.options.join(', ')}`;
        }

        if (issue.code === 'invalid_type' && issue.expected && issue.received) {
          message += ` (received: ${issue.received}, expected: ${issue.expected})`;
        }
      });
    });
  } else if (errorResponse?.error?.message) {
    message += `\nDetails: ${errorResponse.error.message}`;
  } else if (responseText && responseText.length < 1000) {
    // Include raw response if we couldn't parse structured errors
    // But only if it's reasonably sized (< 1000 chars)
    try {
      // Try to format JSON for better readability
      const parsedJson = JSON.parse(responseText);
      message += `\n\nResponse: ${JSON.stringify(parsedJson, null, 2)}`;
    } catch {
      // If it's not valid JSON, just include the raw text
      message += `\n\nResponse: ${responseText}`;
    }
  } else if (responseText) {
    // For very large responses, include a truncated version
    message += `\n\nResponse: ${responseText.substring(0, 500)}... (truncated)`;
  }

  throw new ApiError({
    status: response.status,
    statusText: response.statusText,
    url,
    method,
    message,
    errorResponse,
  });
}
