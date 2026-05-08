import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BrainCircuit, Clock, GitBranch, LogOut, MessageSquareText, Search, Users } from 'lucide-react';
import { io } from 'socket.io-client';
import { api } from './api/client';
import { ChecklistPanel } from './components/ChecklistPanel';
import { DiscussionPanel } from './components/DiscussionPanel';
import { EntryEditor } from './components/EntryEditor';
import { EntryList } from './components/EntryList';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { LoginScreen } from './components/LoginScreen';
import { TopicRail } from './components/TopicRail';
import { useWorkspace } from './store/workspace';
import { Entry, Topic, User } from './types';

const defaultSocketUrl = () => {
  const protocol = typeof window === 'undefined' ? 'http:' : window.location.protocol;
  const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
  return `${protocol}//${hostname}:4000`;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || defaultSocketUrl();
const SESSION_USER_KEY = 'gdhub.currentUserId';

export default function App() {
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem(SESSION_USER_KEY) ?? '');
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.users });
  const users = usersQuery.data ?? [];
  const currentUser = users.find((user) => user._id === currentUserId);

  const handleLogin = (user: User) => {
    localStorage.setItem(SESSION_USER_KEY, user._id);
    setCurrentUserId(user._id);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_USER_KEY);
    setCurrentUserId('');
  };

  if (!currentUser) {
    return (
      <LoginScreen
        users={users}
        isLoading={usersQuery.isLoading}
        error={usersQuery.isError ? 'Không kết nối được backend hoặc chưa tải được danh sách user thật.' : undefined}
        onLogin={handleLogin}
      />
    );
  }

  return <Workspace currentUser={currentUser} users={users} onLogout={handleLogout} />;
}

