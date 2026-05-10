import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../api/client';
import { Entry, ReadmePayload } from '../types';

type StitchDiaryMetadata = ReadmePayload['metadata'] & {
  sourceEntryId?: string;
};

type BackendDiaryEnvelope = {
  metadata?: Partial<ReadmePayload['metadata']>;
  content?: string | { raw?: string };
  entries?: Entry[];
};

type DiaryEndpointResponse = Entry[] | BackendDiaryEnvelope;

type UseStitchDiaryOptions = {
  topicId?: string;
  enabled?: boolean;
};

const STITCH_PROJECT_URL = 'https://stitch.withgoogle.com/projects/7588991082477143008';

const defaultMetadata: StitchDiaryMetadata = {
  title: 'Collaborative Knowledge Diary',
  layout: 'knowledge-diary-shell',
  theme: 'academic-amber-dark',
  priority: 'normal',
  timeline: null,
  template: 'stitch-academic-amber',
  stitchIntent: {
    source: 'stitch',
    projectUrl: STITCH_PROJECT_URL,
    layout: 'knowledge-diary-shell',
    theme: 'academic-amber-dark',
    priority: 'normal',
    timeline: null,
    template: 'stitch-academic-amber',
  },
  frontmatter: {},
};

export function useStitchDiary({ topicId, enabled = true }: UseStitchDiaryOptions = {}) {
  const query = useQuery({
    queryKey: ['stitch-diary', topicId],
    queryFn: ({ signal }) => fetchDiaryEntries(topicId, signal),
    enabled,
  });

  const diary = useMemo(() => normalizeDiaryResponse(query.data), [query.data]);

  return {
    ...query,
    entries: diary.entries,
    metadata: diary.metadata,
    layout: diary.metadata.layout,
    theme: diary.metadata.theme,
    content: diary.content,
    markdownProps: {
      markdown: diary.content,
      metadata: diary.metadata,
    },
  };
}

export type StitchDiary = ReturnType<typeof useStitchDiary>;

async function fetchDiaryEntries(topicId?: string, signal?: AbortSignal): Promise<DiaryEndpointResponse> {
  const query = topicId ? `?topicId=${encodeURIComponent(topicId)}` : '';
  const response = await fetch(`${API_BASE_URL}/entries${query}`, { signal });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  return data && typeof data === 'object' && 'value' in data ? (data.value as DiaryEndpointResponse) : (data as DiaryEndpointResponse);
}

function normalizeDiaryResponse(response?: DiaryEndpointResponse) {
  const envelope = Array.isArray(response) ? undefined : response;
  const entries = Array.isArray(response) ? response : response?.entries ?? [];
  const envelopeContent = envelope?.content;
  const rawEnvelopeContent = typeof envelopeContent === 'string' ? envelopeContent : envelopeContent?.raw;
  const preferredEntry = entries.find((entry) => entry.status === 'Debating') ?? entries[0];
  const rawContent = rawEnvelopeContent ?? entries.map((entry) => entry.content).filter(Boolean).join('\n\n---\n\n');
  const parsed = parseFrontmatter(rawContent);
  const entryMetadata = preferredEntry?.metadata;
  const frontmatter = { ...parsed.frontmatter, ...(entryMetadata?.frontmatter ?? {}), ...(envelope?.metadata?.frontmatter ?? {}) };
  const metadata = buildMetadata({
    backendMetadata: { ...entryMetadata, ...envelope?.metadata },
    frontmatter,
    preferredEntry,
    content: parsed.content,
  });

  return {
    entries,
    metadata,
    content: parsed.content,
  };
}

function buildMetadata({
  backendMetadata,
  frontmatter,
  preferredEntry,
  content,
}: {
  backendMetadata?: Partial<ReadmePayload['metadata']>;
  frontmatter: Record<string, unknown>;
  preferredEntry?: Entry;
  content: string;
}): StitchDiaryMetadata {
  const title = stringValue(backendMetadata?.title, stringValue(frontmatter.title, firstHeading(content) ?? defaultMetadata.title));
  const layout = stringValue(backendMetadata?.layout, stringValue(frontmatter.layout, defaultMetadata.layout));
  const theme = stringValue(backendMetadata?.theme, stringValue(frontmatter.theme, defaultMetadata.theme));
  const priority = stringValue(backendMetadata?.priority, stringValue(frontmatter.priority, defaultMetadata.priority));
  const timeline = nullableString(backendMetadata?.timeline ?? frontmatter.timeline);
  const template = stringValue(backendMetadata?.template, stringValue(frontmatter.template, resolveTemplate(layout, theme)));

  return {
    ...defaultMetadata,
    ...backendMetadata,
    title,
    layout,
    theme,
    priority,
    timeline,
    template,
    sourceEntryId: preferredEntry?._id,
    frontmatter,
    stitchIntent: {
      source: 'stitch',
      projectUrl: backendMetadata?.stitchIntent?.projectUrl ?? STITCH_PROJECT_URL,
      layout,
      theme,
      priority,
      timeline,
      template,
    },
  };
}

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: {}, content: markdown.trim() };
  }

  return {
    frontmatter: parseMetadataBlock(match[1]),
    content: markdown.slice(match[0].length).trim(),
  };
}

function parseMetadataBlock(block: string) {
  return block.split(/\r?\n/).reduce<Record<string, unknown>>((metadata, line) => {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      return metadata;
    }

    metadata[match[1]] = normalizeMetadataValue(match[2]);
    return metadata;
  }, {});
}

function normalizeMetadataValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  return trimmed.replace(/^['"]|['"]$/g, '');
}

function resolveTemplate(layout: string, theme: string) {
  const normalizedLayout = layout.toLowerCase();
  const normalizedTheme = theme.toLowerCase();

  if (normalizedLayout.includes('timeline')) {
    return 'stitch-timeline';
  }
  if (normalizedLayout.includes('graph')) {
    return 'stitch-knowledge-graph';
  }
  if (normalizedTheme.includes('amber') || normalizedTheme.includes('academic')) {
    return 'stitch-academic-amber';
  }
  return 'stitch-default';
}

function firstHeading(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^#\s+(.+)$/)?.[1]?.trim())
    .find(Boolean);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
