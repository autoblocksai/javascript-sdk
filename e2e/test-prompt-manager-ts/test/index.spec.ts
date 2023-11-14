import { PromptTemplateManager } from '@autoblocks/client/prompts';

const promptManager = new PromptTemplateManager();

describe('PromptTemplateManager', () => {
  it('handles placeholders', () => {
    const builder = promptManager.makeBuilder('1');

    builder.build('placeholder-test', {
      placeholder: 'I am the placeholder value',
      camelCase: 'I am the camel case value',
      snake_case: 'I am the snake case value',
    });

    expect(builder.usage()).toEqual({
      id: '1',
      templates: [
        {
          id: 'placeholder-test',
          template: `It should work with placeholders that have no spaces:
{{placeholder}}

With spaces:
{{ placeholder }}

Camel case:
{{ camelCase }}

Snake case:
{{ snake_case }}`,
        },
      ],
    });

    builder.snapshots().forEach((snapshot) => {
      expect(snapshot).toMatchSnapshot();
    });
  });

  it('handles nested templates', () => {
    const builder = promptManager.makeBuilder('2');

    builder.build('nested/nested/nested', { value: 'I am the value' });

    expect(builder.usage()).toEqual({
      id: '2',
      templates: [
        {
          id: 'nested/nested/nested',
          template: 'I am {{ value }}!',
        },
      ],
    });

    builder.snapshots().forEach((snapshot) => {
      expect(snapshot).toMatchSnapshot();
    });
  });
});
