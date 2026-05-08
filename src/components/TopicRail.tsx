import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle2, CircleAlert, Plus, X } from 'lucide-react';
import { api } from '../api/client';
import { useWorkspace } from '../store/workspace';
import { Topic, User } from '../types';

export function TopicRail({
  topics,
  activeTopicId,
  currentUser,
  groupId,
}: {
  topics: Topic[];
  activeTopicId?: string;
  currentUser: User;
  groupId?: string;
}) {
  const queryClient = useQueryClient();
  const setSelectedTopicId = useWorkspace((state) => state.setSelectedTopicId);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Tech');
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10));

  const createTopicMutation = useMutation({
    mutationFn: () =>
      api.createTopic({
        groupId: groupId ?? '',
        leaderId: currentUser._id,
        title,
        description,
        category,
        deadline: new Date(`${deadline}T23:59:00`).toISOString(),
      }),
    onSuccess: (topic) => {
      setTitle('');
      setDescription('');
      setIsCreating(false);
      setSelectedTopicId(topic._id);
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !groupId || createTopicMutation.isPending) {
      return;
    }
    createTopicMutation.mutate();
  };

  return (
    <nav className="border-r border-ink/10 bg-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">Topics</h2>
        <div className="flex items-center gap-2">
          <span className="rounded bg-paper px-2 py-1 text-xs text-ink/60">{topics.length}</span>
          <button
            aria-label={isCreating ? 'Close new topic form' : 'Create new topic'}
            className="grid h-8 w-8 place-items-center rounded border border-ink/10 bg-paper text-ink hover:border-moss"
            onClick={() => setIsCreating((value) => !value)}
            title={isCreating ? 'Close' : 'New topic'}
            type="button"
          >
            {isCreating ? <X size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>
      {isCreating && (
        <form className="mb-4 rounded border border-moss/30 bg-moss/5 p-3" onSubmit={submit}>
          <div className="grid gap-2">
            <input
              className="h-10 rounded border border-ink/10 bg-panel px-3 text-sm outline-none focus:border-moss"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Topic title"
              value={title}
            />
            <textarea
              className="min-h-20 resize-none rounded border border-ink/10 bg-panel px-3 py-2 text-sm outline-none focus:border-moss"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description"
              value={description}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-10 rounded border border-ink/10 bg-panel px-2 text-sm outline-none focus:border-moss"
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                <option>Science</option>
                <option>Tech</option>
                <option>Life</option>
                <option>Energy</option>
                <option>Business</option>
                <option>Other</option>
              </select>
              <input
                className="h-10 rounded border border-ink/10 bg-panel px-2 text-sm outline-none focus:border-moss"
                onChange={(event) => setDeadline(event.target.value)}
                type="date"
                value={deadline}
              />
            </div>
            {createTopicMutation.isError && <p className="text-xs leading-5 text-alert">Không tạo được chủ đề. Kiểm tra dữ liệu nhóm hoặc kết nối API.</p>}
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded bg-ink px-3 text-sm font-medium text-panel disabled:opacity-45"
              disabled={!title.trim() || !groupId || createTopicMutation.isPending}
              type="submit"
            >
              <Plus size={16} />
              Create topic
            </button>
          </div>
        </form>
      )}
      <div className="space-y-2">
        {topics.length === 0 && !isCreating && (
          <div className="rounded border border-dashed border-ink/20 bg-paper px-3 py-4 text-sm leading-6 text-ink/60">
            Chưa có chủ đề. Bấm nút + để tạo chủ đề đầu tiên.
          </div>
        )}
        {topics.map((topic) => {
          const active = topic._id === activeTopicId;
          const overdue = topic.status === 'Overdue' || new Date(topic.deadline).getTime() < Date.now();
          return (
            <button
              key={topic._id}
              className={`w-full rounded border p-3 text-left transition ${
                active ? 'border-moss bg-moss/10' : 'border-ink/10 bg-panel hover:bg-paper'
              }`}
              onClick={() => setSelectedTopicId(topic._id)}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{topic.title}</span>
                {overdue ? <CircleAlert className="shrink-0 text-alert" size={16} /> : <CheckCircle2 className="shrink-0 text-moss" size={16} />}
              </div>
              <p className="line-clamp-2 text-xs leading-5 text-ink/60">{topic.description}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-ink/50">
                <Calendar size={14} />
                <span>{new Date(topic.deadline).toLocaleDateString('vi-VN')}</span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
