import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

type UseDiaryDetailOptions = {
  enabled?: boolean;
};

export function useDiaryDetail(entryId?: string, options: UseDiaryDetailOptions = {}) {
  const enabled = options.enabled ?? true;

  return useQuery({
    queryKey: ['diary-detail', entryId],
    queryFn: () => api.entry(entryId ?? ''),
    enabled: Boolean(entryId && enabled),
    staleTime: 30000,
  });
}
