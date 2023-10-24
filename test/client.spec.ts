import axios from 'axios';
import { AutoblocksAPIClient } from '../src/index';

jest.mock('axios');

describe('Autoblocks Client', () => {
  describe('constructor', () => {
    it('creates a client with the correct parameters', () => {
      new AutoblocksAPIClient('mock-api-token');

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-api-token',
        },
      });
    });

    it.each([
      [{ minutes: 1 }, 60000],
      [{ seconds: 1 }, 1000],
      [{ milliseconds: 1 }, 1],
      [{ seconds: 1, milliseconds: 1 }, 1001],
      [{ minutes: 1, seconds: 1, milliseconds: 1 }, 61001],
    ])("sets the correct timeout for '%s'", (timeout, expected) => {
      new AutoblocksAPIClient('mock-api-token', { timeout });

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.autoblocks.ai',
        headers: {
          Authorization: 'Bearer mock-api-token',
        },
        timeout: expected,
      });
    });
  });
});
