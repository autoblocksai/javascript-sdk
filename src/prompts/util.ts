export function renderTemplate(args: {
  template: string;
  params: Record<string, unknown>;
}): string {
  let rendered = args.template;

  Object.entries(args.params).forEach(([key, value]) => {
    const re = new RegExp(`\\{\\{\\s*${key}[?]?\\s*\\}\\}`, 'g');
    rendered = rendered.replace(re, `${value}`);
  });

  // Replace any remaining optional placeholders
  rendered = replaceOptionalPlaceholders(rendered);

  // Trim whitespace
  return rendered.trim();
}

/**
 * Replace any optional placeholders remaining in the template. We try
 * to replace with an amount of whitespace that "makes sense" given what
 * is surrounding the placeholder.
 */
export function replaceOptionalPlaceholders(template: string): string {
  const regex = /(\s*){{\s*\S+\?\s*}}(\s*)/g;

  return template.replace(
    regex,
    (
      _: string | undefined,
      spaceBefore: string | undefined,
      spaceAfter: string | undefined,
    ) => {
      if (spaceBefore === ' ' && spaceAfter === ' ') {
        // inlined
        return ' ';
      } else if (spaceBefore === ' ' && spaceAfter === '\n') {
        // inlined at end of line
        return '\n';
      } else if (spaceBefore === '\n' && spaceAfter === ' ') {
        // inlined at beginning of line
        return '\n';
      } else if (
        spaceBefore &&
        spaceBefore.split('').every((c) => c === '\n') &&
        spaceAfter &&
        spaceAfter.split('').every((c) => c === '\n')
      ) {
        const nBefore = spaceBefore.length;
        const nAfter = spaceAfter.length;

        if (nBefore === 1 && nAfter === 1) {
          // on its own line but surrounded by text above and below
          return '\n';
        } else if (nBefore !== nAfter) {
          // surrounded by newlines above and below but not by the same amount,
          // so we assume the difference in spacing is intentional and keep it
          return '\n'.repeat(Math.max(nBefore + nAfter, 1) - 1);
        } else {
          // surrounded by an even amount of newlines above and below, so we
          // collapse away the placeholder completely
          return '\n'.repeat(Math.max(nBefore + nAfter, 2) - 2);
        }
      }
      return '';
    },
  );
}
