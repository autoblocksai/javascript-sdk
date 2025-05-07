/**
 * Schema property types enum
 */
export enum SchemaPropertyTypesEnum {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Select = 'Select',
  MultiSelect = 'Multi-Select',
  ValidJSON = 'Valid JSON',
  ListOfStrings = 'List of Strings',
  Conversation = 'Conversation',
}

/**
 * Base property interface
 */
export interface BaseSchemaProperty {
  id?: string;
  name: string;
  required: boolean;
}

/**
 * String property
 */
export interface StringProperty extends BaseSchemaProperty {
  type: SchemaPropertyTypesEnum.String;
}

/**
 * Number property
 */
export interface NumberProperty extends BaseSchemaProperty {
  type: SchemaPropertyTypesEnum.Number;
}

/**
 * Boolean property
 */
export interface BooleanProperty extends BaseSchemaProperty {
  type: SchemaPropertyTypesEnum.Boolean;
}

/**
 * List of strings property
 */
export interface ListOfStringsProperty extends BaseSchemaProperty {
  type: SchemaPropertyTypesEnum.ListOfStrings;
}

/**
 * Select property
 */
export interface SelectProperty extends BaseSchemaProperty {
  type: SchemaPropertyTypesEnum.Select;
  options: string[];
}

/**
 * Multi-select property
 */
export interface MultiSelectProperty extends BaseSchemaProperty {
  type: SchemaPropertyTypesEnum.MultiSelect;
  options: string[];
}

/**
 * Valid JSON property
 */
export interface ValidJSONProperty extends BaseSchemaProperty {
  type: SchemaPropertyTypesEnum.ValidJSON;
}

/**
 * Conversation property
 */
export interface ConversationProperty extends BaseSchemaProperty {
  type: SchemaPropertyTypesEnum.Conversation;
  roles?: string[];
}

/**
 * Schema property union type
 */
export type SchemaProperty =
  | StringProperty
  | NumberProperty
  | BooleanProperty
  | ListOfStringsProperty
  | SelectProperty
  | MultiSelectProperty
  | ValidJSONProperty
  | ConversationProperty;
