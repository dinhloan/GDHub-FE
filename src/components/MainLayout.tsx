import { ReactNode } from 'react';

type MainLayoutProps = {
  children: ReactNode;
  sidebar: ReactNode;
};

export function MainLayout({ children, sidebar }: MainLayoutProps) {
  return (
    <section className="grid grid-cols-stitch-main gap-4 overflow-hidden rounded-stitch border border-outline bg-surface-tonal p-4">
      <div className="min-w-0 overflow-hidden rounded-stitch border border-outline bg-surface p-4">
        <div className="min-w-0 overflow-auto break-words">{children}</div>
      </div>
      <aside className="min-w-0 overflow-hidden rounded-stitch border border-outline-strong bg-surface-tonal/75 p-4 shadow-level-3 backdrop-blur">
        <div className="min-w-0 space-y-4 overflow-hidden break-words">{sidebar}</div>
      </aside>
    </section>
  );
}
