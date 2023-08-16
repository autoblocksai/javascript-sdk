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
  });
});
