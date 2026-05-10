import { ReactNode } from 'react';

type GlassmorphismWrapperProps = {
  children: ReactNode;
  className?: string;
};

export function GlassmorphismWrapper({ children, className = '' }: GlassmorphismWrapperProps) {
  return (
    <div
      className={`rounded-stitch border border-outline-strong bg-surface-tonal/75 shadow-level-3 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}
