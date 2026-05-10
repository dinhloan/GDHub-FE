import { ReactNode } from 'react';
import { GlassmorphismWrapper } from './GlassmorphismWrapper';

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
      <GlassmorphismWrapper className="min-w-0 overflow-hidden p-4">
        <div className="min-w-0 space-y-4 overflow-hidden break-words">{sidebar}</div>
      </GlassmorphismWrapper>
    </section>
  );
}
