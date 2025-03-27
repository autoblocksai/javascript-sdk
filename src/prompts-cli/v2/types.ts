export interface ParsedTemplate {
  id: string;
  content: string;
  placeholders: string[];
}

export interface ParsedPromptV2 {
  id: string;
  appId: string;
  appName: string;
  majorVersions: {
    majorVersion: string;
    minorVersions: string[];
    templates: ParsedTemplate[];
    params?: Record<string, unknown>;
    tools: { name: string; placeholders: string[] }[];
  }[];
}

export type SymbolType = 'interface' | 'variable';

export interface AutogenerationConfigV2 {
  symbolName: string;
  symbolType: SymbolType;
  filesToModify: string[];
  generate: (args: { symbolName: string; prompts: ParsedPromptV2[] }) => string;
}

export interface PromptTypeFromAPI {
  id: string;
  appId: string;
  appName: string;
  majorVersions: {
    majorVersion: string;
    minorVersions: string[];
    templates: {
      id: string;
      template: string;
    }[];
    params?: { params: Record<string, unknown> };
    toolsParams: { name: string; params: string[] }[];
  }[];
}
