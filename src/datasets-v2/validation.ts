import { z } from 'zod';
import type { Conversation } from './types';

/**
 * Conversation message schema
 */
export const conversationMessageSchema = z.object({
  role: z.string().trim().min(1, 'Role must not be empty'),
  content: z.string().trim().min(1, 'Message must have non-empty content'),
});

/**
 * Conversation turn schema
 */
export const conversationTurnSchema = z.object({
  turn: z
    .number()
    .int()
    .min(1, 'Turn must be a valid turn number (integer ≥ 1)'),
  messages: z
    .array(conversationMessageSchema)
    .min(1, 'Turn must have at least one message'),
});

/**
 * Conversation schema
 */
export const conversationSchema = z.object({
  roles: z
    .array(z.string().trim().min(1))
    .length(2, 'Conversation must have exactly two roles'),
  turns: z
    .array(conversationTurnSchema)
    .min(1, 'Conversation must have at least one turn'),
});

export type ValidatedConversation = z.infer<typeof conversationSchema>;

/**
 * Validates a conversation object
 */
export function validateConversation(data: unknown): {
  valid: boolean;
  message?: string;
  data?: Conversation;
} {
  const result = conversationSchema.safeParse(data);

  if (!result.success) {
    return {
      valid: false,
      message: result.error.errors.map((err) => err.message).join('; '),
    };
  }

  // Additional validation to ensure message roles match declared roles
  const typedData = result.data;
  const validRoles = new Set(typedData.roles);

  for (const turn of typedData.turns) {
    for (const message of turn.messages) {
      if (!validRoles.has(message.role)) {
        return {
          valid: false,
          message: `Message must have a valid role (one of: ${typedData.roles.join(', ')})`,
        };
      }
    }
  }

  return { valid: true, data: typedData };
}
