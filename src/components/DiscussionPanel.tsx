import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { api } from '../api/client';
import { Entry, Message, User } from '../types';

export function DiscussionPanel({
  entry,
  fallback,
  users,
  currentUser,
}: {
  entry?: Entry;
  fallback: Message[];
  users: User[];
  currentUser: User;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const messagesQuery = useQuery({
    queryKey: ['messages', entry?._id],
    queryFn: () => api.messages(entry?._id ?? ''),
    enabled: Boolean(entry?._id),
  });
  const messages = messagesQuery.data?.length ? messagesQuery.data : fallback.filter((message) => message.entryId === entry?._id);
  const user = currentUser ?? users[0];

  const mutation = useMutation({
    mutationFn: () =>
      api.createMessage({
        entryId: entry?._id ?? '',
        userId: user?._id ?? '',
        content,
        type: 'opinion',
      }),
    onSuccess: () => {
      setContent('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['messages', entry?._id] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Không gửi được thảo luận.');
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim() || !entry?._id || !user?._id) {
      return;
    }
    mutation.mutate();
  };

  return (
    <section className="rounded-stitch border border-outline bg-surface-tonal p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Thảo luận</h2>
          <p className="mt-1 text-xs text-primary/45">Phản biện theo ghi chú</p>
        </div>
        <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/60">{messages.length}</span>
      </div>
      <div className="max-h-52 space-y-2 overflow-auto pr-1">
        {messages.map((message) => {
          const sender = typeof message.userId === 'string' ? undefined : message.userId;
          return (
            <div key={message._id} className="rounded-stitch border border-outline bg-surface px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-primary/45">
                <span>{sender?.name || sender?.username || 'Member'}</span>
                <span>{new Date(message.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-sm leading-5 text-primary/80">{message.content}</p>
            </div>
          );
        })}
      </div>
      {messagesQuery.isError && <p className="mb-2 rounded-stitch border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">Không tải được thảo luận.</p>}
      {error && <p className="mb-2 rounded-stitch border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
      <form className="mt-3 flex gap-2" onSubmit={submit}>
        <input
          className="h-10 min-w-0 flex-1 rounded-stitch border border-outline bg-surface px-3 text-sm text-primary outline-none placeholder:text-primary/35 focus:border-accent"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Add opinion"
        />
        <button
          aria-label="Send opinion"
          className="grid h-10 w-10 place-items-center rounded-stitch bg-accent text-on-accent disabled:opacity-40"
          disabled={!content.trim() || !entry?._id || !user?._id || mutation.isPending}
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}
