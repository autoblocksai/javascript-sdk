/**
 * Conversation message
 */
export interface ConversationMessage {
  role: string;
  content: string;
}

/**
 * Conversation turn
 */
export interface ConversationTurn {
  turn: number;
  messages: ConversationMessage[];
}

/**
 * Conversation
 */
export interface Conversation {
  roles: string[];
  turns: ConversationTurn[];
}
