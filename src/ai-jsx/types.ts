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
  props: unknown;
  startTime: string;
  endTime: string | undefined;
  children: (AutoblocksSpan | string)[];
}
