import { Checklist, Entry, Message, Topic, User } from './types';

export const mockUsers: User[] = [
  { _id: 'u1', name: 'An Nguyen', email: 'an@gdhub.local' },
  { _id: 'u2', name: 'Minh Tran', email: 'minh@gdhub.local' },
  { _id: 'u3', name: 'Linh Pham', email: 'linh@gdhub.local' },
];

export const mockTopics: Topic[] = [
  {
    _id: 't1',
    title: 'AI cho học nhóm chủ động',
    description: 'Tổng hợp cách dùng AI để phản biện, tìm khoảng trống và tạo graph tri thức.',
    status: 'Open',
    category: 'Tech',
    deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
    leaderId: mockUsers[0],
  },
  {
    _id: 't2',
    title: 'Năng lượng tái tạo trong đô thị',
    description: 'Tìm hiểu giới hạn triển khai solar rooftop và storage trong khu dân cư.',
    status: 'Overdue',
    category: 'Energy',
    deadline: new Date(Date.now() - 86400000).toISOString(),
    leaderId: mockUsers[1],
  },
];

export const mockEntries: Entry[] = [
  {
    _id: 'e1',
    topicId: 't1',
    authorId: mockUsers[0],
    content: 'AI critic nên đặt câu hỏi theo từng vai chuyên gia thay vì chỉ tóm tắt nội dung.',
    status: 'Debating',
    tags: [
      { name: 'ai-critic', isPrivate: false },
      { name: 'workflow', isPrivate: false },
    ],
    media: [],
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'e2',
    topicId: 't1',
    authorId: mockUsers[2],
    content: 'Knowledge graph cần nối entry theo tag công khai và điểm tương đồng embedding.',
    status: 'Draft',
    tags: [{ name: 'graph', isPrivate: false }],
    media: [],
    updatedAt: new Date().toISOString(),
  },
];

export const mockMessages: Message[] = [
  {
    _id: 'm1',
    entryId: 'e1',
    userId: mockUsers[1],
    content: 'Nên thêm template 5W1H để nhóm mới dễ bắt đầu.',
    type: 'opinion',
    timestamp: new Date().toISOString(),
  },
];

export const mockChecklists: Checklist[] = [
  {
    _id: 'c1',
    template: 'Google Design Sprint',
    items: [
      { _id: 'ci1', title: 'Understand checkpoint', driUserId: mockUsers[0], status: 'Done', phase: 'Understand' },
      { _id: 'ci2', title: 'Sketch checkpoint', driUserId: mockUsers[1], status: 'Doing', phase: 'Sketch' },
      { _id: 'ci3', title: 'Decide checkpoint', driUserId: mockUsers[2], status: 'Todo', phase: 'Decide' },
    ],
  },
];
