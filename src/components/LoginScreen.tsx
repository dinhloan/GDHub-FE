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
      setError('Email này chưa có trong danh sách thành viên từ backend.');
      return;
    }

    setError('');
    onLogin(matchedUser);
  };

  return (
    <main className="grid min-h-screen bg-paper text-ink lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
      <section className="flex min-h-[42vh] flex-col justify-between bg-ink px-6 py-6 text-panel sm:px-10 lg:min-h-screen">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded bg-panel text-ink">
            <BrainCircuit size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">GDHub</h1>
            <p className="text-sm text-panel/65">Collaborative Knowledge Diary Hub</p>
          </div>
        </div>
        <div className="max-w-xl py-12 lg:py-0">
          <p className="text-sm font-medium uppercase text-panel/55">Team workspace</p>
          <h2 className="mt-4 max-w-lg text-4xl font-semibold leading-tight sm:text-5xl">Đăng nhập để vào không gian học nhóm</h2>
          <p className="mt-5 max-w-md text-base leading-7 text-panel/70">
            Chọn thành viên hoặc nhập email đã có trong hệ thống để tiếp tục làm việc với topic, ghi chú và thảo luận nhóm.
          </p>
        </div>
        <div className="grid gap-3 text-sm text-panel/70 sm:grid-cols-3">
          <span className="rounded border border-panel/15 px-3 py-2">Semantic notes</span>
          <span className="rounded border border-panel/15 px-3 py-2">Realtime discussion</span>
          <span className="rounded border border-panel/15 px-3 py-2">Knowledge graph</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-8 sm:px-10">
        <form className="w-full max-w-md rounded border border-ink/10 bg-panel p-6 shadow-soft" onSubmit={submit}>
          <div>
            <h2 className="text-2xl font-semibold">Login</h2>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Dữ liệu thành viên được lấy trực tiếp từ backend. Nếu không thấy tài khoản của bạn, hãy kiểm tra backend/API trước khi vào workspace.
            </p>
          </div>

          <label className="mt-6 block text-sm font-medium text-ink/70" htmlFor="email">
            Email
          </label>
          <div className="relative mt-2">
            <Mail className="absolute left-3 top-3 text-ink/40" size={16} />
            <input
              id="email"
              className="h-11 w-full rounded border border-ink/10 bg-paper pl-9 pr-3 text-sm outline-none focus:border-moss"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSelectedUserId('');
                setError('');
              }}
              placeholder="name@example.com"
              type="email"
            />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-ink/70">Thành viên</span>
              {isLoading && <span className="text-xs text-ink/45">Đang tải...</span>}
            </div>
            <div className="grid gap-2">
              {visibleUsers.length > 0 ? (
                visibleUsers.map((user) => (
                  <button
                    className={`flex min-h-12 items-center gap-3 rounded border px-3 py-2 text-left text-sm transition ${
                      selectedUserId === user._id ? 'border-moss bg-moss/10' : 'border-ink/10 bg-paper hover:border-moss/60'
                    }`}
                    key={user._id}
                    onClick={() => {
                      setSelectedUserId(user._id);
                      setEmail(user.email);
                      setError('');
                    }}
                    type="button"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-ink/10 text-ink">
                      <UserRound size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{displayName(user)}</span>
                      <span className="block truncate text-xs text-ink/55">{user.email}</span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded border border-dashed border-ink/20 bg-paper px-3 py-4 text-sm leading-6 text-ink/60">
                  Chưa tải được thành viên thật từ backend.
                </div>
              )}
            </div>
          </div>

          {activeError && <p className="mt-4 rounded border border-alert/25 bg-alert/10 px-3 py-2 text-sm text-alert">{activeError}</p>}

          <button
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-ink px-4 text-sm font-medium text-panel disabled:opacity-45"
            disabled={!email.trim() && !selectedUserId}
            type="submit"
          >
            <LogIn size={16} />
            Vào workspace
          </button>
        </form>
      </section>
    </main>
  );
}
