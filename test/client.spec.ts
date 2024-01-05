import axios from 'axios';
import { AutoblocksAPIClient } from '../src/index';
import { AutoblocksEnvVar } from '../src/util';

jest.mock('axios');

describe('Autoblocks Client', () => {
  describe('constructor', () => {
    it('accepts api key as first arg (deprecated constructor)', () => {
      new AutoblocksAPIClient('mock-api-key');

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-api-key',
        },
        timeout: 10000,
      });
    });

    it('accepts api key in args', () => {
      new AutoblocksAPIClient({ apiKey: 'mock-api-key' });

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-api-key',
        },
        timeout: 10000,
      });
    });

    it('accepts api key as environment variable', () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY] = 'mock-api-key';

      new AutoblocksAPIClient();

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-api-key',
        },
        timeout: 10000,
      });

      delete process.env[AutoblocksEnvVar.AUTOBLOCKS_API_KEY];
    });

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])(
      "sets the correct timeout for '%s' (deprecated constructor)",
      (timeout, expected) => {
        new AutoblocksAPIClient('mock-api-token', { timeout });

        expect(axios.create).toHaveBeenCalledWith({
          baseURL: 'https://api.autoblocks.ai',
          headers: {
            Authorization: 'Bearer mock-api-token',
          },
          timeout: expected,
        });
      },
    );

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])("sets the correct timeout for '%s'", (timeout, expected) => {
      new AutoblocksAPIClient({ apiKey: 'mock-api-key', timeout });

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-api-key',
        },
        timeout: expected,
      });
    });
  });
});
