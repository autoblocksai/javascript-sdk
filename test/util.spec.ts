import { dedent, determineStartAndEndIdx, makeCommentsFor } from '../src/util';

describe('Util', () => {
  describe('dedent', () => {
    it('removes leading whitespace', () => {
      const output = dedent(`test
      Hello
      How are you?`);
      expect(output).toEqual('test\nHello\nHow are you?');
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
});
