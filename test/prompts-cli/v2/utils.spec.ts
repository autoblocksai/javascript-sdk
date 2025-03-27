import {
  makeTypeScriptTypeFromValue,
  sortBy,
  parseTemplate,
  makeCommentsFor,
  determineStartAndEndIdx,
  normalizeAppName,
} from '../../../src/prompts-cli/v2/utils';

describe('Utils', () => {
  describe('makeTypeScriptTypeFromValue', () => {
    it('should handle primitive types', () => {
      expect(makeTypeScriptTypeFromValue('string')).toBe('string');
      expect(makeTypeScriptTypeFromValue(123)).toBe('number');
      expect(makeTypeScriptTypeFromValue(true)).toBe('boolean');
    });

    it('should handle arrays', () => {
      expect(makeTypeScriptTypeFromValue([])).toBe('Array<never>');
      expect(makeTypeScriptTypeFromValue(['a', 'b'])).toBe('Array<string>');
      expect(makeTypeScriptTypeFromValue([1, 2])).toBe('Array<number>');
    });

    it('should handle objects', () => {
      const obj = {
        name: 'test',
        age: 25,
        isActive: true,
      };
      const expected = `{
          'name': string;
          'age': number;
          'isActive': boolean;
        }`;
      expect(makeTypeScriptTypeFromValue(obj)).toBe(expected);
    });
  });

  describe('sortBy', () => {
    it('should sort array by string values', () => {
      const arr = [{ id: 'c' }, { id: 'a' }, { id: 'b' }];
      const sorted = sortBy(arr, (item) => item.id);
      expect(sorted.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    });

    it('should sort array by number values', () => {
      const arr = [{ age: 30 }, { age: 20 }, { age: 25 }];
      const sorted = sortBy(arr, (item) => item.age);
      expect(sorted.map((item) => item.age)).toEqual([20, 25, 30]);
    });
  });

  describe('parseTemplate', () => {
    it('should extract placeholders from template', () => {
      const result = parseTemplate({
        id: 'test',
        content: 'Hello {{name}}! The weather is {{weather}} today.',
      });
      expect(result.placeholders).toEqual(['name', 'weather']);
    });

    it('should handle templates with no placeholders', () => {
      const result = parseTemplate({
        id: 'test',
        content: 'Hello! No placeholders here.',
      });
      expect(result.placeholders).toEqual([]);
    });

    it('should handle complex placeholders', () => {
      const result = parseTemplate({
        id: 'test',
        content: '{{name?}} {{age}} {{address?}}',
      });

      expect(result.placeholders).toEqual(['address?', 'age', 'name?']);
    });
  });

  describe('makeCommentsFor', () => {
    it('should generate start and end comments', () => {
      const result = makeCommentsFor('test');
      expect(result).toEqual({
        startComment: '// test start',
        endComment: '// test end',
      });
    });
  });

  describe('determineStartAndEndIdx', () => {
    it('should find indices between comments', () => {
      const content = `// test start
some content
// test end`;
      const result = determineStartAndEndIdx({
        symbolName: 'test',
        symbolType: 'interface',
        startComment: '// test start',
        endComment: '// test end',
        content,
      });
      expect(result.startIdx).toBe(0);
      expect(result.endIdx).toBe(content.length);
    });

    it('should find interface declaration', () => {
      const content = `interface test {
  some content
}`;
      const result = determineStartAndEndIdx({
        symbolName: 'test',
        symbolType: 'interface',
        startComment: '// test start',
        endComment: '// test end',
        content,
      });
      expect(result.startIdx).toBe(0);
      expect(result.endIdx).toBe(content.length);
    });

    it('should throw error when no match found', () => {
      expect(() =>
        determineStartAndEndIdx({
          symbolName: 'test',
          symbolType: 'interface',
          startComment: '// test start',
          endComment: '// test end',
          content: 'some content',
        }),
      ).toThrow();
    });
  });

  describe('normalizeAppName', () => {
    it('should convert to lowercase', () => {
      expect(normalizeAppName('HelloWorld')).toBe('helloworld');
    });

    it('should replace special characters with hyphens', () => {
      expect(normalizeAppName('hello@world')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(normalizeAppName('hello   world')).toBe('hello-world');
    });

    it('should remove apostrophes', () => {
      expect(normalizeAppName("don't")).toBe('dont');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(normalizeAppName('-hello-world-')).toBe('hello-world');
    });

    it('should handle complex cases', () => {
      expect(normalizeAppName("Don't @#$% Worry! Be Happy!")).toBe(
        'dont-worry-be-happy',
      );
    });

    it('should handle empty string', () => {
      expect(normalizeAppName('')).toBe('');
    });

    it('should handle string with only special characters', () => {
      expect(normalizeAppName('@#$%')).toBe('');
    });
  });
});
