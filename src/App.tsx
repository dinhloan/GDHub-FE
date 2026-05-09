import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit3,
  FileText,
  GitBranch,
  Home,
  LogOut,
  MessageCircle,
  Network,
  Plus,
  Save,
  Search,
  Send,
  Sparkles,
  Tags,
  Upload,
  Users,
} from 'lucide-react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { io } from 'socket.io-client';
import { api } from './api/client';
import { LoginScreen } from './components/LoginScreen';
import { buildFallbackGraph, normalizeGraph } from './lib/graph';
import { Checklist, ChecklistStatus, Entry, Group, Message, Topic, User } from './types';

type ViewKey = 'home' | 'detail' | 'compose' | 'graph' | 'workflow';
type NewTopicPayload = {
  groupId: string;
  leaderId: string;
  title: string;
  description?: string;
  deadline: string;
  category: string;
};

const defaultSocketUrl = () => {
  const protocol = typeof window === 'undefined' ? 'http:' : window.location.protocol;
  const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
  return `${protocol}//${hostname}:4000`;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || defaultSocketUrl();
const SESSION_USER_KEY = 'gdhub.currentUserId';
const NEW_ENTRY_ID = '__new-entry__';

const displayName = (user?: User | string) => {
  if (!user || typeof user === 'string') {
    return 'Member';
  }

  return user.displayName || user.name || user.username || user.email;
};

const refId = (value?: User | Group | Topic | string) => {
  if (!value) {
    return '';
  }
  return typeof value === 'string' ? value : value._id;
};

const itemNextStatus: Record<ChecklistStatus, ChecklistStatus> = {
  Todo: 'Doing',
  Doing: 'Review',
  Review: 'Done',
  Done: 'Todo',
};

const demoTopicPriority = (topic: Topic) => {
  const groupName = ((topic as Topic & { groupId?: Group | string }).groupId as Group | undefined)?.name ?? '';
  let priority = 0;

  if (groupName === 'Intellectual Synergy') {
    priority += 3;
  }

  if (topic.title.includes('Ứng dụng AI')) {
    priority += 2;
  }

  if (topic.category === 'Tech') {
    priority += 1;
  }

  return priority;
};

export default function App() {
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem(SESSION_USER_KEY) ?? '');
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.users });
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];
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
        error={usersQuery.isError ? 'Không kết nối được backend. Vui lòng kiểm tra API public.' : undefined}
        onLogin={handleLogin}
      />
    );
  }

  return <Workspace currentUser={currentUser} users={users} onLogout={handleLogout} />;
}

