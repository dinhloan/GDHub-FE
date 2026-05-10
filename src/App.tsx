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
  ImagePlus,
  LogOut,
  MessageCircle,
  Network,
  Plus,
  Save,
  Search,
  Send,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { io } from 'socket.io-client';
import { api } from './api/client';
import { LoginScreen } from './components/LoginScreen';
import { MainLayout } from './components/MainLayout';
import { StitchMarkdown } from './components/StitchMarkdown';
import { VoiceNoteButton } from './components/VoiceNoteButton';
import { useDiaryDetail } from './hooks/useDiaryDetail';
import { StitchDiary, useStitchDiary } from './hooks/useStitchDiary';
import { buildFallbackGraph, normalizeGraph } from './lib/graph';
import { Checklist, ChecklistStatus, Entry, Group, Message, Topic, User } from './types';

type ViewKey = 'home' | 'detail' | 'compose' | 'graph' | 'workflow' | 'search' | 'workspace';
type CritiqueTemplate = '5W1H' | '6 Thinking Hats';
type ChecklistTemplate = 'Apple DRI' | 'Google Design Sprint';
type EntryMedia = { type: string; url: string };
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
const SESSION_EMAIL_KEY = 'gdhub.currentUserEmail';
const NEW_ENTRY_ID = '__new-entry__';
const DEFAULT_LOGIN_EMAIL = 'dinhloan.al@gmail.com';

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

const isTopicOverdue = (topic: Topic) => topic.status === 'Overdue' || (topic.deadline ? new Date(topic.deadline).getTime() < Date.now() : false);

const shortText = (value: string, limit = 140) => (value.length > limit ? `${value.slice(0, limit).trim()}...` : value);

