import { dedent } from '../src/util';

describe('Util', () => {
  describe('dedent', () => {
    it('removes leading whitespace', () => {
      const output = dedent(`test
      Hello
      How are you?`);
      expect(output).toEqual('test\nHello\nHow are you?');
    });
  });
});
