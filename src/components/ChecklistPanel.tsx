import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, Circle, Clock3, Eye, ListPlus } from 'lucide-react';
import { api } from '../api/client';
import { Checklist, ChecklistStatus, User } from '../types';

const statusIcon: Record<ChecklistStatus, JSX.Element> = {
  Todo: <Circle size={15} />,
  Doing: <Clock3 size={15} />,
  Review: <Eye size={15} />,
  Done: <Check size={15} />,
};

const nextStatus: Record<ChecklistStatus, ChecklistStatus> = {
  Todo: 'Doing',
  Doing: 'Review',
  Review: 'Done',
  Done: 'Todo',
};

export function ChecklistPanel({ topicId, fallback, users }: { topicId?: string; fallback: Checklist[]; users: User[] }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const checklistQuery = useQuery({
    queryKey: ['checklists', topicId],
    queryFn: () => api.checklists(topicId ?? ''),
    enabled: Boolean(topicId),
  });
  const checklists = checklistQuery.isError ? fallback : checklistQuery.data ?? [];
  const primaryChecklist = checklists[0];
  const selectedDri = users[0];

  const createTemplateMutation = useMutation({
    mutationFn: (template: 'Apple DRI' | 'Google Design Sprint') =>
      api.createChecklistTemplate(template, {
        topicId: topicId ?? '',
        driUserId: selectedDri?._id ?? '',
      }),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['checklists', topicId] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Không tạo được checklist.');
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ checklistId, itemId, status }: { checklistId: string; itemId: string; status: ChecklistStatus }) =>
      api.updateChecklistItem(checklistId, itemId, { status }),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['checklists', topicId] });
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : 'Không cập nhật được checklist.');
    },
  });

  const canCreateTemplate = Boolean(topicId && selectedDri?._id && !createTemplateMutation.isPending);

  return (
    <section className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/60">Checklist</h2>
        <span className="rounded bg-paper px-2 py-1 text-xs text-ink/60">{primaryChecklist?.template ?? 'Custom'}</span>
      </div>
      {(error || checklistQuery.isError) && (
        <p className="mb-2 rounded border border-alert/25 bg-alert/10 px-3 py-2 text-xs text-alert">
          {error || 'Không tải được checklist. Đang hiển thị dữ liệu mẫu nếu có.'}
        </p>
      )}

      {primaryChecklist ? (
        <div className="space-y-2">
          {primaryChecklist.items.map((item) => {
            const dri = typeof item.driUserId === 'string' ? 'DRI' : item.driUserId.name;
            return (
              <div key={item._id} className="rounded border border-ink/10 bg-paper px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-moss">{statusIcon[item.status]}</span>
                    <span className="truncate text-sm font-medium">{item.title}</span>
                  </div>
                  <button
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded border border-ink/10 bg-panel px-2 text-xs text-ink/70 hover:border-moss disabled:opacity-50"
                    disabled={updateItemMutation.isPending || checklistQuery.isError}
                    onClick={() =>
                      updateItemMutation.mutate({
                        checklistId: primaryChecklist._id,
                        itemId: item._id,
                        status: nextStatus[item.status],
                      })
                    }
                    title={`Move to ${nextStatus[item.status]}`}
                    type="button"
                  >
                    {item.status}
                  </button>
                </div>
                <div className="text-xs text-ink/50">
                  {item.phase ? `${item.phase} · ` : ''}
                  {dri}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded border border-dashed border-ink/20 bg-paper p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink/70">
            <ListPlus size={16} />
            <span>Start a workflow template</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              className="h-9 rounded bg-ink px-3 text-sm font-medium text-panel disabled:opacity-40"
              disabled={!canCreateTemplate}
              onClick={() => createTemplateMutation.mutate('Google Design Sprint')}
              type="button"
            >
              Design Sprint
            </button>
            <button
              className="h-9 rounded border border-ink/10 bg-panel px-3 text-sm font-medium text-ink disabled:opacity-40"
              disabled={!canCreateTemplate}
              onClick={() => createTemplateMutation.mutate('Apple DRI')}
              type="button"
            >
              Apple DRI
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
