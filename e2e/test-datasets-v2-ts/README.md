# DatasetsV2Client E2E Tests

This directory contains end-to-end tests for the `DatasetsV2Client` class, which provides operations for managing datasets in the Autoblocks V2 API.

## Running the Tests

```bash
cd e2e/test-datasets-v2-ts
npm test
```

The tests require the `AUTOBLOCKS_API_KEY` environment variable to be set with a valid API key for the V2 API.

## Test Structure

The tests are organized into several files, each focused on a specific aspect of the client's functionality:

- **test/setup.ts**: Shared utilities, constants, and helper functions
- **test/basic.spec.ts**: Basic CRUD operations for datasets
- **test/items.spec.ts**: Dataset items operations (add, retrieve, update, delete)
- **test/schema.spec.ts**: Schema operations and schema evolution
- **test/advanced-types.spec.ts**: Tests for advanced schema types
- **test/conversation.spec.ts**: Tests for the conversation schema type
- **test/error-handling.spec.ts**: Tests for error handling scenarios

## API Coverage

The test suite covers all methods in the DatasetsV2Client:

- `list()`: List all datasets
- `create()`: Create a new dataset
- `destroy()`: Delete a dataset
- `getItems()`: Get all items for a dataset
- `createItems()`: Add items to a dataset
- `getSchemaByVersion()`: Get schema for a specific version
- `getItemsByRevision()`: Get items by revision ID
- `getItemsBySchemaVersion()`: Get items by schema version
- `updateItem()`: Update a dataset item
- `deleteItem()`: Delete a dataset item

## Schema Types Tested

The tests cover all schema property types supported by the API:

- String
- Number
- Boolean
- Select
- MultiSelect
- ListOfStrings
- ValidJSON
- Conversation

## Best Practices

- Each test creates its own dataset(s) with appropriate schema definitions
- All test datasets are cleaned up after tests complete
- Schema evolution is tested to ensure backward compatibility
- All client methods are tested with both valid and invalid inputs
