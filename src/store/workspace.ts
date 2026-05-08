import { create } from 'zustand';

type WorkspaceState = {
  selectedTopicId: string | null;
  selectedEntryId: string | null;
  isComposingEntry: boolean;
  draftContent: string;
  searchQuery: string;
  setSelectedTopicId: (id: string | null) => void;
  setSelectedEntryId: (id: string | null) => void;
  startNewEntry: () => void;
  setDraftContent: (content: string) => void;
  setSearchQuery: (query: string) => void;
};

export const useWorkspace = create<WorkspaceState>((set) => ({
  selectedTopicId: null,
  selectedEntryId: null,
  isComposingEntry: false,
  draftContent: '',
  searchQuery: '',
  setSelectedTopicId: (id) => set({ selectedTopicId: id, selectedEntryId: null, isComposingEntry: false, draftContent: '' }),
  setSelectedEntryId: (id) => set({ selectedEntryId: id, isComposingEntry: false }),
  startNewEntry: () => set({ selectedEntryId: null, isComposingEntry: true, draftContent: '' }),
  setDraftContent: (content) => set({ draftContent: content }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
