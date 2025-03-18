# AutoblocksPromptManagerV2 Tests

This directory contains tests for the `AutoblocksPromptManagerV2` class, which is used to interact with Autoblocks V2 API for managing prompts.

## Key Differences from V1 Manager Tests

1. **API Version**: These tests are for the V2 API, which uses a different endpoint and authentication mechanism.

2. **Authentication**: V2 only supports owner-type tokens, so all tests use a single API key.

3. **App ID**: V2 requires an `appId` parameter in the constructor, which is used to identify the application that owns the prompts.

4. **Class Name**: Uses `AutoblocksPromptManagerV2` instead of `AutoblocksPromptManager`.

5. **Type Signature**: The class has a different type signature with a new `AppId` generic parameter.

## Running the Tests

```bash
cd e2e/test-prompt-manager-v2-ts
npm test
```

Before running the tests, make sure to set the `AUTOBLOCKS_V2_API_KEY` environment variable with a valid API key for the V2 API.

## Handling Network Connections

The tests make network requests to the Autoblocks API, which can sometimes result in Jest detecting open handles that prevent it from exiting cleanly. To address this, we:

1. Register all manager instances in a collection
2. Close all managers after all tests complete
3. Add a small delay to allow network connections to fully close

If you're still seeing issues with open handles, you can run Jest with the `--forceExit` flag:

```bash
npm test -- --forceExit
```

## Required Prompts in Autoblocks UI

To run these tests successfully, you'll need to create the following in the Autoblocks UI:

### App

Create a single app with ID `jqg74mpzzovssq38j055yien`.

### Prompts

1. **prompt-basic**

   - Major version 1 with minor 0
   - Major version 2 with minor 1
   - Templates:
     - `template-a` (v1.0): `Hello, {{name}}! The weather is {{weather}} today.`
     - `template-b` (v1.0): `Hello, {{ optional? }}! My name is {{ name }}.`
     - `template-c` (v2.1): `Hello, {{ first_name }}!`
   - Parameters for v1.0:
     ```json
     {
       "frequencyPenalty": 0,
       "maxTokens": 256,
       "model": "gpt-4o",
       "presencePenalty": 0,
       "stopSequences": [],
       "temperature": 0.7,
       "topP": 1
     }
     ```
   - Parameters for v2.1:
     ```json
     {
       "model": "gpt-4o",
       "seed": -7324655555050587,
       "topK": 0
     }
     ```
   - Create a revision with ID `cm6grg7lk0003rc2qzr9okfcd` with these parameters:
     ```json
     {
       "model": "gpt-4o",
       "seed": -7324655555050587,
       "topK": 0
     }
     ```

2. **prompt-brackets**

   - Major version 1 with minors 1 and 2
   - Templates:

     - `brackets-nested` (v1.1):

       ```
       Hello! Please respond in the following format:

       {{
         "x": {{
           "y": 1
         }}
       }}
       ```

     - `brackets-inline` (v1.2):

       ```
       Hello! Please respond in the following format:

       {{"x": {{"y": 1}}}}
       ```

3. **prompt-tools**
   - Major version 1 with minor 0
   - Templates:
     - `system`: `System Template`
   - Tools:
     - `MyTool`:
       - Description: `This is the description`
       - Parameters:
         - `myParam`: (string) with description `{{ description }}`

## Test Coverage

The tests cover all the major functionality of the V2 prompt manager:

- Rendering templates with parameters
- Handling async execution
- Accessing prompt parameters
- Tracking prompt usage
- Using weighted prompt selection
- Working with undeployed prompts
- Rendering tools
- Handling special characters in templates
