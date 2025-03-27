import { normalizeAppName } from '../../src/prompts-cli/prompts-cli-v2';

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