function Workspace({ currentUser, users, onLogout }: { currentUser: User; users: User[]; onLogout: () => void }) {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<ViewKey>('home');
  const [activeTopicId, setActiveTopicId] = useState('');
  const [activeEntryId, setActiveEntryId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftTags, setDraftTags] = useState('ai-critic, workflow');
  const [draftStatus, setDraftStatus] = useState<'Draft' | 'Debating' | 'Final'>('Debating');
  const [messageContent, setMessageContent] = useState('');
  const [critique, setCritique] = useState<string[]>([]);
  const [mutationError, setMutationError] = useState('');

  const groupsQuery = useQuery({ queryKey: ['groups'], queryFn: api.groups });
  const groups = groupsQuery.data ?? [];
  const writableGroup = groups.find((group) => refId(group.leaderId) === currentUser._id) ?? groups[0];
  const topicsQuery = useQuery({
    queryKey: ['topics'],
    queryFn: () => api.topics(),
    enabled: !groupsQuery.isLoading,
  });
  const topics = useMemo(
    () => [...(topicsQuery.data ?? [])].sort((left, right) => demoTopicPriority(right) - demoTopicPriority(left)),
    [topicsQuery.data],
  );
  const activeTopic = topics.find((topic) => topic._id === activeTopicId) ?? topics[0];

  useEffect(() => {
    if (!activeTopicId && activeTopic?._id) {
      setActiveTopicId(activeTopic._id);
    }
  }, [activeTopic?._id, activeTopicId]);

  const entriesQuery = useQuery({
    queryKey: ['entries', activeTopic?._id],
    queryFn: () => api.entries(activeTopic?._id),
    enabled: Boolean(activeTopic?._id),
  });
  const entries = entriesQuery.data ?? [];
  const visibleEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return entries;
    }

    return entries.filter((entry) => {
      const tags = entry.tags?.map((tag) => tag.name).join(' ') ?? '';
      return `${entry.content} ${tags}`.toLowerCase().includes(query);
    });
  }, [entries, searchQuery]);
  const selectedEntry = activeEntryId === NEW_ENTRY_ID ? undefined : visibleEntries.find((entry) => entry._id === activeEntryId);
  const activeEntry = selectedEntry ?? (activeEntryId ? undefined : visibleEntries[0]);

  useEffect(() => {
    if (!activeEntryId && activeEntry?._id) {
      setActiveEntryId(activeEntry._id);
    }
  }, [activeEntry?._id, activeEntryId]);

  useEffect(() => {
    setDraftContent(activeEntry?.content ?? '');
    setDraftTags(activeEntry?.tags?.map((tag) => tag.name).join(', ') || 'ai-critic, workflow');
    setDraftStatus(activeEntry?.status ?? 'Debating');
    setCritique([]);
    setMutationError('');
  }, [activeEntry?._id]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      query: activeEntry?._id ? { entryId: activeEntry._id } : undefined,
    });
    socket.on('message-created', (message?: Message) => {
      if (!message?.content) {
        return;
      }

      const messageUserId = typeof message.userId === 'string' ? message.userId : message.userId?._id;
      if (messageUserId === currentUser._id) {
        return;
      }

      queryClient.setQueryData<Message[]>(['messages', activeEntry?._id], (current) => {
        const messages = current ?? [];
        return messages.some((candidate) => candidate._id === message._id) ? messages : [...messages, message];
      });
    });
    socket.on('topic-overdue', () => queryClient.invalidateQueries({ queryKey: ['topics'] }));
    return () => {
      socket.disconnect();
    };
  }, [activeEntry?._id, currentUser._id, queryClient]);

  const graphQuery = useQuery({
    queryKey: ['graph', activeTopic?._id],
    queryFn: () => api.graph(activeTopic?._id ?? ''),
    enabled: Boolean(activeTopic?._id),
  });
  const graph = useMemo(() => {
    if (graphQuery.data?.nodes?.length) {
      return normalizeGraph(graphQuery.data.nodes, graphQuery.data.edges);
    }

    return buildFallbackGraph(activeTopic?._id, visibleEntries);
  }, [activeTopic?._id, graphQuery.data, visibleEntries]);

  const checklistsQuery = useQuery({
    queryKey: ['checklists', activeTopic?._id],
    queryFn: () => api.checklists(activeTopic?._id ?? ''),
    enabled: Boolean(activeTopic?._id),
  });
  const checklist = checklistsQuery.data?.[0];

  const messagesQuery = useQuery({
    queryKey: ['messages', activeEntry?._id],
    queryFn: () => api.messages(activeEntry?._id ?? ''),
    enabled: Boolean(activeEntry?._id),
  });
  const messages = messagesQuery.data ?? [];

  const saveEntryMutation = useMutation({
    mutationFn: () => {
      if (!activeTopic?._id) {
        throw new Error('Chưa chọn topic để lưu ghi chú.');
      }

      const payload = {
        topicId: activeTopic._id,
        authorId: currentUser._id,
        content: draftContent,
        status: draftStatus,
        tags: draftTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .map((name) => ({ name, isPrivate: name.startsWith('_') })),
        media: [],
      };

      return activeEntry ? api.updateEntry(activeEntry._id, payload) : api.createEntry(payload);
    },
    onSuccess: (entry) => {
      setMutationError('');
      setActiveEntryId(entry._id);
      setActiveView('detail');
      queryClient.setQueryData<Entry[]>(['entries', activeTopic?._id], (current) => {
        const entries = current ?? [];
        return entries.some((candidate) => candidate._id === entry._id)
          ? entries.map((candidate) => (candidate._id === entry._id ? entry : candidate))
          : [entry, ...entries];
      });
      queryClient.invalidateQueries({ queryKey: ['entries', activeTopic?._id] });
      queryClient.invalidateQueries({ queryKey: ['graph', activeTopic?._id] });
    },
    onError: (error) => setMutationError(error instanceof Error ? error.message : 'Không lưu được ghi chú.'),
  });

  const messageMutation = useMutation({
    mutationFn: () => {
      if (!activeEntry?._id) {
        throw new Error('Chưa có ghi chú để gửi thảo luận.');
      }

      return api.createMessage({
        entryId: activeEntry._id,
        userId: currentUser._id,
        content: messageContent,
        type: 'opinion',
      });
    },
    onSuccess: (message) => {
      setMutationError('');
      queryClient.setQueryData<Message[]>(['messages', activeEntry?._id], (current) => [...(current ?? []), message]);
      setMessageContent('');
    },
    onError: (error) => setMutationError(error instanceof Error ? error.message : 'Không gửi được thảo luận.'),
  });

  const checklistMutation = useMutation({
    mutationFn: (item: Checklist['items'][number]) =>
      api.updateChecklistItem(checklist?._id ?? '', item._id, {
        status: itemNextStatus[item.status],
      }),
    onSuccess: (updatedChecklist) => {
      setMutationError('');
      queryClient.setQueryData<Checklist[]>(['checklists', activeTopic?._id], (current) =>
        (current ?? []).map((candidate) => (candidate._id === updatedChecklist._id ? updatedChecklist : candidate)),
      );
      queryClient.invalidateQueries({ queryKey: ['checklists', activeTopic?._id] });
    },
    onError: (error) => setMutationError(error instanceof Error ? error.message : 'Không cập nhật được checklist.'),
  });

  const critiqueMutation = useMutation({
    mutationFn: () => api.critique({ content: activeEntry?.content || draftContent, template: '5W1H' }),
    onSuccess: (data) => {
      setMutationError('');
      setCritique(data.questions);
    },
    onError: (error) => setMutationError(error instanceof Error ? error.message : 'AI Critic chưa phản hồi được.'),
  });

  const transcribeMutation = useMutation({
    mutationFn: (file: File) => api.transcribe(file),
    onSuccess: (data) => {
      setMutationError('');
      setDraftContent((current) => (current.trim() ? `${current.trim()}\n\n${data.text}` : data.text));
    },
    onError: (error) => setMutationError(error instanceof Error ? error.message : 'Không chuyển giọng nói thành văn bản được.'),
  });

  const createChecklistMutation = useMutation({
    mutationFn: () => {
      if (!activeTopic?._id) {
        throw new Error('Chưa chọn topic để tạo checklist.');
      }
      return api.createChecklistTemplate('Google Design Sprint', {
        topicId: activeTopic._id,
        driUserId: currentUser._id,
      });
    },
    onSuccess: (createdChecklist) => {
      setMutationError('');
      queryClient.setQueryData<Checklist[]>(['checklists', activeTopic?._id], (current) => [createdChecklist, ...(current ?? [])]);
      queryClient.invalidateQueries({ queryKey: ['checklists', activeTopic?._id] });
    },
    onError: (error) => setMutationError(error instanceof Error ? error.message : 'Không tạo được checklist.'),
  });

  const createTopicMutation = useMutation({
    mutationFn: (payload: NewTopicPayload) => api.createTopic(payload),
    onSuccess: (topic) => {
      setMutationError('');
      setActiveTopicId(topic._id);
      setActiveEntryId(NEW_ENTRY_ID);
      setDraftContent('');
      setDraftTags('ai-critic, workflow');
      setDraftStatus('Draft');
      setActiveView('compose');
      queryClient.setQueryData<Topic[]>(['topics'], (current) => [topic, ...(current ?? [])]);
      queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
    onError: (error) => setMutationError(error instanceof Error ? error.message : 'Không tạo được topic.'),
  });

  const goTopic = (topic: Topic) => {
    setActiveTopicId(topic._id);
    setActiveEntryId('');
    setActiveView('detail');
  };

  const startNewEntry = () => {
    setActiveEntryId(NEW_ENTRY_ID);
    setDraftContent('');
    setDraftTags('ai-critic, workflow');
    setDraftStatus('Draft');
    setMutationError('');
    setActiveView('compose');
  };

  return (
    <main className="min-h-screen bg-[#05161d] text-[#e7fbf7] md:grid md:place-items-center">
      <section className="relative mx-auto min-h-screen w-full max-w-[430px] bg-[#061b23] pb-24 md:min-h-[880px] md:overflow-hidden md:rounded md:border md:border-white/10 md:shadow-soft">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#061b23]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Intellectual Synergy</p>
              <h1 className="truncate text-lg font-semibold">{activeTopic?.title ?? 'Collaborative Knowledge Diary Hub'}</h1>
            </div>
            <button aria-label="Logout" className="grid h-10 w-10 place-items-center rounded border border-white/10 bg-paper text-ink/75" onClick={onLogout} type="button">
              <LogOut size={17} />
            </button>
          </div>
          <label className="relative mt-3 block">
            <Search className="absolute left-3 top-2.5 text-ink/40" size={16} />
            <input
              className="h-10 w-full rounded border border-white/10 bg-paper pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-moss"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm ghi chú, tag, luận điểm..."
            />
          </label>
        </header>

        <div className="px-4 py-4">
          {mutationError && (
            <p className="mb-4 rounded border border-alert/25 bg-alert/10 px-3 py-2 text-sm leading-6 text-alert">{mutationError}</p>
          )}
          {activeView === 'home' && (
            <DashboardView
              currentUser={currentUser}
              topics={topics}
              entries={visibleEntries}
              activeTopic={activeTopic}
              writableGroup={writableGroup}
              isCreatingTopic={createTopicMutation.isPending}
              onTopicSelect={goTopic}
              onCreateTopic={(payload) => createTopicMutation.mutate(payload)}
              onNewEntry={startNewEntry}
            />
          )}
          {activeView === 'detail' && (
            <DetailView
              activeTopic={activeTopic}
              activeEntry={activeEntry}
              entries={visibleEntries}
              messages={messages}
              messageContent={messageContent}
              setMessageContent={setMessageContent}
              onBack={() => setActiveView('home')}
              onCompose={() => setActiveView('compose')}
              onGraph={() => setActiveView('graph')}
              onSendMessage={() => messageMutation.mutate()}
              isSending={messageMutation.isPending}
              critique={critique}
              onCritique={() => critiqueMutation.mutate()}
              isCritiquing={critiqueMutation.isPending}
            />
          )}
          {activeView === 'compose' && (
            <ComposeView
              topic={activeTopic}
              draftContent={draftContent}
              draftTags={draftTags}
              draftStatus={draftStatus}
              setDraftContent={setDraftContent}
              setDraftTags={setDraftTags}
              setDraftStatus={setDraftStatus}
              onBack={() => setActiveView('detail')}
              onAudioSelected={(file) => transcribeMutation.mutate(file)}
              onSave={() => saveEntryMutation.mutate()}
              isTranscribing={transcribeMutation.isPending}
              isSaving={saveEntryMutation.isPending}
            />
          )}
          {activeView === 'graph' && <GraphView graph={graph} entries={visibleEntries} onBack={() => setActiveView('detail')} />}
          {activeView === 'workflow' && (
            <WorkflowView
              checklist={checklist}
              onCreateChecklist={() => createChecklistMutation.mutate()}
              onToggleItem={(item) => checklistMutation.mutate(item)}
              isCreating={createChecklistMutation.isPending}
              isUpdating={checklistMutation.isPending}
              onBack={() => setActiveView('detail')}
            />
          )}
        </div>

        <BottomNav activeView={activeView} onChange={setActiveView} />
      </section>
    </main>
  );
}

