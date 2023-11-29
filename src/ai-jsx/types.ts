import type { Node } from 'ai-jsx';

export interface AutoblocksPlaceholderProps {
  children: Node;
  name: string;
}

export interface AutoblocksSpan {
  id: string;
  parentId: string | undefined;
  memoizedId: string | undefined;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: Record<string, any>;
  startTime: string;
  endTime: string | undefined;
  error?: string;
  children: (AutoblocksSpan | string)[];
}
