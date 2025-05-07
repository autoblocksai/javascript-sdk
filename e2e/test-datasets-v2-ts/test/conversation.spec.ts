import { createTestClient, createUniqueName, cleanupDataset } from './setup';
import {
  SchemaPropertyTypesEnum,
  type SchemaProperty,
} from '@autoblocks/client';

describe('Conversation Schema Type', () => {
  const client = createTestClient();
  let conversationDatasetId: string;

  const conversationSchema: SchemaProperty[] = [
    {
      name: 'title',
      type: SchemaPropertyTypesEnum.String,
      required: true,
    },
    {
      name: 'conversation',
      type: SchemaPropertyTypesEnum.Conversation,
      roles: ['user', 'assistant'],
      required: true,
    },
  ];

  beforeAll(async () => {
    const dataset = await client.create({
      name: createUniqueName('Conversation Dataset'),
      schema: conversationSchema,
    });

    conversationDatasetId = dataset.externalId;
  });

  afterAll(async () => {
    await cleanupDataset(client, conversationDatasetId);
  });

  it('should create and retrieve items with conversation data', async () => {
    const conversationData = {
      roles: ['user', 'assistant'],
      turns: [
        {
          turn: 1,
          messages: [{ role: 'user', content: 'Hello, how are you?' }],
        },
        {
          turn: 2,
          messages: [
            {
              role: 'assistant',
              content: "I'm doing well, thanks for asking!",
            },
          ],
        },
        {
          turn: 3,
          messages: [
            { role: 'user', content: 'Can you help me with a question?' },
          ],
        },
        {
          turn: 4,
          messages: [
            { role: 'assistant', content: "Of course! I'd be happy to help." },
          ],
        },
      ],
    };

    const createResult = await client.createItems({
      externalId: conversationDatasetId,
      data: {
        items: [
          {
            title: 'Sample conversation',
            conversation: conversationData,
          },
        ],
      },
    });

    expect(createResult.count).toBe(1);

    const items = await client.getItems(conversationDatasetId);

    expect(items.length).toBe(1);
    expect(items[0].data.title).toBe('Sample conversation');

    expect(items[0].data.conversation).toEqual(
      JSON.stringify(conversationData),
    );
  });
});
