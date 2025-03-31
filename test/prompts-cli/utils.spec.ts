import {
  makeTypeScriptTypeFromValue,
  parseTemplate,
  sortBy,
} from '../../src/prompts-cli/util';

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
  });
});