function DashboardView({
  currentUser,
  topics,
  entries,
  activeTopic,
  writableGroup,
  isCreatingTopic,
  onTopicSelect,
  onCreateTopic,
  onNewEntry,
}: {
  currentUser: User;
  topics: Topic[];
  entries: Entry[];
  activeTopic?: Topic;
  writableGroup?: Group;
  isCreatingTopic: boolean;
  onTopicSelect: (topic: Topic) => void;
  onCreateTopic: (payload: NewTopicPayload) => void;
  onNewEntry: () => void;
}) {
  const [isTopicFormOpen, setIsTopicFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Tech');
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10));
  const canCreateTopic = Boolean(writableGroup?._id && refId(writableGroup?.leaderId) === currentUser._id);

  const submitTopic = (event: FormEvent) => {
    event.preventDefault();
    const group = writableGroup;
    if (!group || !canCreateTopic || !title.trim() || isCreatingTopic) {
      return;
    }

    onCreateTopic({
      groupId: group._id,
      leaderId: currentUser._id,
      title: title.trim(),
      description: description.trim(),
      category,
      deadline: new Date(`${deadline}T23:59:00`).toISOString(),
    });
    setTitle('');
    setDescription('');
    setIsTopicFormOpen(false);
  };

  return (
    <div className="space-y-4">
      <section className="rounded border border-white/10 bg-panel p-4">
        <p className="text-sm text-ink/55">Chào buổi sáng, {displayName(currentUser)}</p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight">Chủ đề hôm nay</h2>
        {activeTopic ? (
          <button className="mt-4 w-full rounded border border-moss/70 bg-moss/10 p-4 text-left" onClick={() => onTopicSelect(activeTopic)} type="button">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded bg-moss px-2 py-1 text-xs font-bold text-paper">{activeTopic.category || 'Tech'}</span>
              <span className="rounded bg-paper px-2 py-1 text-xs text-ink/70">{activeTopic.status || 'Open'}</span>
            </div>
            <h3 className="text-xl font-semibold">{activeTopic.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/65">{activeTopic.description}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Metric icon={<FileText size={15} />} label="Ghi chú" value={entries.length.toString()} />
              <Metric icon={<Users size={15} />} label="Nhóm" value="1" />
              <Metric icon={<Clock size={15} />} label="Hạn" value={formatDate(activeTopic.deadline)} />
            </div>
          </button>
        ) : (
          <p className="mt-4 rounded border border-dashed border-white/10 bg-paper p-4 text-sm text-ink/60">Database chưa có topic.</p>
        )}
      </section>

      <section className="rounded border border-white/10 bg-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">Chủ đề đang hoạt động</h2>
            <p className="mt-1 text-xs text-ink/45">{topics.length} chủ đề</p>
          </div>
          <div className="flex gap-2">
            <button
              aria-label="Create topic"
              className="grid h-10 w-10 place-items-center rounded border border-white/10 bg-paper text-ink/70 disabled:opacity-40"
              disabled={!canCreateTopic}
              onClick={() => setIsTopicFormOpen((value) => !value)}
              title={canCreateTopic ? 'Tạo topic' : 'Chỉ trưởng nhóm mới tạo được topic'}
              type="button"
            >
              <Sparkles size={18} />
            </button>
            <button aria-label="Create entry" className="grid h-10 w-10 place-items-center rounded bg-amberline text-paper" onClick={onNewEntry} type="button">
              <Plus size={19} />
            </button>
          </div>
        </div>
        {isTopicFormOpen && (
          <form className="mb-3 grid gap-2 rounded border border-moss/25 bg-moss/5 p-3" onSubmit={submitTopic}>
            <input
              className="h-10 rounded border border-white/10 bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-moss"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tên topic"
              value={title}
            />
            <textarea
              className="min-h-20 resize-none rounded border border-white/10 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-moss"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Mô tả"
              value={description}
            />
            <div className="grid grid-cols-2 gap-2">
              <select className="h-10 rounded border border-white/10 bg-paper px-2 text-sm text-ink outline-none focus:border-moss" onChange={(event) => setCategory(event.target.value)} value={category}>
                <option>Science</option>
                <option>Tech</option>
                <option>Life</option>
                <option>Energy</option>
                <option>Business</option>
                <option>Other</option>
              </select>
              <input className="h-10 rounded border border-white/10 bg-paper px-2 text-sm text-ink outline-none focus:border-moss" onChange={(event) => setDeadline(event.target.value)} type="date" value={deadline} />
            </div>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded bg-moss px-3 text-sm font-semibold text-paper disabled:opacity-45" disabled={!title.trim() || isCreatingTopic} type="submit">
              <Save size={16} />
              Lưu topic
            </button>
          </form>
        )}
        <div className="grid gap-3">
          {topics.map((topic) => (
            <button className="rounded border border-white/10 bg-paper p-3 text-left hover:border-moss" key={topic._id} onClick={() => onTopicSelect(topic)} type="button">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{topic.title}</h3>
                <CheckCircle2 className="text-moss" size={17} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/60">{topic.description}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function DetailView({
  activeTopic,
  activeEntry,
  entries,
  messages,
  messageContent,
  setMessageContent,
  onBack,
  onCompose,
  onGraph,
  onSendMessage,
  isSending,
  critique,
  onCritique,
  isCritiquing,
}: {
  activeTopic?: Topic;
  activeEntry?: Entry;
  entries: Entry[];
  messages: Message[];
  messageContent: string;
  setMessageContent: (value: string) => void;
  onBack: () => void;
  onCompose: () => void;
  onGraph: () => void;
  onSendMessage: () => void;
  isSending: boolean;
  critique: string[];
  onCritique: () => void;
  isCritiquing: boolean;
}) {
  return (
    <div className="space-y-4">
      <ViewTitle icon={<ArrowLeft size={18} />} title={activeTopic?.title ?? 'Chi tiết'} onClick={onBack} />
      <section className="rounded border border-white/10 bg-panel p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded bg-moss/15 px-2 py-1 text-xs font-semibold text-moss">{activeTopic?.category ?? 'Tech'}</span>
          <span className="rounded bg-paper px-2 py-1 text-xs text-ink/70">{activeTopic?.status ?? 'Open'}</span>
        </div>
        <h2 className="text-2xl font-semibold leading-tight">{activeTopic?.title}</h2>
        <p className="mt-3 text-sm leading-6 text-ink/65">{activeTopic?.description}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric icon={<FileText size={15} />} label="Entries" value={entries.length.toString()} />
          <Metric icon={<GitBranch size={15} />} label="Debating" value={entries.filter((entry) => entry.status === 'Debating').length.toString()} />
          <Metric icon={<Clock size={15} />} label="Deadline" value={formatDate(activeTopic?.deadline)} />
        </div>
      </section>

      <section className="rounded border border-white/10 bg-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">Luận điểm chính</h2>
          <button className="grid h-10 w-10 place-items-center rounded bg-amberline text-paper" onClick={onCompose} type="button">
            <Edit3 size={18} />
          </button>
        </div>
        {activeEntry ? (
          <article className="rounded border border-amberline/60 bg-amberline/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <FileText size={17} className="text-moss" />
              <span className="font-semibold">{activeEntry.status}</span>
            </div>
            <p className="text-sm leading-6 text-ink/80">{activeEntry.content}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeEntry.tags?.map((tag) => (
                <span className="rounded bg-paper px-2 py-1 text-xs text-ink/65" key={tag.name}>
                  {tag.name}
                </span>
              ))}
            </div>
          </article>
        ) : (
          <p className="rounded border border-dashed border-white/10 bg-paper p-4 text-sm text-ink/60">Chưa có entry.</p>
        )}
      </section>

      <section className="rounded border border-white/10 bg-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">Tác động</h2>
            <p className="text-xs text-ink/45">AI phản biện và thảo luận</p>
          </div>
          <button className="inline-flex h-9 items-center gap-2 rounded bg-moss px-3 text-sm font-semibold text-paper disabled:opacity-45" disabled={!activeEntry || isCritiquing} onClick={onCritique} type="button">
            <Bot size={16} />
            AI
          </button>
        </div>
        <div className="space-y-2">
          {(critique.length ? critique : ['AI sẽ đặt câu hỏi 5W1H để nhóm kiểm tra giả định và rủi ro.']).map((item) => (
            <p className="rounded bg-paper px-3 py-2 text-sm leading-6 text-ink/70" key={item}>
              {item}
            </p>
          ))}
        </div>
        <button className="mt-3 inline-flex h-9 items-center gap-2 rounded border border-white/10 bg-paper px-3 text-sm text-ink/75" onClick={onGraph} type="button">
          <Network size={16} />
          Sơ đồ tri thức
        </button>
      </section>

      <section className="rounded border border-white/10 bg-panel p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-moss">Thảo luận</h2>
        <div className="max-h-52 space-y-2 overflow-auto">
          {messages.map((message) => (
            <div className="rounded bg-paper px-3 py-2" key={message._id}>
              <div className="mb-1 flex justify-between gap-2 text-xs text-ink/45">
                <span>{displayName(message.userId)}</span>
                <span>{new Date(message.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-sm leading-6 text-ink/80">{message.content}</p>
            </div>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (messageContent.trim()) {
              onSendMessage();
            }
          }}
        >
          <input className="h-10 min-w-0 flex-1 rounded border border-white/10 bg-paper px-3 text-sm text-ink outline-none focus:border-moss" value={messageContent} onChange={(event) => setMessageContent(event.target.value)} placeholder="Ý kiến của bạn" />
          <button aria-label="Send opinion" className="grid h-10 w-10 place-items-center rounded bg-moss text-paper disabled:opacity-40" disabled={!messageContent.trim() || isSending} type="submit">
            <Send size={16} />
          </button>
        </form>
      </section>
    </div>
  );
}

function ComposeView({
  topic,
  draftContent,
  draftTags,
  draftStatus,
  setDraftContent,
  setDraftTags,
  setDraftStatus,
  onBack,
  onAudioSelected,
  onSave,
  isTranscribing,
  isSaving,
}: {
  topic?: Topic;
  draftContent: string;
  draftTags: string;
  draftStatus: 'Draft' | 'Debating' | 'Final';
  setDraftContent: (value: string) => void;
  setDraftTags: (value: string) => void;
  setDraftStatus: (value: 'Draft' | 'Debating' | 'Final') => void;
  onBack: () => void;
  onAudioSelected: (file: File) => void;
  onSave: () => void;
  isTranscribing: boolean;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4">
      <ViewTitle icon={<ArrowLeft size={18} />} title="Soạn thảo" onClick={onBack} />
      <section className="rounded border border-white/10 bg-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Topic</p>
        <h2 className="mt-2 text-xl font-semibold">{topic?.title}</h2>
      </section>
      <textarea className="min-h-72 w-full resize-none rounded border border-white/10 bg-panel p-4 text-base leading-7 text-ink outline-none placeholder:text-ink/35 focus:border-moss" value={draftContent} onChange={(event) => setDraftContent(event.target.value)} placeholder="Ghi lại luận điểm, phản biện hoặc transcript..." />
      <label className="relative block">
        <Tags className="absolute left-3 top-3 text-ink/40" size={16} />
        <input className="h-11 w-full rounded border border-white/10 bg-panel pl-9 pr-3 text-sm text-ink outline-none focus:border-moss" value={draftTags} onChange={(event) => setDraftTags(event.target.value)} placeholder="tags" />
      </label>
      <select className="h-11 w-full rounded border border-white/10 bg-panel px-3 text-sm text-ink outline-none focus:border-moss" value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as 'Draft' | 'Debating' | 'Final')}>
        <option>Draft</option>
        <option>Debating</option>
        <option>Final</option>
      </select>
      <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded border border-white/10 bg-panel text-sm font-semibold text-ink/75">
        <Upload size={17} />
        {isTranscribing ? 'Đang chuyển giọng nói...' : 'Upload audio'}
        <input
          accept="audio/*"
          className="hidden"
          disabled={isTranscribing}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              onAudioSelected(file);
            }
          }}
          type="file"
        />
      </label>
      <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded bg-moss text-base font-semibold text-paper disabled:opacity-40" disabled={!draftContent.trim() || isSaving} onClick={onSave} type="button">
        <Save size={18} />
        Lưu ghi chú
      </button>
    </div>
  );
}

