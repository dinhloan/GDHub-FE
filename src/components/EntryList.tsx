import { FileText, Lock, MessageCircle, Plus } from 'lucide-react';
import { useWorkspace } from '../store/workspace';
import { Entry } from '../types';

export function EntryList({ entries, activeEntryId }: { entries: Entry[]; activeEntryId?: string }) {
  const setSelectedEntryId = useWorkspace((state) => state.setSelectedEntryId);
  const startNewEntry = useWorkspace((state) => state.startNewEntry);

  return (
    <div className="border-r border-ink/10 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">Entries</h2>
        <div className="flex items-center gap-2">
          <span className="rounded bg-panel px-2 py-1 text-xs text-ink/60">{entries.length}</span>
          <button
            aria-label="Create new note"
            className="grid h-8 w-8 place-items-center rounded border border-ink/10 bg-panel text-ink hover:border-amberline"
            onClick={startNewEntry}
            title="New note"
            type="button"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {entries.map((entry) => (
          <button
            key={entry._id}
            className={`w-full rounded border p-3 text-left transition ${
              entry._id === activeEntryId ? 'border-amberline bg-amberline/10' : 'border-ink/10 bg-panel hover:border-moss/50'
            }`}
            onClick={() => setSelectedEntryId(entry._id)}
          >
            <div className="mb-2 flex items-center gap-2">
              <FileText size={16} className="text-moss" />
              <span className="text-sm font-medium">{entry.status}</span>
              {entry.status === 'Debating' ? <MessageCircle size={15} className="text-amberline" /> : null}
            </div>
            <p className="line-clamp-3 text-sm leading-5 text-ink/75">{entry.content}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {entry.tags.map((tag) => (
                <span key={`${entry._id}-${tag.name}`} className="inline-flex items-center gap-1 rounded bg-paper px-2 py-1 text-xs text-ink/60">
                  {tag.isPrivate ? <Lock size={12} /> : null}
                  {tag.name}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
