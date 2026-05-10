import { Bot } from 'lucide-react';
import { Entry } from '../types';

type AiCriticCardProps = {
  critic?: Entry['aiCritic'];
  fallback?: string;
};

export function AiCriticCard({ critic, fallback = 'AI Critic sẽ hiển thị 3 câu hỏi thách thức khi Entry chuyển sang Debating.' }: AiCriticCardProps) {
  const questions = critic?.questions ?? [];

  return (
    <section className="rounded-stitch border border-outline bg-surface/70 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="text-accent" size={16} />
        <h2 className="text-xs font-semibold uppercase tracking-section text-accent">AI Suggestions</h2>
      </div>
      {questions.length ? (
        <div className="space-y-2 rounded-stitch border border-accent/25 bg-accent/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-accent">AI Critic Agent</p>
          {questions.map((question, index) => (
            <p className="text-xs leading-5 text-primary/70" key={`${question}-${index}`}>
              {index + 1}. {question}
            </p>
          ))}
          <p className="text-xs text-primary/45">
            {critic?.source}
            {critic?.model ? ` - ${critic.model}` : ''}
          </p>
        </div>
      ) : (
        <p className="rounded-stitch border border-dashed border-outline bg-surface-tonal p-3 text-xs leading-5 text-primary/55">
          {fallback}
        </p>
      )}
    </section>
  );
}
