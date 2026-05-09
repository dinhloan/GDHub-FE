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
    <section className="min-h-0 rounded-stitch border border-outline bg-surface-tonal p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Sơ đồ tri thức</h2>
          <p className="mt-1 text-xs text-primary/45">Liên kết tag và luận điểm</p>
        </div>
        <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/60">{nodes.length} nodes</span>
      </div>
      <div className="h-72 overflow-hidden rounded-stitch border border-outline bg-surface lg:h-graph-lg">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background color="rgba(231,251,247,0.16)" gap={18} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