export default function App() {
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem(SESSION_USER_KEY) ?? '');
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: api.users });
  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];
  const currentUser = users.find((user) => user._id === currentUserId);

  useEffect(() => {
    if (usersQuery.isLoading || !users.length) {
      return;
    }

    if (currentUserId && currentUser) {
      return;
    }

    const storedEmail = localStorage.getItem(SESSION_EMAIL_KEY)?.trim().toLowerCase();
    const recoveredUser = storedEmail ? users.find((user) => user.email?.trim().toLowerCase() === storedEmail) : undefined;
    if (recoveredUser) {
      localStorage.setItem(SESSION_USER_KEY, recoveredUser._id);
      setCurrentUserId(recoveredUser._id);
      return;
    }

    if (currentUserId) {
      localStorage.removeItem(SESSION_USER_KEY);
      setCurrentUserId('');
    }
  }, [currentUser, currentUserId, users, usersQuery.isLoading]);

  const handleLogin = (user: User) => {
    localStorage.setItem(SESSION_USER_KEY, user._id);
    localStorage.setItem(SESSION_EMAIL_KEY, user.email);
    setCurrentUserId(user._id);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_EMAIL_KEY);
    setCurrentUserId('');
  };

  if (!currentUser) {
    return (
      <LoginScreen
        users={users}
        isLoading={usersQuery.isLoading}
        error={usersQuery.isError ? 'Không kết nối được backend. Vui lòng kiểm tra API public.' : undefined}
        preferredEmail={DEFAULT_LOGIN_EMAIL}
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
  const [draftMedia, setDraftMedia] = useState<EntryMedia[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [critique, setCritique] = useState<string[]>([]);
  const [critiqueTemplate, setCritiqueTemplate] = useState<CritiqueTemplate>('5W1H');
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
  const stitchDiary = useStitchDiary({ topicId: activeTopic?._id, enabled: Boolean(activeTopic?._id) });

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
  const semanticSearchQuery = useQuery({
    queryKey: ['entries-search', activeTopic?._id, searchQuery.trim()],
    queryFn: () => api.searchEntries(searchQuery.trim(), activeTopic?._id),
    enabled: Boolean(activeTopic?._id && searchQuery.trim().length >= 2),
  });
  const selectedEntry = activeEntryId === NEW_ENTRY_ID ? undefined : visibleEntries.find((entry) => entry._id === activeEntryId);
  const activeEntrySummary = selectedEntry ?? (activeEntryId ? undefined : visibleEntries[0]);
  const activeEntryDetailQuery = useDiaryDetail(activeEntrySummary?._id, { enabled: activeEntryId !== NEW_ENTRY_ID });
  const activeEntry = activeEntryDetailQuery.data ?? activeEntrySummary;

  useEffect(() => {
    if (!activeEntryId && activeEntry?._id) {
      setActiveEntryId(activeEntry._id);
    }
  }, [activeEntry?._id, activeEntryId]);

  useEffect(() => {
    setDraftContent(activeEntry?.content ?? '');
    setDraftTags(activeEntry?.tags?.map((tag) => tag.name).join(', ') || 'ai-critic, workflow');
    setDraftStatus(activeEntry?.status ?? 'Debating');
    setDraftMedia(activeEntry?.media ?? []);
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
  const checklists = checklistsQuery.data ?? [];

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
        media: draftMedia,
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
    mutationFn: ({ checklistId, item }: { checklistId: string; item: Checklist['items'][number] }) =>
      api.updateChecklistItem(checklistId, item._id, {
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
    mutationFn: () => api.critique({ content: activeEntry?.content || draftContent, template: critiqueTemplate }),
    onSuccess: (data) => {
      setMutationError('');
      setCritique(data.questions);
    },
    onError: (error) => setMutationError(error instanceof Error ? error.message : 'AI Critic chưa phản hồi được.'),
  });

  const imageUploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadEntryImage(file),
    onSuccess: (media) => {
      setMutationError('');
      setDraftMedia((current) => [...current, media]);
    },
    onError: (error) => setMutationError(error instanceof Error ? error.message : 'Không upload được hình ảnh.'),
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
    mutationFn: (template: ChecklistTemplate) => {
      if (!activeTopic?._id) {
        throw new Error('Chưa chọn topic để tạo checklist.');
      }
      return api.createChecklistTemplate(template, {
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
      setDraftMedia([]);
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
    setDraftMedia([]);
    setMutationError('');
    setActiveView('compose');
  };

  return (
    <main className="min-h-screen bg-canvas text-primary md:grid md:place-items-center">
      <section className="relative mx-auto min-h-screen w-full max-w-shell bg-app-shell pb-24 md:min-h-shell md:max-w-workspace md:overflow-hidden md:rounded-stitch md:border md:border-outline md:shadow-soft">
        <header className="sticky top-0 z-30 border-b border-outline bg-app-shell/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Intellectual Synergy</p>
              <h1 className="truncate text-lg font-semibold">{activeTopic?.title ?? 'Collaborative Knowledge Diary Hub'}</h1>
            </div>
            <button aria-label="Logout" className="grid h-10 w-10 place-items-center rounded-stitch border border-outline bg-surface text-primary/75" onClick={onLogout} type="button">
              <LogOut size={17} />
            </button>
          </div>
          <label className="relative mt-3 block">
            <Search className="absolute left-3 top-2.5 text-primary/40" size={16} />
            <input
              className="h-10 w-full rounded-stitch border border-outline bg-surface pl-9 pr-3 text-sm text-primary outline-none placeholder:text-primary/35 focus:border-accent"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm ghi chú, tag, luận điểm..."
            />
          </label>
        </header>

        <div className="px-4 py-4">
          {mutationError && (
            <p className="mb-4 rounded-stitch border border-danger/25 bg-danger/10 px-3 py-2 text-sm leading-6 text-danger">{mutationError}</p>
          )}
          {activeView === 'home' && (
            <DashboardView
              currentUser={currentUser}
              topics={topics}
              entries={visibleEntries}
              activeTopic={activeTopic}
              writableGroup={writableGroup}
              groups={groups}
              users={users}
              checklists={checklists}
              diary={stitchDiary}
              isCreatingTopic={createTopicMutation.isPending}
              onTopicSelect={goTopic}
              onCreateTopic={(payload) => createTopicMutation.mutate(payload)}
              onNewEntry={startNewEntry}
              onSearch={() => setActiveView('search')}
              onWorkspace={() => setActiveView('workspace')}
            />
          )}
          {activeView === 'detail' && (
            <DetailView
              activeTopic={activeTopic}
              activeEntry={activeEntry}
              activeEntryIsLoading={activeEntryDetailQuery.isLoading}
              activeEntryIsError={activeEntryDetailQuery.isError}
              activeEntryError={activeEntryDetailQuery.error}
              entries={visibleEntries}
              activeEntryId={activeEntry?._id}
              messages={messages}
              messageContent={messageContent}
              critiqueTemplate={critiqueTemplate}
              setCritiqueTemplate={setCritiqueTemplate}
              setMessageContent={setMessageContent}
              onBack={() => setActiveView('home')}
              onCompose={() => setActiveView('compose')}
              onSelectEntry={setActiveEntryId}
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
              draftMedia={draftMedia}
              setDraftContent={setDraftContent}
              setDraftTags={setDraftTags}
              setDraftStatus={setDraftStatus}
              setDraftMedia={setDraftMedia}
              onBack={() => setActiveView('detail')}
              onTranscript={(text) => setDraftContent((current) => (current.trim() ? `${current.trim()}\n\n${text}` : text))}
              onAudioSelected={(file) => transcribeMutation.mutate(file)}
              onImageSelected={(file) => imageUploadMutation.mutate(file)}
              onSave={() => saveEntryMutation.mutate()}
              isTranscribing={transcribeMutation.isPending}
              isUploadingImage={imageUploadMutation.isPending}
              isSaving={saveEntryMutation.isPending}
            />
          )}
          {activeView === 'graph' && <GraphView graph={graph} entries={visibleEntries} onBack={() => setActiveView('detail')} />}
          {activeView === 'workflow' && (
            <WorkflowView
              checklists={checklists}
              users={users}
              onCreateChecklist={(template) => createChecklistMutation.mutate(template)}
              onToggleItem={(checklistId, item) => checklistMutation.mutate({ checklistId, item })}
              isCreating={createChecklistMutation.isPending}
              isUpdating={checklistMutation.isPending}
              onBack={() => setActiveView('detail')}
            />
          )}
          {activeView === 'search' && (
            <SearchView
              query={searchQuery}
              setQuery={setSearchQuery}
              results={semanticSearchQuery.data ?? visibleEntries}
              isLoading={semanticSearchQuery.isFetching}
              onBack={() => setActiveView('home')}
              onSelectEntry={(entry) => {
                setActiveTopicId(refId(entry.topicId));
                setActiveEntryId(entry._id);
                setActiveView('detail');
              }}
            />
          )}
          {activeView === 'workspace' && (
            <WorkspaceView
              currentUser={currentUser}
              users={users}
              groups={groups}
              topics={topics}
              onBack={() => setActiveView('home')}
              onTopicSelect={goTopic}
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
  groups,
  users,
  checklists,
  diary,
  isCreatingTopic,
  onTopicSelect,
  onCreateTopic,
  onNewEntry,
  onSearch,
  onWorkspace,
}: {
  currentUser: User;
  topics: Topic[];
  entries: Entry[];
  activeTopic?: Topic;
  writableGroup?: Group;
  groups: Group[];
  users: User[];
  checklists: Checklist[];
  diary: StitchDiary;
  isCreatingTopic: boolean;
  onTopicSelect: (topic: Topic) => void;
  onCreateTopic: (payload: NewTopicPayload) => void;
  onNewEntry: () => void;
  onSearch: () => void;
  onWorkspace: () => void;
}) {
  const [isTopicFormOpen, setIsTopicFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Tech');
  const [deadline, setDeadline] = useState(() => new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10));
  const canCreateTopic = Boolean(writableGroup?._id && refId(writableGroup?.leaderId) === currentUser._id);
  const overdueCount = topics.filter(isTopicOverdue).length;
  const doneItems = checklists.flatMap((checklist) => checklist.items).filter((item) => item.status === 'Done').length;

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
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <p className="text-sm text-primary/55">Chào buổi sáng, {displayName(currentUser)}</p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight">Chủ đề hôm nay</h2>
        {activeTopic ? (
          <button className="mt-4 w-full rounded-stitch border border-accent/70 bg-accent/10 p-4 text-left" onClick={() => onTopicSelect(activeTopic)} type="button">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-stitch bg-accent px-2 py-1 text-xs font-bold text-on-accent">{activeTopic.category || 'Tech'}</span>
              <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/70">{activeTopic.status || 'Open'}</span>
            </div>
            <h3 className="text-xl font-semibold">{activeTopic.title}</h3>
            <p className="mt-2 text-sm leading-6 text-primary/65">{activeTopic.description}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Metric icon={<FileText size={15} />} label="Ghi chú" value={entries.length.toString()} />
              <Metric icon={<Users size={15} />} label="Nhóm" value="1" />
              <Metric icon={<Clock size={15} />} label="Hạn" value={formatDate(activeTopic.deadline)} />
            </div>
          </button>
        ) : (
          <p className="mt-4 rounded-stitch border border-dashed border-outline bg-surface p-4 text-sm text-primary/60">Database chưa có topic.</p>
        )}
      </section>

      {diary.content ? (
        <MainLayout sidebar={<ReadmeSidebar activeTopic={activeTopic} diary={diary} topics={topics} />}>
          <StitchMarkdown {...diary.markdownProps} />
        </MainLayout>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <button className="rounded-stitch border border-outline bg-surface-tonal p-3 text-left" onClick={onSearch} type="button">
          <Search className="mb-3 text-accent" size={18} />
          <p className="text-sm font-semibold">Semantic Search</p>
          <p className="mt-1 text-xs leading-5 text-primary/55">Tìm entry theo nội dung, tag và điểm tương đồng.</p>
        </button>
        <button className="rounded-stitch border border-outline bg-surface-tonal p-3 text-left" onClick={onWorkspace} type="button">
          <Users className="mb-3 text-accent" size={18} />
          <p className="text-sm font-semibold">Group & Timeline</p>
          <p className="mt-1 text-xs leading-5 text-primary/55">{groups.length} nhóm, {users.length} thành viên, {overdueCount} quá hạn.</p>
        </button>
        <button className="rounded-stitch border border-outline bg-surface-tonal p-3 text-left" onClick={onNewEntry} type="button">
          <Upload className="mb-3 text-accent" size={18} />
          <p className="text-sm font-semibold">Multimedia Note</p>
          <p className="mt-1 text-xs leading-5 text-primary/55">Ghi âm, upload audio, ảnh và lưu vào DB.</p>
        </button>
        <button className="rounded-stitch border border-outline bg-surface-tonal p-3 text-left" onClick={() => activeTopic && onTopicSelect(activeTopic)} type="button">
          <CheckSquare className="mb-3 text-accent" size={18} />
          <p className="text-sm font-semibold">AI & Workflow</p>
          <p className="mt-1 text-xs leading-5 text-primary/55">{doneItems} việc đã Done trong checklist hiện tại.</p>
        </button>
      </section>

      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Chủ đề đang hoạt động</h2>
            <p className="mt-1 text-xs text-primary/45">{topics.length} chủ đề</p>
          </div>
          <div className="flex gap-2">
            <button
              aria-label="Create topic"
              className="grid h-10 w-10 place-items-center rounded-stitch border border-outline bg-surface text-primary/70 disabled:opacity-40"
              disabled={!canCreateTopic}
              onClick={() => setIsTopicFormOpen((value) => !value)}
              title={canCreateTopic ? 'Tạo topic' : 'Chỉ trưởng nhóm mới tạo được topic'}
              type="button"
            >
              <Sparkles size={18} />
            </button>
            <button aria-label="Create entry" className="grid h-10 w-10 place-items-center rounded-stitch bg-attention text-on-accent" onClick={onNewEntry} type="button">
              <Plus size={19} />
            </button>
          </div>
        </div>
        {isTopicFormOpen && (
          <form className="mb-3 grid gap-2 rounded-stitch border border-accent/25 bg-accent/5 p-3" onSubmit={submitTopic}>
            <input
              className="h-10 rounded-stitch border border-outline bg-surface px-3 text-sm text-primary outline-none placeholder:text-primary/35 focus:border-accent"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tên topic"
              value={title}
            />
            <textarea
              className="min-h-20 resize-none rounded-stitch border border-outline bg-surface px-3 py-2 text-sm text-primary outline-none placeholder:text-primary/35 focus:border-accent"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Mô tả"
              value={description}
            />
            <div className="grid grid-cols-2 gap-2">
              <select className="h-10 rounded-stitch border border-outline bg-surface px-2 text-sm text-primary outline-none focus:border-accent" onChange={(event) => setCategory(event.target.value)} value={category}>
                <option>Science</option>
                <option>Tech</option>
                <option>Life</option>
                <option>Energy</option>
                <option>Business</option>
                <option>Other</option>
              </select>
              <input className="h-10 rounded-stitch border border-outline bg-surface px-2 text-sm text-primary outline-none focus:border-accent" onChange={(event) => setDeadline(event.target.value)} type="date" value={deadline} />
            </div>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-stitch bg-accent px-3 text-sm font-semibold text-on-accent disabled:opacity-45" disabled={!title.trim() || isCreatingTopic} type="submit">
              <Save size={16} />
              Lưu topic
            </button>
          </form>
        )}
        <div className="grid gap-3">
          {topics.map((topic) => (
            <button className="rounded-stitch border border-outline bg-surface p-3 text-left hover:border-accent" key={topic._id} onClick={() => onTopicSelect(topic)} type="button">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{topic.title}</h3>
                <CheckCircle2 className="text-accent" size={17} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-primary/60">{topic.description}</p>
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
  activeEntryIsLoading,
  activeEntryIsError,
  activeEntryError,
  activeEntryId,
  entries,
  messages,
  messageContent,
  critiqueTemplate,
  setCritiqueTemplate,
  setMessageContent,
  onBack,
  onCompose,
  onSelectEntry,
  onGraph,
  onSendMessage,
  isSending,
  critique,
  onCritique,
  isCritiquing,
}: {
  activeTopic?: Topic;
  activeEntry?: Entry;
  activeEntryIsLoading: boolean;
  activeEntryIsError: boolean;
  activeEntryError: unknown;
  activeEntryId?: string;
  entries: Entry[];
  messages: Message[];
  messageContent: string;
  critiqueTemplate: CritiqueTemplate;
  setCritiqueTemplate: (value: CritiqueTemplate) => void;
  setMessageContent: (value: string) => void;
  onBack: () => void;
  onCompose: () => void;
  onSelectEntry: (entryId: string) => void;
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
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-stitch bg-accent/15 px-2 py-1 text-xs font-semibold text-accent">{activeTopic?.category ?? 'Tech'}</span>
          <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/70">{activeTopic?.status ?? 'Open'}</span>
        </div>
        <h2 className="text-2xl font-semibold leading-tight">{activeTopic?.title}</h2>
        <p className="mt-3 text-sm leading-6 text-primary/65">{activeTopic?.description}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric icon={<FileText size={15} />} label="Entries" value={entries.length.toString()} />
          <Metric icon={<GitBranch size={15} />} label="Debating" value={entries.filter((entry) => entry.status === 'Debating').length.toString()} />
          <Metric icon={<Clock size={15} />} label="Deadline" value={formatDate(activeTopic?.deadline)} />
        </div>
      </section>

      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Luận điểm chính</h2>
          <button className="grid h-10 w-10 place-items-center rounded-stitch bg-attention text-on-accent" onClick={onCompose} type="button">
            <Edit3 size={18} />
          </button>
        </div>
        {activeEntryIsLoading ? (
          <StitchDiaryDetailSkeleton />
        ) : activeEntryIsError ? (
          <StitchDiaryDetailError error={activeEntryError} />
        ) : activeEntry ? (
          <article className="rounded-stitch border border-attention/60 bg-attention/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <FileText size={17} className="text-accent" />
              <span className="font-semibold">{activeEntry.status}</span>
            </div>
            <p className="text-sm leading-6 text-primary/80">{activeEntry.content}</p>
            {activeEntry.media?.length ? (
              <div className="mt-3 grid gap-2">
                {activeEntry.media.map((media) => (
                  <a className="rounded-stitch border border-outline bg-surface px-3 py-2 text-xs text-primary/70" href={media.url} key={media.url} target="_blank" rel="noreferrer">
                    {media.type}: {media.url}
                  </a>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {activeEntry.tags?.map((tag) => (
                <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/65" key={tag.name}>
                  {tag.name}
                </span>
              ))}
            </div>
          </article>
        ) : (
          <p className="rounded-stitch border border-dashed border-outline bg-surface p-4 text-sm text-primary/60">Chưa có entry.</p>
        )}
        <div className="mt-3 grid gap-2">
          {entries.map((entry) => (
            <button
              className={`rounded-stitch border p-3 text-left text-sm ${
                entry._id === activeEntryId ? 'border-accent bg-accent/10 text-primary' : 'border-outline bg-surface text-primary/65'
              }`}
              key={entry._id}
              onClick={() => onSelectEntry(entry._id)}
              type="button"
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="font-semibold">{entry.status}</span>
                <span className="text-xs text-primary/45">{entry.tags?.map((tag) => tag.name).slice(0, 2).join(', ')}</span>
              </div>
              <p className="line-clamp-2 leading-6">{shortText(entry.content, 120)}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Tác động</h2>
            <p className="text-xs text-primary/45">AI phản biện và thảo luận</p>
          </div>
          <select
            className="h-9 rounded-stitch border border-outline bg-surface px-2 text-xs text-primary outline-none focus:border-accent"
            value={critiqueTemplate}
            onChange={(event) => setCritiqueTemplate(event.target.value as CritiqueTemplate)}
          >
            <option>5W1H</option>
            <option>6 Thinking Hats</option>
          </select>
          <button className="inline-flex h-9 items-center gap-2 rounded-stitch bg-accent px-3 text-sm font-semibold text-on-accent disabled:opacity-45" disabled={!activeEntry || isCritiquing} onClick={onCritique} type="button">
            <Bot size={16} />
            AI
          </button>
        </div>
        <div className="space-y-2">
          {(critique.length ? critique : ['AI sẽ đặt câu hỏi 5W1H để nhóm kiểm tra giả định và rủi ro.']).map((item) => (
            <p className="rounded-stitch bg-surface px-3 py-2 text-sm leading-6 text-primary/70" key={item}>
              {item}
            </p>
          ))}
        </div>
        <button className="mt-3 inline-flex h-9 items-center gap-2 rounded-stitch border border-outline bg-surface px-3 text-sm text-primary/75" onClick={onGraph} type="button">
          <Network size={16} />
          Sơ đồ tri thức
        </button>
      </section>

      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Thảo luận</h2>
        <div className="max-h-52 space-y-2 overflow-auto">
          {messages.map((message) => (
            <div className="rounded-stitch bg-surface px-3 py-2" key={message._id}>
              <div className="mb-1 flex justify-between gap-2 text-xs text-primary/45">
                <span>{displayName(message.userId)}</span>
                <span>{new Date(message.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="text-sm leading-6 text-primary/80">{message.content}</p>
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
          <input className="h-10 min-w-0 flex-1 rounded-stitch border border-outline bg-surface px-3 text-sm text-primary outline-none focus:border-accent" value={messageContent} onChange={(event) => setMessageContent(event.target.value)} placeholder="Ý kiến của bạn" />
          <button aria-label="Send opinion" className="grid h-10 w-10 place-items-center rounded-stitch bg-accent text-on-accent disabled:opacity-40" disabled={!messageContent.trim() || isSending} type="submit">
            <Send size={16} />
          </button>
        </form>
      </section>
    </div>
  );
}

function ReadmeSidebar({ activeTopic, diary, topics }: { activeTopic?: Topic; diary: StitchDiary; topics: Topic[] }) {
  const timelineTopics = topics.slice(0, 3);
  const { metadata } = diary;
  const critic = diary.entries.find((entry) => entry.aiCritic?.questions?.length)?.aiCritic;

  return (
    <>
      <section className="rounded-stitch border border-outline bg-surface/70 p-3">
        <div className="mb-3 flex items-center gap-2">
          <Bot className="text-accent" size={16} />
          <h2 className="text-xs font-semibold uppercase tracking-section text-accent">AI Suggestions</h2>
        </div>
        <div className="space-y-2">
          <p className="text-sm leading-6 text-primary/75">Template đề xuất: {metadata.template}</p>
          <p className="text-xs leading-5 text-primary/55">Ưu tiên render theo layout {metadata.layout} và theme {metadata.theme} từ Stitch metadata.</p>
          {metadata.sourceEntryId ? <p className="text-xs leading-5 text-primary/50">Nguồn: entry {metadata.sourceEntryId}</p> : null}
          {critic?.questions?.length ? (
            <div className="space-y-2 rounded-stitch border border-accent/25 bg-accent/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-eyebrow text-accent">AI Critic Agent</p>
              {critic.questions.map((question, index) => (
                <p className="text-xs leading-5 text-primary/70" key={`${question}-${index}`}>
                  {index + 1}. {question}
                </p>
              ))}
              <p className="text-xs text-primary/45">{critic.source}{critic.model ? ` · ${critic.model}` : ''}</p>
            </div>
          ) : null}
          {activeTopic ? (
            <p className="rounded-stitch bg-surface-tonal px-3 py-2 text-xs leading-5 text-primary/60">Gắn nội dung README với topic hiện tại: {activeTopic.title}</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-stitch border border-outline bg-surface/70 p-3">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="text-accent" size={16} />
          <h2 className="text-xs font-semibold uppercase tracking-section text-accent">Timeline</h2>
        </div>
        <div className="space-y-2">
          {metadata.timeline ? (
            <div className="rounded-stitch border border-outline bg-surface-tonal px-3 py-2">
              <p className="text-xs font-semibold text-primary">README</p>
              <p className="mt-1 text-xs leading-5 text-primary/55">{metadata.timeline}</p>
            </div>
          ) : null}
          {timelineTopics.map((topic) => (
            <div className="rounded-stitch border border-outline bg-surface-tonal px-3 py-2" key={topic._id}>
              <p className="line-clamp-2 text-xs font-semibold leading-5 text-primary">{topic.title}</p>
              <p className="mt-1 text-xs text-primary/50">{formatDate(topic.deadline)}</p>
            </div>
          ))}
          {!metadata.timeline && !timelineTopics.length ? (
            <p className="rounded-stitch border border-dashed border-outline bg-surface-tonal p-3 text-xs leading-5 text-primary/55">Chưa có timeline để hiển thị.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}

function StitchDiaryDetailSkeleton() {
  return (
    <div className="rounded-stitch border border-outline bg-surface p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-5 w-5 animate-pulse rounded-stitch bg-surface-tonal" />
        <div className="h-4 w-20 animate-pulse rounded-stitch bg-surface-tonal" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full animate-pulse rounded-stitch bg-surface-tonal" />
        <div className="h-4 w-11/12 animate-pulse rounded-stitch bg-surface-tonal" />
        <div className="h-4 w-3/4 animate-pulse rounded-stitch bg-surface-tonal" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-16 animate-pulse rounded-stitch bg-surface-tonal" />
        <div className="h-6 w-20 animate-pulse rounded-stitch bg-surface-tonal" />
      </div>
    </div>
  );
}

function StitchDiaryDetailError({ error }: { error: unknown }) {
  return (
    <div className="rounded-stitch border border-danger/25 bg-danger/10 p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-section text-danger">Không tải được entry</p>
      <p className="mt-2 text-sm leading-6 text-primary/70">{error instanceof Error ? error.message : 'Vui lòng thử lại hoặc chọn entry khác.'}</p>
    </div>
  );
}

function ComposeView({
  topic,
  draftContent,
  draftTags,
  draftStatus,
  draftMedia,
  setDraftContent,
  setDraftTags,
  setDraftStatus,
  setDraftMedia,
  onBack,
  onTranscript,
  onAudioSelected,
  onImageSelected,
  onSave,
  isTranscribing,
  isUploadingImage,
  isSaving,
}: {
  topic?: Topic;
  draftContent: string;
  draftTags: string;
  draftStatus: 'Draft' | 'Debating' | 'Final';
  draftMedia: EntryMedia[];
  setDraftContent: (value: string) => void;
  setDraftTags: (value: string) => void;
  setDraftStatus: (value: 'Draft' | 'Debating' | 'Final') => void;
  setDraftMedia: (value: EntryMedia[]) => void;
  onBack: () => void;
  onTranscript: (text: string) => void;
  onAudioSelected: (file: File) => void;
  onImageSelected: (file: File) => void;
  onSave: () => void;
  isTranscribing: boolean;
  isUploadingImage: boolean;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4">
      <ViewTitle icon={<ArrowLeft size={18} />} title="Soạn thảo" onClick={onBack} />
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Topic</p>
        <h2 className="mt-2 text-xl font-semibold">{topic?.title}</h2>
      </section>
      <textarea className="min-h-72 w-full resize-none rounded-stitch border border-outline bg-surface-tonal p-4 text-base leading-7 text-primary outline-none placeholder:text-primary/35 focus:border-accent" value={draftContent} onChange={(event) => setDraftContent(event.target.value)} placeholder="Ghi lại luận điểm, phản biện hoặc transcript..." />
      <label className="relative block">
        <Tags className="absolute left-3 top-3 text-primary/40" size={16} />
        <input className="h-11 w-full rounded-stitch border border-outline bg-surface-tonal pl-9 pr-3 text-sm text-primary outline-none focus:border-accent" value={draftTags} onChange={(event) => setDraftTags(event.target.value)} placeholder="tags" />
      </label>
      <select className="h-11 w-full rounded-stitch border border-outline bg-surface-tonal px-3 text-sm text-primary outline-none focus:border-accent" value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as 'Draft' | 'Debating' | 'Final')}>
        <option>Draft</option>
        <option>Debating</option>
        <option>Final</option>
      </select>
      <div className="grid grid-cols-3 gap-2">
        <VoiceNoteButton onTranscript={onTranscript} />
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-stitch border border-outline bg-surface-tonal text-sm font-semibold text-primary/75">
          <Upload size={17} />
          <span>{isTranscribing ? 'Audio...' : 'Audio'}</span>
          <input accept="audio/*" className="hidden" disabled={isTranscribing} onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              onAudioSelected(file);
            }
          }} type="file" />
        </label>
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-stitch border border-outline bg-surface-tonal text-sm font-semibold text-primary/75">
          <ImagePlus size={17} />
          <span>{isUploadingImage ? 'Ảnh...' : 'Ảnh'}</span>
          <input accept="image/*" className="hidden" disabled={isUploadingImage} onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              onImageSelected(file);
            }
          }} type="file" />
        </label>
      </div>
      {draftMedia.length ? (
        <section className="rounded-stitch border border-outline bg-surface-tonal p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Media đã gắn</h3>
          <div className="grid gap-2">
            {draftMedia.map((media) => (
              <div className="flex items-center justify-between gap-2 rounded-stitch border border-outline bg-surface px-3 py-2" key={media.url}>
                <span className="min-w-0 truncate text-xs text-primary/70">{media.type}: {media.url}</span>
                <button aria-label="Remove media" className="grid h-8 w-8 place-items-center rounded-stitch border border-outline text-primary/65" onClick={() => setDraftMedia(draftMedia.filter((candidate) => candidate.url !== media.url))} type="button">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-stitch bg-accent text-base font-semibold text-on-accent disabled:opacity-40" disabled={!draftContent.trim() || isSaving} onClick={onSave} type="button">
        <Save size={18} />
        Lưu ghi chú
      </button>
    </div>
  );
}

function LegacyComposeView({
  topic,
  draftContent,
  draftTags,
  draftStatus,
  draftMedia,
  setDraftContent,
  setDraftTags,
  setDraftStatus,
  setDraftMedia,
  onBack,
  onTranscript,
  onAudioSelected,
  onImageSelected,
  onSave,
  isTranscribing,
  isUploadingImage,
  isSaving,
}: {
  topic?: Topic;
  draftContent: string;
  draftTags: string;
  draftStatus: 'Draft' | 'Debating' | 'Final';
  draftMedia: EntryMedia[];
  setDraftContent: (value: string) => void;
  setDraftTags: (value: string) => void;
  setDraftStatus: (value: 'Draft' | 'Debating' | 'Final') => void;
  setDraftMedia: (value: EntryMedia[]) => void;
  onBack: () => void;
  onTranscript: (text: string) => void;
  onAudioSelected: (file: File) => void;
  onImageSelected: (file: File) => void;
  onSave: () => void;
  isTranscribing: boolean;
  isUploadingImage: boolean;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4">
      <ViewTitle icon={<ArrowLeft size={18} />} title="Soạn thảo" onClick={onBack} />
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Topic</p>
        <h2 className="mt-2 text-xl font-semibold">{topic?.title}</h2>
      </section>
      <textarea className="min-h-72 w-full resize-none rounded-stitch border border-outline bg-surface-tonal p-4 text-base leading-7 text-primary outline-none placeholder:text-primary/35 focus:border-accent" value={draftContent} onChange={(event) => setDraftContent(event.target.value)} placeholder="Ghi lại luận điểm, phản biện hoặc transcript..." />
      <label className="relative block">
        <Tags className="absolute left-3 top-3 text-primary/40" size={16} />
        <input className="h-11 w-full rounded-stitch border border-outline bg-surface-tonal pl-9 pr-3 text-sm text-primary outline-none focus:border-accent" value={draftTags} onChange={(event) => setDraftTags(event.target.value)} placeholder="tags" />
      </label>
      <select className="h-11 w-full rounded-stitch border border-outline bg-surface-tonal px-3 text-sm text-primary outline-none focus:border-accent" value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as 'Draft' | 'Debating' | 'Final')}>
        <option>Draft</option>
        <option>Debating</option>
        <option>Final</option>
      </select>
      <label className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-stitch border border-outline bg-surface-tonal text-sm font-semibold text-primary/75">
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
      <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-stitch bg-accent text-base font-semibold text-on-accent disabled:opacity-40" disabled={!draftContent.trim() || isSaving} onClick={onSave} type="button">
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
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <div className="h-80 overflow-hidden rounded-stitch border border-outline bg-surface">
          <ReactFlow nodes={graph.nodes} edges={graph.edges} fitView>
            <Background color="rgba(231,251,247,0.16)" gap={18} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </section>
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Liên kết</h2>
        <div className="space-y-2">
          {entries.map((entry) => (
            <p className="rounded-stitch bg-surface p-3 text-sm leading-6 text-primary/70" key={entry._id}>
              {entry.content}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

function WorkflowView({
  checklists,
  users,
  onCreateChecklist,
  onToggleItem,
  isCreating,
  isUpdating,
  onBack,
}: {
  checklists: Checklist[];
  users: User[];
  onCreateChecklist: (template: ChecklistTemplate) => void;
  onToggleItem: (checklistId: string, item: Checklist['items'][number]) => void;
  isCreating: boolean;
  isUpdating: boolean;
  onBack: () => void;
}) {
  const items = checklists.flatMap((checklist) => checklist.items.map((item) => ({ checklist, item })));
  const done = items.filter(({ item }) => item.status === 'Done').length;
  const review = items.filter(({ item }) => item.status === 'Review').length;
  const hasTemplate = (template: ChecklistTemplate) => checklists.some((checklist) => checklist.template === template);

  return (
    <div className="space-y-4">
      <ViewTitle icon={<ArrowLeft size={18} />} title="Quản lý Quy trình & Checklist" onClick={onBack} />
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Tiến độ</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric icon={<CheckSquare size={15} />} label="Done" value={`${done}/${items.length}`} />
          <Metric icon={<Clock size={15} />} label="Review" value={review.toString()} />
          <Metric icon={<Users size={15} />} label="DRI" value={users.length.toString()} />
        </div>
      </section>
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Template học tập</h2>
        <div className="grid grid-cols-2 gap-2">
          {(['Apple DRI', 'Google Design Sprint'] as ChecklistTemplate[]).map((template) => (
            <button
              className="rounded-stitch border border-outline bg-surface p-3 text-left text-sm disabled:opacity-45"
              disabled={isCreating || hasTemplate(template)}
              key={template}
              onClick={() => onCreateChecklist(template)}
              type="button"
            >
              <div className="font-semibold text-primary">{template}</div>
              <p className="mt-1 text-xs leading-5 text-primary/55">{hasTemplate(template) ? 'Đã tạo cho topic này' : 'Tạo workflow chuẩn Stitch'}</p>
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Checklist</h2>
          <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/70">{checklists.length} board</span>
        </div>
        <div className="space-y-3">
          {checklists.length ? (
            checklists.map((checklist) => (
              <div className="rounded-stitch border border-outline bg-surface p-3" key={checklist._id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{checklist.template}</h3>
                  <span className="text-xs text-primary/45">{checklist.items.filter((item) => item.status === 'Done').length}/{checklist.items.length}</span>
                </div>
                <div className="grid gap-2">
                  {checklist.items.map((item) => (
                    <button className="w-full rounded-stitch border border-outline bg-surface-tonal p-3 text-left disabled:opacity-60" disabled={isUpdating} key={item._id} onClick={() => onToggleItem(checklist._id, item)} type="button">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">{item.title}</span>
                        <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/70">{item.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-primary/45">{item.phase ? `${item.phase} · ` : ''}DRI: {displayName(item.driUserId)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-stitch border border-dashed border-outline bg-surface p-4 text-sm text-primary/60">Chưa có checklist. Hãy tạo Apple DRI hoặc Google Design Sprint.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function LegacyWorkflowView({
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
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Tiến độ</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric icon={<CheckSquare size={15} />} label="Done" value={`${done}/${total}`} />
          <Metric icon={<Clock size={15} />} label="Review" value={(checklist?.items.filter((item) => item.status === 'Review').length ?? 0).toString()} />
          <Metric icon={<Users size={15} />} label="DRI" value="1" />
        </div>
      </section>
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Checklist</h2>
          <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/70">{checklist?.template ?? 'Custom'}</span>
        </div>
        <div className="space-y-2">
          {checklist ? (
            checklist.items.map((item) => (
              <button className="w-full rounded-stitch border border-outline bg-surface p-3 text-left disabled:opacity-60" disabled={isUpdating} key={item._id} onClick={() => onToggleItem(item)} type="button">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{item.title}</span>
                  <span className="rounded-stitch bg-surface-tonal px-2 py-1 text-xs text-primary/70">{item.status}</span>
                </div>
                <p className="mt-1 text-xs text-primary/45">{item.phase ? `${item.phase} · ` : ''}DRI</p>
              </button>
            ))
          ) : (
            <div className="rounded-stitch border border-dashed border-outline bg-surface p-4">
              <p className="text-sm text-primary/60">Chưa có checklist.</p>
              <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-stitch bg-accent px-3 text-sm font-semibold text-on-accent disabled:opacity-45" disabled={isCreating} onClick={onCreateChecklist} type="button">
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

function SearchView({
  query,
  setQuery,
  results,
  isLoading,
  onBack,
  onSelectEntry,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: Entry[];
  isLoading: boolean;
  onBack: () => void;
  onSelectEntry: (entry: Entry) => void;
}) {
  return (
    <div className="space-y-4">
      <ViewTitle icon={<ArrowLeft size={18} />} title="Semantic Search" onClick={onBack} />
      <label className="relative block">
        <Search className="absolute left-3 top-3 text-primary/40" size={16} />
        <input className="h-11 w-full rounded-stitch border border-outline bg-surface-tonal pl-9 pr-3 text-sm text-primary outline-none placeholder:text-primary/35 focus:border-accent" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập luận điểm, tag, từ khóa..." />
      </label>
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Kết quả</h2>
          <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/65">{isLoading ? 'Đang tìm' : `${results.length} entry`}</span>
        </div>
        <div className="grid gap-2">
          {results.map((entry) => (
            <button className="rounded-stitch border border-outline bg-surface p-3 text-left hover:border-accent" key={entry._id} onClick={() => onSelectEntry(entry)} type="button">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="rounded-stitch bg-surface-tonal px-2 py-1 text-xs text-primary/70">{entry.status}</span>
                {typeof entry.similarity === 'number' && <span className="text-xs text-accent">{Math.round(entry.similarity * 100)}%</span>}
              </div>
              <p className="text-sm leading-6 text-primary/75">{shortText(entry.content, 180)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.tags?.map((tag) => (
                  <span className="rounded-stitch bg-surface-tonal px-2 py-1 text-xs text-primary/55" key={tag.name}>{tag.name}</span>
                ))}
              </div>
            </button>
          ))}
          {!results.length && <p className="rounded-stitch border border-dashed border-outline bg-surface p-4 text-sm text-primary/60">Chưa có kết quả phù hợp.</p>}
        </div>
      </section>
    </div>
  );
}

function WorkspaceView({
  currentUser,
  users,
  groups,
  topics,
  onBack,
  onTopicSelect,
}: {
  currentUser: User;
  users: User[];
  groups: Group[];
  topics: Topic[];
  onBack: () => void;
  onTopicSelect: (topic: Topic) => void;
}) {
  const overdueTopics = topics.filter(isTopicOverdue);
  return (
    <div className="space-y-4">
      <ViewTitle icon={<ArrowLeft size={18} />} title="Group & Timeline" onClick={onBack} />
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Người dùng hiện tại</p>
        <h2 className="mt-2 text-xl font-semibold">{displayName(currentUser)}</h2>
        <p className="mt-1 text-sm text-primary/55">{currentUser.email}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric icon={<Users size={15} />} label="Members" value={users.length.toString()} />
          <Metric icon={<FileText size={15} />} label="Topics" value={topics.length.toString()} />
          <Metric icon={<Clock size={15} />} label="Overdue" value={overdueTopics.length.toString()} />
        </div>
      </section>
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Nhóm học tập</h2>
        <div className="grid gap-2">
          {groups.map((group) => (
            <div className="rounded-stitch border border-outline bg-surface p-3" key={group._id}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{group.name}</h3>
                <span className="rounded-stitch bg-surface-tonal px-2 py-1 text-xs text-primary/60">{group.members.length} member</span>
              </div>
              <p className="mt-2 text-xs text-primary/45">Leader: {displayName(group.leaderId)}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-stitch border border-outline bg-surface-tonal p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Timeline Guard</h2>
        <div className="grid gap-2">
          {topics.map((topic) => (
            <button className="rounded-stitch border border-outline bg-surface p-3 text-left hover:border-accent" key={topic._id} onClick={() => onTopicSelect(topic)} type="button">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{topic.title}</span>
                <span className={`rounded-stitch px-2 py-1 text-xs ${isTopicOverdue(topic) ? 'bg-danger/15 text-danger' : 'bg-surface-tonal text-primary/65'}`}>{formatDate(topic.deadline)}</span>
              </div>
              <p className="mt-1 text-xs text-primary/45">{topic.category} · {topic.status}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ViewTitle({ icon, title, onClick }: { icon: ReactNode; title: string; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button className="grid h-10 w-10 place-items-center rounded-stitch border border-outline bg-surface-tonal text-primary" onClick={onClick} type="button">
        {icon}
      </button>
      <h2 className="min-w-0 flex-1 text-xl font-semibold leading-tight">{title}</h2>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-stitch border border-outline bg-surface px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-primary/45">
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
    { key: 'search', label: 'Search', icon: <Search size={17} /> },
    { key: 'compose', label: 'Soạn', icon: <Edit3 size={17} /> },
    { key: 'graph', label: 'Graph', icon: <Network size={17} /> },
    { key: 'workflow', label: 'Việc', icon: <CheckSquare size={17} /> },
    { key: 'workspace', label: 'Nhóm', icon: <Users size={17} /> },
  ];

  return (
    <nav className="absolute inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-outline bg-surface-tonal/95 px-2 py-2 backdrop-blur">
      {items.map((item) => (
        <button className={`flex h-12 flex-col items-center justify-center gap-1 rounded-stitch text-xs font-semibold ${activeView === item.key ? 'text-accent' : 'text-primary/55'}`} key={item.key} onClick={() => onChange(item.key)} type="button">
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
