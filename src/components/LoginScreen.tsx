import { FormEvent, useMemo, useState } from 'react';
import { BrainCircuit, LogIn, Mail, UserRound } from 'lucide-react';
import { User } from '../types';

type LoginScreenProps = {
  users: User[];
  isLoading?: boolean;
  error?: string;
  onLogin: (user: User) => void;
};

const displayName = (user: User) => user.displayName || user.name || user.username || user.email;

export function LoginScreen({ users, isLoading, error: loadError, onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [error, setError] = useState('');

  const selectedUser = useMemo(() => users.find((user) => user._id === selectedUserId), [selectedUserId, users]);
  const visibleUsers = users.slice(0, 6);
  const activeError = error || loadError;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const matchedUser = selectedUser ?? users.find((user) => user.email.toLowerCase() === normalizedEmail);

    if (!matchedUser) {
      setError('User chưa tồn tại trong database. Vui lòng chọn đúng thành viên đã được tạo trên backend.');
      return;
    }

    setError('');
    onLogin(matchedUser);
  };

  return (
    <main className="min-h-screen bg-canvas text-primary md:grid md:place-items-center">
      <section className="mx-auto flex min-h-screen w-full max-w-shell flex-col bg-app-shell md:min-h-shell md:overflow-hidden md:rounded-stitch md:border md:border-outline md:shadow-soft">
        <div className="px-5 pb-4 pt-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-stitch bg-accent text-on-accent">
              <BrainCircuit size={23} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">GDHub</p>
              <h1 className="text-xl font-semibold leading-tight">Intellectual Synergy</h1>
            </div>
          </div>
          <div className="grid gap-3 text-sm font-semibold text-primary/70">
            <div className="rounded-stitch border border-outline bg-surface px-4 py-4">Semantic notes</div>
            <div className="rounded-stitch border border-outline bg-surface px-4 py-4">Realtime discussion</div>
            <div className="rounded-stitch border border-outline bg-surface px-4 py-4">Knowledge graph</div>
          </div>
        </div>

        <form className="mt-auto border-t border-outline bg-surface-tonal px-5 py-8" onSubmit={submit}>
          <div>
            <h2 className="text-3xl font-semibold">Login</h2>
            <p className="mt-3 text-sm leading-6 text-primary/60">Chỉ thành viên đã có trong database mới có thể vào workspace.</p>
          </div>

          <label className="mt-7 block text-sm font-semibold text-primary/70" htmlFor="email">
            Email
          </label>
          <div className="relative mt-2">
            <Mail className="absolute left-3 top-3 text-primary/40" size={17} />
            <input
              id="email"
              className="h-12 w-full rounded-stitch border border-outline bg-surface pl-10 pr-3 text-sm text-primary outline-none placeholder:text-primary/35 focus:border-accent"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSelectedUserId('');
                setError('');
              }}
              inputMode="email"
              placeholder="name@example.com"
              type="text"
            />
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-primary/70">Thành viên</span>
              {isLoading && <span className="text-xs text-primary/45">Đang tải...</span>}
            </div>
            <div className="grid gap-3">
              {visibleUsers.length > 0 ? (
                visibleUsers.map((user) => (
                  <button
                    className={`flex min-h-16 items-center gap-4 rounded-stitch border px-3 py-3 text-left transition ${
                      selectedUserId === user._id ? 'border-accent bg-accent/10' : 'border-outline bg-surface hover:border-accent/60'
                    }`}
                    key={user._id}
                    onClick={() => {
                      setSelectedUserId(user._id);
                      setEmail(user.email);
                      setError('');
                    }}
                    type="button"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-stitch bg-accent/10 text-accent">
                      <UserRound size={22} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold">{displayName(user)}</span>
                      <span className="block truncate text-sm text-primary/55">{user.email}</span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-stitch border border-dashed border-outline-strong bg-surface px-3 py-4 text-sm leading-6 text-primary/60">Backend chưa trả về thành viên nào.</div>
              )}
            </div>
          </div>

          {activeError && <p className="mt-4 rounded-stitch border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{activeError}</p>}

          <button
            className="mt-7 inline-flex h-14 w-full items-center justify-center gap-2 rounded-stitch bg-accent px-4 text-base font-semibold text-on-accent disabled:opacity-45"
            disabled={!email.trim() && !selectedUserId}
            type="submit"
          >
            <LogIn size={19} />
            Vào workspace
          </button>
        </form>
      </section>
    </main>
  );
}
