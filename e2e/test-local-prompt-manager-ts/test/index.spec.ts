import { AutoblocksLocalPromptManager } from '@autoblocks/client/prompts';

describe('AutoblocksPromptBuilder', () => {
  describe('prompt-a', () => {
    const manager = new AutoblocksLocalPromptManager({ id: 'prompt-a' });

    it('handles placeholders', () => {
      const rendered = manager.render({
        template: 'placeholder-test',
        params: {
          placeholder: 'I am the placeholder value',
          camelCase: 'I am the camel case value',
          snake_case: 'I am the snake case value',
          '123invalid-var-name':
            'I am not a valid JS variable name but that is ok',
        },
      });

      expect(rendered)
        .toEqual(`It should work with placeholders that have no spaces:
I am the placeholder value

With spaces:
I am the placeholder value

Camel case:
I am the camel case value

Snake case:
I am the snake case value

Invalid JS names:
I am not a valid JS variable name but that is ok`);
    });

    it('handles nested templates', () => {
      const rendered = manager.render({
        template: 'nested/nested/nested',
        params: { value: '3' },
      });
      expect(rendered).toEqual('I am 3!');
    });

    it('handles templates without placeholders', () => {
      const rendered = manager.render({
        template: 'no-placeholders',
        params: {},
      });
      expect(rendered).toEqual('I have no placeholders');
    });
  });

  describe('prompt-b', () => {
    const manager = new AutoblocksLocalPromptManager({ id: 'prompt-b' });

    it('renders templates', () => {
      const rendered = manager.render({
        template: 'template',
        params: {
          x: '1',
          y: '2',
          z: '3',
        },
      });
      expect(rendered).toEqual('1 2 3');
    });
  });
});
