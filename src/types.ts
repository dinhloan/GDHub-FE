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
