import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, ImagePlus, Plus, Save, Tags, Trash2, X } from 'lucide-react';
import { api } from '../api/client';
import { useWorkspace } from '../store/workspace';
import { Entry, Topic, User } from '../types';
import { VoiceNoteButton } from './VoiceNoteButton';

export function EntryEditor({
  topic,
  activeEntry,
  users,
  currentUser,
}: {
  topic?: Topic;
  activeEntry?: Entry;
  users: User[];
  currentUser: User;
}) {
  const queryClient = useQueryClient();
  const draftContent = useWorkspace((state) => state.draftContent);
  const setDraftContent = useWorkspace((state) => state.setDraftContent);
  const setSelectedEntryId = useWorkspace((state) => state.setSelectedEntryId);
  const startNewEntry = useWorkspace((state) => state.startNewEntry);
  const [tagInput, setTagInput] = useState('ai-critic, workflow');
  const [status, setStatus] = useState<'Draft' | 'Debating' | 'Final'>('Draft');
  const [media, setMedia] = useState<{ type: string; url: string }[]>([]);
  const [critique, setCritique] = useState<string[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const author = currentUser ?? users[0];

  useEffect(() => {
    setDraftContent(activeEntry?.content ?? '');
    setTagInput(activeEntry?.tags?.map((tag) => `${tag.isPrivate ? '_' : ''}${tag.name.replace(/^_/, '')}`).join(', ') || 'ai-critic, workflow');
    setStatus(activeEntry?.status ?? 'Draft');
    setMedia(activeEntry?.media ?? []);
    setError('');
  }, [activeEntry?._id, activeEntry?.content, activeEntry?.media, activeEntry?.status, activeEntry?.tags, setDraftContent]);

  const content = draftContent;
  const tags = useMemo(
    () =>
      tagInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((name) => ({ name, isPrivate: name.startsWith('_') })),
    [tagInput],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        topicId: topic?._id ?? '',
        authorId: author?._id ?? '',
        content,
        status,
        tags,
        media,
      };

      return activeEntry ? api.updateEntry(activeEntry._id, payload) : api.createEntry(payload);
    },
    onSuccess: (entry) => {
      setError('');
      setSelectedEntryId(entry._id);
      queryClient.setQueryData<Entry[]>(['entries', topic?._id], (current) => {
        const entries = current ?? [];
        const entryIndex = entries.findIndex((candidate) => candidate._id === entry._id);
        if (entryIndex === -1) {
          return [entry, ...entries];
        }

        return entries.map((candidate) => (candidate._id === entry._id ? entry : candidate));
      });
      queryClient.invalidateQueries({ queryKey: ['entries', topic?._id] });
      queryClient.invalidateQueries({ queryKey: ['graph', topic?._id] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Không lưu được ghi chú.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteEntry(activeEntry?._id ?? ''),
    onSuccess: () => {
      setError('');
      queryClient.setQueryData<Entry[]>(['entries', topic?._id], (current) => (current ?? []).filter((entry) => entry._id !== activeEntry?._id));
      startNewEntry();
      queryClient.invalidateQueries({ queryKey: ['entries', topic?._id] });
      queryClient.invalidateQueries({ queryKey: ['graph', topic?._id] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Không xóa được ghi chú.');
    },
  });

  const imageMutation = useMutation({
    mutationFn: (file: File) => api.uploadEntryImage(file),
    onSuccess: (uploaded) => {
      setMedia((current) => [...current, uploaded]);
      setError('');
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Không gửi được ảnh.');
    },
  });

  const critiqueMutation = useMutation({
    mutationFn: () => api.critique({ content, template: '5W1H' }),
    onSuccess: (data) => setCritique(data.questions),
  });

  const handleTranscript = useCallback(
    (text: string) => {
      setDraftContent(text);
    },
    [setDraftContent],
  );

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    imageMutation.mutate(file);
  };

  return (
    <div className="flex min-h-editor flex-col rounded-stitch border border-outline bg-surface-tonal shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Soạn thảo</h2>
          <p className="mt-1 text-xs text-primary/45">{activeEntry ? author?.name || author?.username || 'Local member' : 'New note'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-stitch border border-outline bg-surface px-3 text-sm font-medium text-primary/75 hover:border-attention"
            onClick={startNewEntry}
            type="button"
          >
            <Plus size={16} />
            New
          </button>
          {activeEntry && (
            <button
              aria-label="Delete note"
              className="grid h-10 w-10 place-items-center rounded-stitch border border-outline bg-surface text-primary/70 hover:border-danger hover:text-danger disabled:opacity-45"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm('Xóa ghi chú này?')) {
                  deleteMutation.mutate();
                }
              }}
              title="Delete note"
              type="button"
            >
              <Trash2 size={16} />
            </button>
          )}
          <input accept="image/*" className="hidden" onChange={handleImageChange} ref={fileInputRef} type="file" />
          <button
            aria-label="Attach image"
            className="grid h-10 w-10 place-items-center rounded-stitch border border-outline bg-surface text-primary/70 hover:border-accent disabled:opacity-45"
            disabled={imageMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
            type="button"
          >
            <ImagePlus size={16} />
          </button>
          <VoiceNoteButton onTranscript={handleTranscript} />
          <button
            className="inline-flex h-10 items-center gap-2 rounded-stitch bg-accent px-3 text-sm font-semibold text-on-accent disabled:opacity-40"
            disabled={!content.trim() || !topic?._id || !author?._id || saveMutation.isPending || imageMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Save size={16} />
            {activeEntry ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {error && <p className="rounded-stitch border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <textarea
          className="min-h-64 flex-1 resize-none rounded-stitch border border-outline bg-surface p-4 text-base leading-7 text-primary outline-none placeholder:text-primary/35 focus:border-accent"
          value={content}
          onChange={(event) => setDraftContent(event.target.value)}
          placeholder="Ghi lại quan sát, transcript, luận điểm hoặc phản biện..."
        />

        {media.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {media.map((item) => (
              <div className="relative overflow-hidden rounded-stitch border border-outline bg-surface" key={item.url}>
                <img alt="Entry attachment" className="h-32 w-full object-cover" src={item.url} />
                <button
                  aria-label="Remove image"
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-stitch bg-surface-tonal text-primary shadow-soft hover:text-danger"
                  onClick={() => setMedia((current) => current.filter((candidate) => candidate.url !== item.url))}
                  type="button"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <p className="text-xs leading-5 text-primary/55 sm:col-span-2 xl:col-span-3">Remove or add images, then press Update/Save to persist the note.</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-editor">
          <label className="relative block">
            <Tags className="absolute left-3 top-3 text-primary/40" size={16} />
            <input
              className="h-10 w-full rounded-stitch border border-outline bg-surface pl-9 pr-3 text-sm text-primary outline-none placeholder:text-primary/35 focus:border-accent"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="tags"
            />
          </label>
          <select
            className="h-10 rounded-stitch border border-outline bg-surface px-3 text-sm text-primary outline-none focus:border-accent"
            value={status}
            onChange={(event) => setStatus(event.target.value as 'Draft' | 'Debating' | 'Final')}
          >
            <option>Draft</option>
            <option>Debating</option>
            <option>Final</option>
          </select>
        </div>

        {(status === 'Debating' || activeEntry?.status === 'Debating') && (
          <div className="rounded-stitch border border-attention/35 bg-attention/10 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">AI Critic</h3>
                <p className="text-xs text-primary/60">5W1H, four expert perspectives</p>
              </div>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-stitch bg-attention px-3 text-sm font-semibold text-on-accent disabled:opacity-50"
                disabled={!content.trim() || critiqueMutation.isPending}
                onClick={() => critiqueMutation.mutate()}
              >
                <Bot size={16} />
                Critique
              </button>
            </div>
            <div className="space-y-2">
              {(critique.length ? critique : ['AI critique will appear here when requested.']).map((question) => (
                <p key={question} className="rounded-stitch bg-surface-tonal px-3 py-2 text-sm leading-6 text-primary/75">
                  {question}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
