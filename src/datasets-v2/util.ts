import { parseAutoblocksOverrides } from '../util';

/**
 * Gets the list of selected dataset external IDs from overrides.
 * Returns empty array if no datasets are selected or not in testing context.
 */
export const getSelectedDatasets = (): string[] => {
  const overrides = parseAutoblocksOverrides();
  return overrides.testSelectedDatasets || [];
};
