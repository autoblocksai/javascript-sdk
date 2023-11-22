import { AutoblocksPromptBuilder } from '@autoblocks/client/prompts';

describe('AutoblocksPromptBuilder', () => {
  let builder: AutoblocksPromptBuilder;

  beforeEach(() => {
    builder = new AutoblocksPromptBuilder('test');
  });

  afterEach(() => {
    builder.snapshots().forEach((snapshot) => {
      expect(snapshot).toMatchSnapshot();
    });
  });

  it('handles placeholders', () => {
    builder.build('placeholder-test', {
      placeholder: 'I am the placeholder value',
      camelCase: 'I am the camel case value',
      snake_case: 'I am the snake case value',
      '123invalid-var-name': 'I am not a valid JS variable name but that is ok',
    });

    expect(builder.usage()).toEqual({
      id: 'test',
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
  });

  it('handles nested templates', () => {
    builder.build('nested/nested/nested', { value: 'I am the value' });

    expect(builder.usage()).toEqual({
      id: 'test',
      templates: [
        {
          id: 'nested/nested/nested',
          template: 'I am {{ value }}!',
        },
      ],
    });
  });

  it('handles templates without placeholders', () => {
    builder.build('no-placeholders', {});
  });

  it('collapses optional placeholders at start', () => {
    builder.build('optionals/start', {});
  });

  it('replaces optional placeholders at start', () => {
    builder.build('optionals/start', { optional: 'hello' });
  });

  it('collapses optional placeholders at end', () => {
    builder.build('optionals/end', {});
  });

  it('replaces optional placeholders at end', () => {
    builder.build('optionals/end', { optional: 'hello' });
  });

  it('collapses optional placeholders in the middle', () => {
    builder.build('optionals/middle', {});
  });

  it('replaces optional placeholders in the middle', () => {
    builder.build('optionals/middle', { optional: 'hello' });
  });

  it('collapses optional placeholders in the middle surrounded by other text', () => {
    builder.build('optionals/surrounded', {});
  });

  it('replaces optional placeholders in the middle surrounded by other text', () => {
    builder.build('optionals/surrounded', { optional: 'hello' });
  });

  it('replaces inline optional placeholders', () => {
    builder.build('optionals/inline', {});
  });

  it('replaces inline optional placeholders with a value', () => {
    builder.build('optionals/inline', { optional: 'hello' });
  });

  it('handles optional placeholder names that are not valid JS values', () => {
    builder.build('optionals/hyphens', {
      'optional-param-with-hyphens': 'hello',
    });
  });
});
