import { replaceOptionalPlaceholders } from '../../src/prompts/util';

const testCases = [
  {
    input: `{{ optional? }}`,
    expected: ``,
  },
  {
    input: `{{ optional1? }} {{ optional2? }}`,
    expected: ``,
  },
  {
    input: `hello {{ optional? }} world`,
    expected: `hello world`,
  },
  {
    input: `{{ optional? }} world`,
    expected: `world`,
  },
  {
    input: `hello {{ optional? }}`,
    expected: `hello`,
  },
  {
    input: `hello {{ optional? }}
world`,
    expected: `hello
world`,
  },
  {
    input: `hello
{{ optional? }} world`,
    expected: `hello
world`,
  },
  {
    input: `hello
{{ optional? }}`,
    expected: `hello`,
  },
  {
    input: `{{ optional? }}
world`,
    expected: `world`,
  },
  {
    input: `hello

{{ optional? }}`,
    expected: `hello`,
  },
  {
    input: `{{ optional? }}
    
world`,
    expected: `world`,
  },
  {
    input: `{{ optional? }}


world`,
    expected: `world`,
  },
  {
    input: `before
{{ optional? }}
after`,
    expected: `before
after`,
  },
  {
    input: `before

{{ optional? }}
after`,
    expected: `before

after`,
  },
  {
    input: `before
{{ optional? }}

after`,
    expected: `before

after`,
  },
  {
    input: `before

{{ optional? }}

after`,
    expected: `before

after`,
  },
  {
    input: `before


{{ optional? }}

after`,
    expected: `before



after`,
  },
  {
    input: `before


{{ optional? }}


after`,
    expected: `before



after`,
  },
];

describe('replaceOptionalPlaceholders', () => {
  testCases.forEach(({ input, expected }) => {
    it(`replaces optional placeholders in "${input}"`, () => {
      expect(replaceOptionalPlaceholders(input)).toEqual(expected);
    });
  });
});
