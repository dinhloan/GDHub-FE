import { describe, expect, it } from 'vitest';
import { Entry } from '../types';
import { buildFallbackGraph, normalizeGraph } from './graph';

describe('graph helpers', () => {
  const entries: Entry[] = [
    {
      _id: 'entry-1',
      topicId: 'topic-1',
      authorId: 'user-1',
      content: 'Debating note for graph visualization',
      status: 'Debating',
      tags: [],
      media: [],
    },
    {
      _id: 'entry-2',
      topicId: 'topic-1',
      authorId: 'user-1',
      content: 'Final note',
      status: 'Final',
      tags: [],
      media: [],
    },
  ];

  it('builds fallback graph with topic root and animated debating edges', () => {
    const graph = buildFallbackGraph('topic-1', entries);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes[0]).toMatchObject({ id: 'topic-1', type: 'input' });
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'topic-1', target: 'entry-1', animated: true }),
        expect.objectContaining({ source: 'topic-1', target: 'entry-2', animated: false }),
      ]),
    );
  });

  it('normalizes backend graph payloads into React Flow nodes and edges', () => {
    const graph = normalizeGraph(
      [
        { id: 'topic-1', type: 'topic', label: 'Topic' },
        { id: 'entry-1', type: 'entry', label: 'Entry' },
      ],
      [{ id: 'edge-1', source: 'topic-1', target: 'entry-1', label: 'belongs to' }],
    );

    expect(graph.nodes[0]).toMatchObject({ id: 'topic-1', type: 'input', data: { label: 'Topic' } });
    expect(graph.edges[0]).toMatchObject({ id: 'edge-1', source: 'topic-1', target: 'entry-1' });
  });
});
