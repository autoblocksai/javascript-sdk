import { ParsedTemplate } from './types';

export function makeTypeScriptTypeFromValue(val: unknown): string | undefined {
  if (typeof val === 'string') {
    return 'string';
  } else if (typeof val === 'number') {
    return 'number';
  } else if (typeof val === 'boolean') {
    return 'boolean';
  } else if (Array.isArray(val)) {
    if (val.length === 0) {
      return 'Array<never>';
    }
    const item = val[0];
    return `Array<${makeTypeScriptTypeFromValue(item)}>`;
  } else if (typeof val === 'object' && val !== null) {
    let result = '{';
    for (const [key, value] of Object.entries(val)) {
      const type = makeTypeScriptTypeFromValue(value);
      if (type) {
        result += `\n          '${key}': ${type};`;
      }
    }
    result += '\n        }';
    return result;
  }

  return undefined;
}

export function sortBy<T, V extends string | number>(
  array: T[],
  getVal: (item: T) => V,
): T[] {
  return [...array].sort((a, b) => (getVal(a) < getVal(b) ? -1 : 1));
}

export function parseTemplate(args: {
  id: string;
  content: string;
}): ParsedTemplate {
  // Find all placeholder names in the template. They look like: {{ placeholder }}
  // They can have arbitrary whitespace between the leading {{ and trailing }},
  // so e.g. {{placeholder}} is also valid.
  const placeholders = args.content.match(/\{\{\s*[\w-]+\s*\}\}/g);

  // Get the placeholder names, e.g. `placeholder` from `{{ placeholder }}`
  // by removing the `{{` and `}}` on each side and trimming off the whitespace.
  const placeholderNames = (placeholders ?? []).map((placeholder) => {
    return placeholder.slice(2, -2).trim();
  });
  const uniquePlaceholderNames = Array.from(new Set(placeholderNames)).sort();

  return {
    id: args.id,
    content: args.content,
    placeholders: uniquePlaceholderNames,
  };
}
