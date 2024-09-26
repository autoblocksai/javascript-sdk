import { autogenerationConfigs } from '../../src/datasets-cli';
import {
  type ParsedDataset,
  PropertyTypesEnum,
} from '../../src/datasets-cli/types';

describe('Datasets CLI', () => {
  describe('__Autogenerated__DatasetsTypes', () => {
    it('should autogenerate types', () => {
      const datasets: ParsedDataset[] = [
        {
          id: 'dataset-a',
          schemaVersions: [
            {
              version: 1,
              schema: [
                {
                  id: '1',
                  name: 'name',
                  type: PropertyTypesEnum.String,
                  required: true,
                },
                {
                  id: '2',
                  name: 'age',
                  type: PropertyTypesEnum.Number,
                  required: false,
                },
                {
                  id: '3',
                  name: 'transcript',
                  type: PropertyTypesEnum.ValidJSON,
                  required: true,
                },
                {
                  id: '4',
                  name: 'speciality',
                  type: PropertyTypesEnum.Select,
                  options: ['option1', 'option2', 'option3'],
                  required: true,
                },
              ],
            },
          ],
        },
        {
          id: 'dataset-b',
          schemaVersions: [
            {
              version: 1,
              schema: [
                {
                  id: '1',
                  name: 'isActive',
                  type: PropertyTypesEnum.Boolean,
                  required: true,
                },
              ],
            },
            {
              version: 2,
              schema: [
                {
                  id: '1',
                  name: 'isActive',
                  type: PropertyTypesEnum.Boolean,
                  required: true,
                },
                {
                  id: '2',
                  name: 'tags',
                  type: PropertyTypesEnum.MultiSelect,
                  required: false,
                  options: ['tag1', 'tag2', 'tag3'],
                },
              ],
            },
          ],
        },
        {
          id: 'dataset-c',
          schemaVersions: [],
        },
      ];

      const symbolName = '__Autogenerated__DatasetsTypes';
      const config = autogenerationConfigs.find(
        (config) => config.symbolName === symbolName,
      );

      const autogenerated = config?.generate({
        symbolName,
        datasets,
      });

      expect(autogenerated).toEqual(
        `interface __Autogenerated__DatasetsTypes {
  'dataset-a': {
    'latest': Record<string, unknown>;
    '1': {
      'name': string;
      'age'?: number;
      'transcript': Record<string, unknown>;
      'speciality': 'option1' | 'option2' | 'option3';
    };
  };
  'dataset-b': {
    'latest': Record<string, unknown>;
    '1': {
      'isActive': boolean;
    };
    '2': {
      'isActive': boolean;
      'tags'?: ('tag1' | 'tag2' | 'tag3')[];
    };
  };
  'dataset-c': {
    'latest': Record<string, unknown>;
  };
}`,
      );
    });
  });
});
