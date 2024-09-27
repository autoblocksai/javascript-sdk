import { z } from 'zod';

export enum PropertyTypesEnum {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Select = 'Select',
  MultiSelect = 'Multi-Select',
  ValidJSON = 'Valid JSON',
}

const zCommonFields = z.object({
  id: z.string().cuid2(),
  name: z.string().min(1),
  required: z.boolean().default(false),
});

const zStringPropertySchema = zCommonFields.extend({
  type: z.literal(PropertyTypesEnum.String),
  defaultValue: z.string().optional(),
});

const zNumberPropertySchema = zCommonFields.extend({
  type: z.literal(PropertyTypesEnum.Number),
  defaultValue: z.number().optional(),
});

const zBooleanPropertySchema = zCommonFields.extend({
  type: z.literal(PropertyTypesEnum.Boolean),
  defaultValue: z.boolean().optional(),
  required: z.literal(true),
});

const zSelectPropertySchema = zCommonFields.extend({
  type: z.literal(PropertyTypesEnum.Select),
  options: z.array(z.string()).min(1),
  defaultValue: z.string().optional(),
});

const zMultiSelectPropertySchema = zCommonFields.extend({
  type: z.literal(PropertyTypesEnum.MultiSelect),
  options: z.array(z.string()).min(1),
  defaultValue: z.array(z.string()).optional(),
});

const zValidJSONPropertySchema = zCommonFields.extend({
  type: z.literal(PropertyTypesEnum.ValidJSON),
});

export const zPropertySchema = z.discriminatedUnion('type', [
  zStringPropertySchema,
  zNumberPropertySchema,
  zBooleanPropertySchema,
  zSelectPropertySchema,
  zMultiSelectPropertySchema,
  zValidJSONPropertySchema,
]);

export type StringPropertySchema = z.infer<typeof zStringPropertySchema>;
export type NumberPropertySchema = z.infer<typeof zNumberPropertySchema>;
export type BooleanPropertySchema = z.infer<typeof zBooleanPropertySchema>;
export type SelectPropertySchema = z.infer<typeof zSelectPropertySchema>;
export type MultiSelectPropertySchema = z.infer<
  typeof zMultiSelectPropertySchema
>;
export type ValidJSONPropertySchema = z.infer<typeof zValidJSONPropertySchema>;
export type PropertySchema = z.infer<typeof zPropertySchema>;

const propertyNamesAreUnique = (properties?: PropertySchema[]): boolean => {
  if (!properties) {
    return true;
  }
  return new Set(properties.map((p) => p.name)).size === properties.length;
};

const propertyIdsAreUnique = (properties?: PropertySchema[]): boolean => {
  if (!properties) {
    return true;
  }
  return new Set(properties.map((p) => p.id)).size === properties.length;
};

export const zDatasetSchema = z
  .array(zPropertySchema)
  .min(1)
  .refine((properties) => propertyNamesAreUnique(properties), {
    message: 'Property names must be unique.',
  })
  .refine((properties) => propertyIdsAreUnique(properties), {
    message: 'Property ids must be unique.',
  });

export type DatasetSchema = z.infer<typeof zDatasetSchema>;

export interface ParsedDataset {
  name: string;
  schemaVersions: {
    schema: DatasetSchema;
    version: number;
  }[];
}
