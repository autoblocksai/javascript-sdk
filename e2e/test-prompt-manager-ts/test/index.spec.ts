import { AutoblocksPromptBuilder } from '@autoblocks/client/prompts';

describe('AutoblocksPromptBuilder', () => {
  it('handles placeholders', () => {
    const builder = new AutoblocksPromptBuilder('1');

    builder.build('placeholder-test', {
      placeholder: 'I am the placeholder value',
      camelCase: 'I am the camel case value',
      snake_case: 'I am the snake case value',
      '123invalid-var-name': 'I am not a valid JS variable name but that is ok',
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
{{ snake_case }}

Invalid JS names:
{{ 123invalid-var-name }}`,
        },
      ],
    });

    builder.snapshots().forEach((snapshot) => {
      expect(snapshot).toMatchSnapshot();
    });
  });

  it('handles nested templates', () => {
    const builder = new AutoblocksPromptBuilder('2');

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

  it('handles templates without placeholders', () => {
    const builder = new AutoblocksPromptBuilder('3');

    const value = builder.build('no-placeholders');

    expect(value).toEqual("I don't have any placeholders");
  });
});
