import { getAllPromptsFromV2API } from '../../../src/prompts-cli/v2/api';
import { V2_API_ENDPOINT } from '../../../src/util';

describe('API', () => {
  describe('getAllPromptsFromV2API', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch prompts successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve([
            {
              id: 'prompt-a',
              appId: 'app-1',
              appName: 'test-app',
              majorVersions: [],
            },
          ]),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await getAllPromptsFromV2API({ apiKey: 'test-key' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${V2_API_ENDPOINT}/prompts/types`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
            'X-Autoblocks-SDK': 'javascript-0.0.0-automated',
          },
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('prompt-a');
    });

    it('should throw error when API request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(
        getAllPromptsFromV2API({ apiKey: 'invalid-key' }),
      ).rejects.toThrow('Failed to fetch from V2 API: 401 Unauthorized');
    });
  });
});
