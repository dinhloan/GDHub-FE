import { Clock, LayoutTemplate } from 'lucide-react';
import { AiCriticCard } from './AiCriticCard';
import { Entry, ReadmePayload, Topic } from '../types';

type StitchSidebarProps = {
  activeTopic?: Topic;
  entries: Entry[];
  metadata: ReadmePayload['metadata'] & { sourceEntryId?: string };
  topics: Topic[];
};

export function StitchSidebar({ activeTopic, entries, metadata, topics }: StitchSidebarProps) {
  const timelineTopics = topics.slice(0, 3);
  const critic = entries.find((entry) => entry.aiCritic?.questions?.length)?.aiCritic;

  return (
    <>
      <AiCriticCard critic={critic} />

      <section className="rounded-stitch border border-outline bg-surface/70 p-3">
        <div className="mb-3 flex items-center gap-2">
          <LayoutTemplate className="text-accent" size={16} />
          <h2 className="text-xs font-semibold uppercase tracking-section text-accent">Stitch Template</h2>
        </div>
        <div className="space-y-2">
          <p className="text-sm leading-6 text-primary/75">Template đề xuất: {metadata.template}</p>
          <p className="text-xs leading-5 text-primary/55">
            Render theo layout {metadata.layout} và theme {metadata.theme} từ Stitch metadata.
          </p>
          {metadata.sourceEntryId ? <p className="text-xs leading-5 text-primary/50">Nguồn: entry {metadata.sourceEntryId}</p> : null}
          {activeTopic ? (
            <p className="rounded-stitch bg-surface-tonal px-3 py-2 text-xs leading-5 text-primary/60">
              Gắn nội dung README với topic hiện tại: {activeTopic.title}
            </p>
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
            <p className="rounded-stitch border border-dashed border-outline bg-surface-tonal p-3 text-xs leading-5 text-primary/55">
              Chưa có timeline để hiển thị.
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('vi-VN');
}
