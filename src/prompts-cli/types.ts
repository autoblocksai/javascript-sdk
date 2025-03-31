export interface ParsedTemplate {
  id: string;
  content: string;
  // TODO: this should be done in the API and returned in the
  // response instead of making each SDK's CLI do it
  placeholders: string[];
}

export interface ParsedPrompt {
  id: string;
  majorVersions: {
    majorVersion: string;
    minorVersions: string[];
    templates: ParsedTemplate[];
    params?: Record<string, unknown>;
    tools: { name: string; placeholders: string[] }[];
  }[];
}
