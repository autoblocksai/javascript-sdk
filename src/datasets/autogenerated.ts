// These will be autogenerated later by the user via a CLI command provided by this package.
// DO NOT CHANGE THESE INTERFACES WITHOUT UPDATING THE CLI COMMAND.

// Map of dataset ID -> schema version
interface __Autogenerated__DatasetsTypes {}

export type __Autogenerated__DatasetId = keyof __Autogenerated__DatasetsTypes &
  string;
export type __Autogenerated__DataseSchemaVersion<
  T extends __Autogenerated__DatasetId,
> = keyof __Autogenerated__DatasetsTypes[T] & string;
export type __Autogenerated__DatasetSchemaVersionData<
  T extends __Autogenerated__DatasetId,
  U extends __Autogenerated__DataseSchemaVersion<T>,
> = __Autogenerated__DatasetsTypes[T][U];
