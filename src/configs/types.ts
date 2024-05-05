import { z } from 'zod';

export enum RemoteConfigPropertyTypesEnum {
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ENUM = 'enum',
}

const zName = z
  .string()
  .min(1, {
    message: 'Name is required',
  })
  .refine((name) => !name.includes(' '), {
    message: 'Property name cannot contain spaces',
  });

const zEnumProperty = z.object({
  name: zName,
  value: z.string().min(1, {
    message: 'Value is required',
  }),
  values: z.array(z.string().min(1)),
  type: z.literal(RemoteConfigPropertyTypesEnum.ENUM),
});

const zNumberProperty = z.object({
  name: zName,
  value: z.number({
    required_error: 'Value is required',
    // invalid type error is the error when the field is empty
    invalid_type_error: 'Value is required',
  }),
  type: z.literal(RemoteConfigPropertyTypesEnum.NUMBER),
});

const zBooleanProperty = z.object({
  name: zName,
  value: z.boolean(),
  type: z.literal(RemoteConfigPropertyTypesEnum.BOOLEAN),
});

export const zRemoteConfigProperty = z.discriminatedUnion('type', [
  zEnumProperty,
  zNumberProperty,
  zBooleanProperty,
]);

export type RemoteConfigProperty = z.infer<typeof zRemoteConfigProperty>;

export const zRemoteConfigResponseSchema = z.object({
  id: z.string(),
  version: z.string(),
  properties: z.array(zRemoteConfigProperty),
});

export type RemoteConfigResponse = z.infer<typeof zRemoteConfigResponseSchema>;

export const zRemoteConfigSchema = z.union([
  z.object({
    id: z.string(),
    version: z.union([
      z.object({
        major: z.number(),
        minor: z.number(),
      }),
      z.object({
        major: z.number(),
        latest: z.literal(true),
      }),
    ]),
  }),
  z.object({
    id: z.string(),
    dangerouslyUseUndeployed: z.union([
      z.object({
        latest: z.literal(true),
      }),
      z.object({
        revisionId: z.string(),
      }),
    ]),
  }),
]);

export type RemoteConfig = z.infer<typeof zRemoteConfigSchema>;
