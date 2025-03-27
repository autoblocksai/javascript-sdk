import { AUTOBLOCKS_HEADERS, V2_API_ENDPOINT } from '../../util';
import { ParsedPromptV2 } from './types';
import { parseAndSortPromptsV2 } from './parsers';

export async function getAllPromptsFromV2API(args: {
  apiKey: string;
}): Promise<ParsedPromptV2[]> {
  const resp = await fetch(`${V2_API_ENDPOINT}/prompts/types`, {
    method: 'GET',
    headers: {
      ...AUTOBLOCKS_HEADERS,
      Authorization: `Bearer ${args.apiKey}`,
    },
  });

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch from V2 API: ${resp.status} ${resp.statusText}`,
    );
  }

  const data = await resp.json();
  return parseAndSortPromptsV2(data);
}
