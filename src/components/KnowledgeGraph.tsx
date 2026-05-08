import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '../api/client';
import { buildFallbackGraph, normalizeGraph } from '../lib/graph';
import { Entry } from '../types';

export function KnowledgeGraph({ topicId, entries }: { topicId?: string; entries: Entry[] }) {
  const graphQuery = useQuery({
    queryKey: ['graph', topicId],
    queryFn: () => api.graph(topicId ?? ''),
    enabled: Boolean(topicId),
  });

  const { nodes, edges } = useMemo(() => {
    if (graphQuery.data?.nodes?.length) {
      return normalizeGraph(graphQuery.data.nodes, graphQuery.data.edges);
    }

    return buildFallbackGraph(topicId, entries);
  }, [entries, graphQuery.data, topicId]);

  return (
    <section className="min-h-0 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">Knowledge Graph</h2>
        <span className="rounded bg-paper px-2 py-1 text-xs text-ink/60">{nodes.length} nodes</span>
      </div>
      <div className="h-[calc(100%-2.25rem)] min-h-56 overflow-hidden rounded border border-ink/10 bg-paper">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background color="#d9d2c3" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
