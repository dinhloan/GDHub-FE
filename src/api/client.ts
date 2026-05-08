import { Checklist, ChecklistStatus, Entry, Group, Message, Topic, User } from '../types';

const defaultApiBaseUrl = () => {
  const protocol = typeof window === 'undefined' ? 'http:' : window.location.protocol;
  const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
  return `${protocol}//${hostname}:4000/api`;
};

export const API_BASE_URL = import.meta.env.VITE_API_URL || defaultApiBaseUrl();

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

export const api = {
  users: () => request<User[]>('/users'),
  groups: () => request<Group[]>('/groups'),
  createGroup: (payload: { name: string; leaderId: string; members: string[] }) =>
    request<Group>('/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  topics: (groupId?: string) => request<Topic[]>(`/topics${groupId ? `?groupId=${groupId}` : ''}`),
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
  searchEntries: (query: string, topicId?: string) =>
    request<Entry[]>(`/entries/search?q=${encodeURIComponent(query)}${topicId ? `&topicId=${topicId}` : ''}`),
  graph: (topicId: string) => request<{ nodes: unknown[]; edges: unknown[] }>(`/entries/graph/${topicId}`),
  messages: (entryId: string) => request<Message[]>(`/discussion/entries/${entryId}/messages`),
  checklists: (topicId: string) => request<Checklist[]>(`/checklists/topic/${topicId}`),
  createChecklistTemplate: (template: 'Apple DRI' | 'Google Design Sprint', payload: { topicId: string; driUserId: string }) =>
    request<Checklist>(`/checklists/template/${encodeURIComponent(template)}?topicId=${payload.topicId}&driUserId=${payload.driUserId}`, {
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
    request<{ template: string; questions: string[]; source: string }>('/ai/critique', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
