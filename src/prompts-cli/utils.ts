import { ParsedTemplate, SymbolType } from './types';

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
  const placeholders = args.content.match(/\{\{\s*[\w-]+\s*\}\}/g);
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

export function makeCommentsFor(name: string): {
  startComment: string;
  endComment: string;
} {
  return {
    startComment: `// ${name} start`,
    endComment: `// ${name} end`,
  };
}

export function determineStartAndEndIdx(args: {
  symbolName: string;
  symbolType: SymbolType;
  startComment: string;
  endComment: string;
  content: string;
}): {
  startIdx: number;
  endIdx: number;
} {
  const startCommentIdx = args.content.indexOf(args.startComment);
  const endCommentIdx = args.content.indexOf(args.endComment);
  if (startCommentIdx !== -1 && endCommentIdx !== -1) {
    return {
      startIdx: startCommentIdx,
      endIdx: endCommentIdx + args.endComment.length,
    };
  }

  const symbolAppearanceBeforeAutogeneration =
    args.symbolType === 'interface'
      ? `interface ${args.symbolName} {\n}`
      : `var ${args.symbolName} = {};`;
  const firstTimeAppearance = args.content.indexOf(
    symbolAppearanceBeforeAutogeneration,
  );
  if (firstTimeAppearance !== -1) {
    return {
      startIdx: firstTimeAppearance,
      endIdx: firstTimeAppearance + symbolAppearanceBeforeAutogeneration.length,
    };
  }

  const interfaceDeclaration = args.content.indexOf(
    `interface ${args.symbolName}`,
  );
  if (interfaceDeclaration !== -1) {
    let currentPos = interfaceDeclaration;
    let braceCount = 0;
    let foundEnd = false;

    while (currentPos < args.content.length) {
      const char = args.content[currentPos];
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          foundEnd = true;
          break;
        }
      }
      currentPos++;
    }

    if (foundEnd) {
      return {
        startIdx: interfaceDeclaration,
        endIdx: currentPos + 1,
      };
    }
  }

  throw new Error(
    `Couldn't find ${symbolAppearanceBeforeAutogeneration} or interface ${args.symbolName} in ${args.content}`,
  );
}

export function normalizeAppName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ') // Replace special chars with space, but keep apostrophes
    .replace(/\s+/g, '-') // Replace multiple spaces with hyphen
    .replace(/'/g, '') // Remove apostrophes
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}
