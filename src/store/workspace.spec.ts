import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkspace } from './workspace';

describe('workspace store', () => {
  beforeEach(() => {
    useWorkspace.setState({
      selectedTopicId: null,
      selectedEntryId: null,
      draftContent: '',
      searchQuery: '',
    });
  });

  it('clears selected entry when topic changes', () => {
    useWorkspace.getState().setSelectedEntryId('entry-1');
    useWorkspace.getState().setSelectedTopicId('topic-1');

    expect(useWorkspace.getState().selectedTopicId).toBe('topic-1');
    expect(useWorkspace.getState().selectedEntryId).toBeNull();
  });

  it('updates draft and semantic search query', () => {
    useWorkspace.getState().setDraftContent('voice transcript');
    useWorkspace.getState().setSearchQuery('knowledge graph');

    expect(useWorkspace.getState().draftContent).toBe('voice transcript');
    expect(useWorkspace.getState().searchQuery).toBe('knowledge graph');
  });
});
