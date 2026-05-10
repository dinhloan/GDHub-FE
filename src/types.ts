export type TopicStatus = 'Open' | 'Overdue' | 'Closed';
export type EntryStatus = 'Draft' | 'Debating' | 'Final';
export type ChecklistStatus = 'Todo' | 'Doing' | 'Review' | 'Done';

export type User = {
  _id: string;
  name: string;
  username?: string;
  displayName?: string;
  email: string;
  avatar?: string;
  avatarUrl?: string | null;
};

export type Group = {
  _id: string;
  name: string;
  leaderId: User | string;
  members: (User | string)[];
};

export type Topic = {
  _id: string;
  title: string;
  description: string;
  status: TopicStatus;
  category: string;
  deadline: string;
  leaderId?: User | string;
};

export type Entry = {
  _id: string;
  topicId: string | Topic;
  authorId: string | User;
  content: string;
  status: EntryStatus;
  tags: { name: string; isPrivate: boolean }[];
  media: { type: string; url: string }[];
  updatedAt?: string;
  similarity?: number;
  metadata?: ReadmePayload['metadata'] & { sourceEntryId?: string };
  aiCritic?: {
    questions: string[];
    source: string;
    model?: string;
    generatedAt?: string;
  };
};

export type Message = {
  _id: string;
  entryId: string;
  userId: User | string;
  content: string;
  type: 'text' | 'opinion' | 'critique';
  timestamp: string;
};

export type Checklist = {
  _id: string;
  template: 'Apple DRI' | 'Google Design Sprint' | 'Custom';
  items: {
    _id: string;
    title: string;
    driUserId: User | string;
    status: ChecklistStatus;
    phase?: string;
  }[];
};

export type MarkdownBlock =
  | { type: 'heading'; depth: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; language: string; value: string }
  | { type: 'blockquote'; text: string }
  | { type: 'horizontalRule' };

export type MarkdownSection = {
  title: string;
  depth: number;
  blocks: MarkdownBlock[];
};

export type ReadmePayload = {
  metadata: {
    title: string;
    layout: string;
    theme: string;
    priority: string;
    timeline: string | null;
    template: string;
    stitchIntent: {
      source: 'stitch';
      projectUrl: string;
      layout: string;
      theme: string;
      priority: string;
      timeline: string | null;
      template: string;
    };
    frontmatter: Record<string, unknown>;
  };
  content: {
    raw: string;
    blocks: MarkdownBlock[];
    sections: MarkdownSection[];
  };
};
