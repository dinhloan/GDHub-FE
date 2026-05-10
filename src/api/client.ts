import { Checklist, ChecklistStatus, Entry, Group, Message, ReadmePayload, Topic, User } from '../types';

const defaultApiBaseUrl = () => 'http://localhost:3000/api';

export const API_BASE_URL = import.meta.env.VITE_API_URL || defaultApiBaseUrl();
const REQUEST_TIMEOUT_MS = 30000;
const AI_REQUEST_TIMEOUT_MS = 90000;

function unwrapResponse<T>(data: unknown): T {
  if (data && typeof data === 'object' && 'value' in data) {
    return (data as { value: T }).value;
  }

  return data as T;
}

async function request<T>(path: string, options?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
      signal: options?.signal ?? controller.signal,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const text = await response.text();
    return unwrapResponse<T>(text ? JSON.parse(text) : {});
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function upload<T>(path: string, formData: FormData, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json() as Promise<T>;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export const api = {
  readme: () => request<ReadmePayload>('/readme'),
  users: () => request<User[]>('/users'),
  groups: () => request<Group[]>('/groups'),
  createGroup: (payload: { name: string; leaderId: string; members: string[] }) =>
    request<Group>('/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  topics: (groupId?: string) => request<Topic[]>(`/topics${groupId ? `?groupId=${encodeURIComponent(groupId)}` : ''}`),
  createTopic: (payload: {
    groupId: string;
    leaderId: string;
    title: string;
    description?: string;
    deadline: string;
    category: string;
  }) =>
    request<Topic>('/topics', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  entries: (topicId?: string) => request<Entry[]>(`/entries${topicId ? `?topicId=${topicId}` : ''}`),
  entry: (id: string) => request<Entry>(`/entries/${id}`),
  searchEntries: (query: string, topicId?: string) =>
    request<Entry[]>(`/entries/search?q=${encodeURIComponent(query)}${topicId ? `&topicId=${topicId}` : ''}`),
  graph: (topicId: string) => request<{ nodes: unknown[]; edges: unknown[] }>(`/entries/graph/${topicId}`),
  messages: (entryId: string) => request<Message[]>(`/discussion/entries/${entryId}/messages`),
  checklists: (topicId: string) => request<Checklist[]>(`/checklists/topic/${topicId}`),
  createChecklistTemplate: (template: 'Apple DRI' | 'Google Design Sprint', payload: { topicId: string; driUserId: string }) =>
    request<Checklist>(`/checklists/template/${encodeURIComponent(template)}?topicId=${encodeURIComponent(payload.topicId)}&driUserId=${encodeURIComponent(payload.driUserId)}`, {
      method: 'POST',
    }),
  updateChecklistItem: (checklistId: string, itemId: string, payload: { status?: ChecklistStatus; title?: string; phase?: string }) =>
    request<Checklist>(`/checklists/${checklistId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  createEntry: (payload: {
    topicId: string;
    authorId: string;
    content: string;
    status: string;
    tags: { name: string; isPrivate: boolean }[];
    media?: { type: string; url: string }[];
  }) =>
    request<Entry>('/entries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateEntry: (
    id: string,
    payload: {
      topicId?: string;
      authorId?: string;
      content?: string;
      status?: string;
      tags?: { name: string; isPrivate: boolean }[];
      media?: { type: string; url: string }[];
    },
  ) =>
    request<Entry>(`/entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteEntry: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/entries/${id}`, {
      method: 'DELETE',
    }),
  uploadEntryImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return upload<{ type: 'image'; url: string }>('/entries/media', formData);
  },
  createMessage: (payload: { entryId: string; userId: string; content: string; type: string }) =>
    request<Message>('/discussion/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  critique: (payload: { content: string; template: '6 Thinking Hats' | '5W1H' }) =>
    request<{ template: string; questions: string[]; source: string }>(
      '/ai/critique',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      AI_REQUEST_TIMEOUT_MS,
    ),
  transcribe: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return upload<{ text: string; source: string }>('/ai/transcribe', formData, AI_REQUEST_TIMEOUT_MS);
  },
};