function GraphView({ graph, entries, onBack }: { graph: { nodes: any[]; edges: any[] }; entries: Entry[]; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <ViewTitle icon={<ArrowLeft size={18} />} title="Sơ đồ tri thức" onClick={onBack} />
      <section className="rounded border border-white/10 bg-panel p-4">
        <div className="h-80 overflow-hidden rounded border border-white/10 bg-paper">
          <ReactFlow nodes={graph.nodes} edges={graph.edges} fitView>
            <Background color="rgba(231,251,247,0.16)" gap={18} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </section>
      <section className="rounded border border-white/10 bg-panel p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-moss">Liên kết</h2>
        <div className="space-y-2">
          {entries.map((entry) => (
            <p className="rounded bg-paper p-3 text-sm leading-6 text-ink/70" key={entry._id}>
              {entry.content}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

function WorkflowView({
  checklist,
  onCreateChecklist,
  onToggleItem,
  isCreating,
  isUpdating,
  onBack,
}: {
  checklist?: Checklist;
  onCreateChecklist: () => void;
  onToggleItem: (item: Checklist['items'][number]) => void;
  isCreating: boolean;
  isUpdating: boolean;
  onBack: () => void;
}) {
  const done = checklist?.items.filter((item) => item.status === 'Done').length ?? 0;
  const total = checklist?.items.length ?? 0;
  return (
    <div className="space-y-4">
      <ViewTitle icon={<ArrowLeft size={18} />} title="Quản lý Quy trình & Checklist" onClick={onBack} />
      <section className="rounded border border-white/10 bg-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Tiến độ</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric icon={<CheckSquare size={15} />} label="Done" value={`${done}/${total}`} />
          <Metric icon={<Clock size={15} />} label="Review" value={(checklist?.items.filter((item) => item.status === 'Review').length ?? 0).toString()} />
          <Metric icon={<Users size={15} />} label="DRI" value="1" />
        </div>
      </section>
      <section className="rounded border border-white/10 bg-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">Checklist</h2>
          <span className="rounded bg-paper px-2 py-1 text-xs text-ink/70">{checklist?.template ?? 'Custom'}</span>
        </div>
        <div className="space-y-2">
          {checklist ? (
            checklist.items.map((item) => (
              <button className="w-full rounded border border-white/10 bg-paper p-3 text-left disabled:opacity-60" disabled={isUpdating} key={item._id} onClick={() => onToggleItem(item)} type="button">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{item.title}</span>
                  <span className="rounded bg-panel px-2 py-1 text-xs text-ink/70">{item.status}</span>
                </div>
                <p className="mt-1 text-xs text-ink/45">{item.phase ? `${item.phase} · ` : ''}DRI</p>
              </button>
            ))
          ) : (
            <div className="rounded border border-dashed border-white/10 bg-paper p-4">
              <p className="text-sm text-ink/60">Chưa có checklist.</p>
              <button className="mt-3 inline-flex h-10 items-center gap-2 rounded bg-moss px-3 text-sm font-semibold text-paper disabled:opacity-45" disabled={isCreating} onClick={onCreateChecklist} type="button">
                <Plus size={16} />
                Tạo checklist
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ViewTitle({ icon, title, onClick }: { icon: ReactNode; title: string; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button className="grid h-10 w-10 place-items-center rounded border border-white/10 bg-panel text-ink" onClick={onClick} type="button">
        {icon}
      </button>
      <h2 className="min-w-0 flex-1 text-xl font-semibold leading-tight">{title}</h2>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-paper px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-ink/45">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function BottomNav({ activeView, onChange }: { activeView: ViewKey; onChange: (view: ViewKey) => void }) {
  const items: { key: ViewKey; label: string; icon: ReactNode }[] = [
    { key: 'home', label: 'Home', icon: <Home size={17} /> },
    { key: 'compose', label: 'Soạn', icon: <Edit3 size={17} /> },
    { key: 'graph', label: 'Graph', icon: <Network size={17} /> },
    { key: 'workflow', label: 'Việc', icon: <CheckSquare size={17} /> },
  ];

  return (
    <nav className="absolute inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-panel/95 px-2 py-2 backdrop-blur">
      {items.map((item) => (
        <button className={`flex h-12 flex-col items-center justify-center gap-1 rounded text-xs font-semibold ${activeView === item.key ? 'text-moss' : 'text-ink/55'}`} key={item.key} onClick={() => onChange(item.key)} type="button">
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('vi-VN');
}