function Workspace({ currentUser, users, onLogout }: { currentUser: User; users: User[]; onLogout: () => void }) {
  const queryClient = useQueryClient();
  const selectedTopicId = useWorkspace((state) => state.selectedTopicId);
  const selectedEntryId = useWorkspace((state) => state.selectedEntryId);
  const isComposingEntry = useWorkspace((state) => state.isComposingEntry);
  const setSelectedTopicId = useWorkspace((state) => state.setSelectedTopicId);
  const setSelectedEntryId = useWorkspace((state) => state.setSelectedEntryId);
  const searchQuery = useWorkspace((state) => state.searchQuery);
  const setSearchQuery = useWorkspace((state) => state.setSearchQuery);

  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: api.groups });
  const activeGroup = groupsQuery.data?.[0];
  const topicsQuery = useQuery({ queryKey: ['topics', activeGroup?._id], queryFn: () => api.topics(activeGroup?._id), enabled: Boolean(activeGroup?._id) });
  const topics = topicsQuery.data ?? [];
  const activeTopic = topics.find((topic) => topic._id === selectedTopicId) ?? topics[0];

  useEffect(() => {
    if (!selectedTopicId && activeTopic) {
      setSelectedTopicId(activeTopic._id);
    }
  }, [activeTopic, selectedTopicId, setSelectedTopicId]);

  const entriesQuery = useQuery({
    queryKey: ['entries', activeTopic?._id],
    queryFn: () => api.entries(activeTopic?._id),
    enabled: Boolean(activeTopic?._id),
  });

  const searchQueryResult = useQuery({
    queryKey: ['entry-search', searchQuery, activeTopic?._id],
    queryFn: () => api.searchEntries(searchQuery, activeTopic?._id),
    enabled: Boolean(searchQuery.trim() && activeTopic?._id),
  });

  const entries = useMemo(() => {
    const source = searchQuery.trim() ? searchQueryResult.data : entriesQuery.data;
    return source ?? [];
  }, [entriesQuery.data, searchQuery, searchQueryResult.data]);

  const activeEntry = isComposingEntry ? undefined : entries.find((entry) => entry._id === selectedEntryId) ?? entries[0];

  useEffect(() => {
    if (!isComposingEntry && !selectedEntryId && activeEntry) {
      setSelectedEntryId(activeEntry._id);
    }
  }, [activeEntry, isComposingEntry, selectedEntryId, setSelectedEntryId]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      query: activeEntry?._id ? { entryId: activeEntry._id } : undefined,
    });
    socket.on('message-created', () => queryClient.invalidateQueries({ queryKey: ['messages', activeEntry?._id] }));
    socket.on('topic-overdue', () => queryClient.invalidateQueries({ queryKey: ['topics'] }));
    return () => {
      socket.disconnect();
    };
  }, [activeEntry?._id, queryClient]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="flex h-16 items-center justify-between border-b border-ink/10 bg-panel px-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded bg-ink text-panel">
            <BrainCircuit size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">GDHub</h1>
            <p className="text-xs text-ink/60">Collaborative Knowledge Diary Hub</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative hidden w-72 sm:block">
            <Search className="absolute left-3 top-2.5 text-ink/40" size={16} />
            <input
              className="h-10 w-full rounded border border-ink/10 bg-paper pl-9 pr-3 text-sm outline-none focus:border-moss"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Semantic search"
            />
          </div>
          <div className="flex items-center gap-2 rounded border border-ink/10 bg-paper px-3 py-2 text-sm">
            <Users size={16} />
            <span>{users.length} members</span>
          </div>
          <div className="hidden min-w-0 items-center gap-2 rounded border border-ink/10 bg-paper px-3 py-2 text-sm md:flex">
            <span className="max-w-40 truncate">{currentUser.displayName || currentUser.name || currentUser.username || currentUser.email}</span>
          </div>
          <button
            aria-label="Logout"
            className="grid h-10 w-10 place-items-center rounded border border-ink/10 bg-paper text-ink hover:border-alert hover:text-alert"
            onClick={onLogout}
            title="Logout"
            type="button"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_360px]">
        <TopicRail topics={topics} activeTopicId={activeTopic?._id} currentUser={currentUser} groupId={activeGroup?._id} />
        <section className="min-w-0 border-r border-ink/10">
          {activeTopic ? (
            <>
              <TopicSummary topic={activeTopic} entries={entries} />
              <div className="grid min-h-[calc(100vh-13rem)] grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)]">
                <EntryList entries={entries} activeEntryId={activeEntry?._id} />
                <EntryEditor topic={activeTopic} activeEntry={activeEntry} users={users} currentUser={currentUser} />
              </div>
            </>
          ) : (
            <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
              <div className="max-w-md rounded border border-dashed border-ink/20 bg-panel p-6 text-center">
                <h2 className="text-lg font-semibold">Chưa có chủ đề</h2>
                <p className="mt-2 text-sm leading-6 text-ink/60">Bấm nút + trong cột Topics để tạo chủ đề đầu tiên.</p>
              </div>
            </section>
          )}
        </section>
        <aside className="grid min-h-[calc(100vh-4rem)] grid-rows-[minmax(260px,0.95fr)_minmax(260px,1fr)] bg-panel">
          <KnowledgeGraph topicId={activeTopic?._id} entries={entries} />
          <div className="grid border-t border-ink/10 xl:grid-cols-1">
            <ChecklistPanel topicId={activeTopic?._id} fallback={[]} users={users} />
            <DiscussionPanel entry={activeEntry} fallback={[]} users={users} currentUser={currentUser} />
          </div>
        </aside>
      </main>
    </div>
  );
}

function TopicSummary({ topic, entries }: { topic?: Topic; entries: Entry[] }) {
  if (!topic) {
    return null;
  }

  const deadline = new Date(topic.deadline);
  const isOverdue = topic.status === 'Overdue' || deadline.getTime() < Date.now();

  return (
    <div className="border-b border-ink/10 bg-panel px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded bg-moss/10 px-2 py-1 text-xs font-medium text-moss">{topic.category}</span>
            <span className={`rounded px-2 py-1 text-xs font-medium ${isOverdue ? 'bg-alert/10 text-alert' : 'bg-ink/10 text-ink'}`}>
              {isOverdue ? 'Overdue' : topic.status}
            </span>
          </div>
          <h2 className="text-2xl font-semibold leading-tight">{topic.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">{topic.description}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Metric icon={<MessageSquareText size={16} />} label="Entries" value={entries.length.toString()} />
          <Metric icon={<GitBranch size={16} />} label="Debating" value={entries.filter((entry) => entry.status === 'Debating').length.toString()} />
          <Metric icon={<Clock size={16} />} label="Deadline" value={deadline.toLocaleDateString('vi-VN')} />
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-24 rounded border border-ink/10 bg-paper px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-ink/50">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
