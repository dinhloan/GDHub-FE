import { FileText, Lock, MessageCircle, Plus } from 'lucide-react';
import { useWorkspace } from '../store/workspace';
import { Entry } from '../types';

export function EntryList({ entries, activeEntryId }: { entries: Entry[]; activeEntryId?: string }) {
  const setSelectedEntryId = useWorkspace((state) => state.setSelectedEntryId);
  const startNewEntry = useWorkspace((state) => state.startNewEntry);

  return (
    <div className="rounded border border-ink/10 bg-panel p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">Nhật ký</h2>
          <p className="mt-1 text-xs text-ink/45">{entries.length} ghi chú</p>
        </div>
        <button
          aria-label="Create new note"
          className="grid h-9 w-9 place-items-center rounded bg-amberline text-paper transition hover:brightness-110"
          onClick={startNewEntry}
          title="New note"
          type="button"
        >
          <Plus size={17} />
        </button>
      </div>
      <div className="space-y-2">
        {entries.map((entry) => (
          <button
            key={entry._id}
            className={`w-full rounded border p-3 text-left transition ${
              entry._id === activeEntryId ? 'border-amberline bg-amberline/10 shadow-soft' : 'border-ink/10 bg-paper hover:border-moss/45'
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
                <span key={`${entry._id}-${tag.name}`} className="inline-flex items-center gap-1 rounded bg-panel px-2 py-1 text-xs text-ink/60">
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
