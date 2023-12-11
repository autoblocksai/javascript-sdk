import type { Node, Component, Element } from 'ai-jsx';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = Component<any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyElement = Element<any>;

export interface AutoblocksPlaceholderProps {
  children: Node;
  name: string;
}

export interface AutoblocksTemplateSelectProps {
  children: Node;
  name: string;
  selectedItemName: string;
}

export interface AutoblocksTemplateSelectItemProps {
  children: Node;
  name: string;
}

export interface AutoblocksSpan {
  id: string;
  parentId: string | undefined;
  memoizedId: string | undefined;
  name: string;
  isChatModel: boolean;
  customChatModelComponent: AnyComponent | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: Record<string, any>;
  startTime: string;
  endTime: string | undefined;
  error?: string;
  children: (AutoblocksSpan | string)[];
}
