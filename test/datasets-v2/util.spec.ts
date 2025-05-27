import { AutoblocksEnvVar } from '../../src/util';
import { getSelectedDatasets } from '../../src/datasets-v2/util';

describe('Datasets V2 Utilities', () => {
  beforeEach(() => {
    // Clean up environment variables
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS];
    delete process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES];
  });

  describe('getSelectedDatasets', () => {
    it('returns empty array when no overrides are set', () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';

      const result = getSelectedDatasets();
      expect(result).toEqual([]);
    });

    it('returns empty array when testSelectedDatasets is not set in overrides', () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';

      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES] = JSON.stringify({
        testRunMessage: 'Some message',
      });

      const result = getSelectedDatasets();
      expect(result).toEqual([]);
    });

    it('returns selected datasets when set in overrides', () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';

      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES] = JSON.stringify({
        testSelectedDatasets: ['dataset-1', 'dataset-2', 'dataset-3'],
      });

      const result = getSelectedDatasets();
      expect(result).toEqual(['dataset-1', 'dataset-2', 'dataset-3']);
    });

    it('returns empty array when testSelectedDatasets is empty', () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';

      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES] = JSON.stringify({
        testSelectedDatasets: [],
      });

      const result = getSelectedDatasets();
      expect(result).toEqual([]);
    });

    it('handles invalid JSON gracefully', () => {
      process.env[AutoblocksEnvVar.AUTOBLOCKS_CLI_SERVER_ADDRESS] =
        'http://localhost:3000';

      process.env[AutoblocksEnvVar.AUTOBLOCKS_OVERRIDES] = 'invalid json';

      // Should not throw and return empty array
      const result = getSelectedDatasets();
      expect(result).toEqual([]);
    });
  });
});
