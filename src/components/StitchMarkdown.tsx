import { ReactNode } from 'react';
import { Check, Circle, ExternalLink, ImageIcon, Quote } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ReadmePayload } from '../types';

type StitchMarkdownProps = {
  markdown: string;
  metadata?: ReadmePayload['metadata'];
};

type StitchTodoProps = {
  checked?: boolean;
  children: ReactNode;
};

type StitchMediaFrameProps = {
  src?: string;
  alt?: string;
};

export function StitchH1({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-stitch border border-accent/25 bg-accent/10 px-4 py-4 shadow-level-3">
      <p className="text-xs font-semibold uppercase tracking-section text-accent">Stitch brief</p>
      <h1 className="mt-2 text-3xl font-bold leading-tight text-primary">{children}</h1>
    </div>
  );
}

export function StitchH2({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-2 border-accent pl-3">
      <h2 className="text-xl font-semibold leading-tight text-primary">{children}</h2>
    </div>
  );
}

export function StitchTodo({ checked, children }: StitchTodoProps) {
  return (
    <li className="flex gap-3 rounded-stitch border border-outline bg-surface px-3 py-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-stitch border ${
          checked ? 'border-accent bg-accent text-on-accent' : 'border-outline-strong bg-surface-tonal text-primary/45'
        }`}
      >
        {checked ? <Check size={14} strokeWidth={3} /> : <Circle size={9} fill="currentColor" />}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-6 text-primary/75">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-eyebrow text-accent">Apple DRI</span>
        {children}
      </span>
    </li>
  );
}

export function StitchMediaFrame({ src, alt }: StitchMediaFrameProps) {
  if (!src) {
    return null;
  }

  return (
    <figure className="my-4 overflow-hidden rounded-stitch border border-outline bg-surface shadow-level-3">
      <img className="max-h-80 w-full object-cover" src={src} alt={alt ?? ''} loading="lazy" />
      {alt ? (
        <figcaption className="flex items-center gap-2 border-t border-outline bg-surface-tonal px-3 py-2 text-xs text-primary/55">
          <ImageIcon size={14} />
          {alt}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function StitchNoteBlock({ children }: { children: ReactNode }) {
  return (
    <blockquote className="my-4 rounded-stitch border border-outline-strong bg-surface px-4 py-3 shadow-soft">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow text-accent">
        <Quote size={14} />
        Personal note
      </div>
      <div className="space-y-2 text-sm leading-6 text-primary/75">{children}</div>
    </blockquote>
  );
}

function StitchParagraph({ children }: { children: ReactNode }) {
  const childArray = Array.isArray(children) ? children : [children];
  if (childArray.length === 1 && isStitchMediaFrame(childArray[0])) {
    return <>{children}</>;
  }

  return <p className="text-sm leading-6 text-primary/70">{children}</p>;
}

function isStitchMediaFrame(value: ReactNode) {
  return typeof value === 'object' && value !== null && 'type' in value && value.type === StitchMediaFrame;
}

function StitchList({ ordered, children }: { ordered?: boolean; children: ReactNode }) {
  const className = ordered ? 'list-decimal space-y-2 pl-5 text-sm leading-6 text-primary/70' : 'space-y-2';
  return ordered ? <ol className={className}>{children}</ol> : <ul className={className}>{children}</ul>;
}

function StitchListItem({ checked, children }: React.LiHTMLAttributes<HTMLLIElement> & { checked?: boolean }) {
  if (typeof checked === 'boolean') {
    return <StitchTodo checked={checked}>{children}</StitchTodo>;
  }

  return (
    <li className="flex gap-2 text-sm leading-6 text-primary/70">
      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-pill bg-accent" />
      <span>{children}</span>
    </li>
  );
}

export const stitchMarkdownComponents: Components = {
  h1: ({ children }) => <StitchH1>{children}</StitchH1>,
  h2: ({ children }) => <StitchH2>{children}</StitchH2>,
  h3: ({ children }) => <h3 className="text-base font-semibold leading-6 text-primary">{children}</h3>,
  p: ({ children }) => <StitchParagraph>{children}</StitchParagraph>,
  ul: ({ children }) => <StitchList>{children}</StitchList>,
  ol: ({ children }) => <StitchList ordered>{children}</StitchList>,
  li: (props) => {
    const { children, checked, ...rest } = props as React.LiHTMLAttributes<HTMLLIElement> & { checked?: boolean };
    return (
      <StitchListItem checked={checked} {...rest}>
        {children}
      </StitchListItem>
    );
  },
  img: ({ src, alt }) => <StitchMediaFrame src={src} alt={alt} />,
  blockquote: ({ children }) => <StitchNoteBlock>{children}</StitchNoteBlock>,
  a: ({ children, href }) => (
    <a className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline" href={href} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={13} />
    </a>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    return isBlock ? (
      <code className="block overflow-auto rounded-stitch bg-surface px-3 py-3 font-mono text-xs leading-5 text-primary/75">{children}</code>
    ) : (
      <code className="rounded-stitch bg-surface px-1.5 py-0.5 font-mono text-xs text-accent">{children}</code>
    );
  },
  pre: ({ children }) => <pre className="overflow-auto rounded-stitch border border-outline bg-surface p-0 shadow-soft">{children}</pre>,
  hr: () => <div className="h-px bg-outline" />,
};

export function StitchMarkdown({ markdown, metadata }: StitchMarkdownProps) {
  return (
    <article className="space-y-4">
      {metadata ? (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-stitch bg-surface px-2 py-1 text-xs font-semibold text-accent">{metadata.template}</span>
          <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/60">{metadata.layout}</span>
          <span className="rounded-stitch bg-surface px-2 py-1 text-xs text-primary/60">{metadata.theme}</span>
        </div>
      ) : null}
      <ReactMarkdown components={stitchMarkdownComponents} remarkPlugins={[remarkGfm]}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
