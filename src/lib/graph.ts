import { Edge, Node } from 'reactflow';
import { Entry } from '../types';

export function buildFallbackGraph(topicId: string | undefined, entries: Entry[]) {
  const rootId = topicId ?? 'topic';
  const nodes: Node[] = [
    {
      id: rootId,
      position: { x: 160, y: 40 },
      data: { label: 'Topic' },
      type: 'input',
    },
    ...entries.map((entry, index) => ({
      id: entry._id,
      position: { x: 40 + (index % 2) * 220, y: 150 + index * 82 },
      data: { label: entry.content.slice(0, 34) },
    })),
  ];

  const edges: Edge[] = entries.map((entry) => ({
    id: `${rootId}-${entry._id}`,
    source: rootId,
    target: entry._id,
    animated: entry.status === 'Debating',
  }));

  return { nodes, edges };
}

export function normalizeGraph(rawNodes: unknown[], rawEdges: unknown[]) {
  const nodes: Node[] = rawNodes.map((node, index) => {
    const item = node as { id: string; label?: string; type?: string };
    return {
      id: item.id,
      type: item.type === 'topic' ? 'input' : undefined,
      position: { x: 80 + (index % 2) * 220, y: 40 + index * 86 },
      data: { label: item.label ?? item.id },
    };
  });

  const edges: Edge[] = rawEdges.map((edge) => {
    const item = edge as { id: string; source: string; target: string; label?: string };
    return {
      id: item.id,
      source: item.source,
      target: item.target,
      label: item.label,
    };
  });

  return { nodes, edges };
}
