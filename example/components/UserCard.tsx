import { useWatch, useRiverRef, when } from 'react-river';

import { userProvider } from '../providers';

export function UserCard() {
  const userAsync = useWatch(userProvider);
  const ref = useRiverRef();

  return (
    <section className="card">
      <div className="card-badge">asyncNotifierProvider</div>
      <h2>User Profile</h2>

      {when(userAsync, {
        loading: () => <div className="skeleton">Loading user…</div>,
        error: (e) => <div className="error-box">Error: {String(e)}</div>,
        data: (user) => (
          <div className="user-info">
            <div className="avatar">{user.name.charAt(0)}</div>
            <div>
              <strong>{user.name}</strong>
              <p className="muted">{user.email}</p>
            </div>
          </div>
        ),
      })}

      <div className="button-row">
        <button
          onClick={() => {
            const notifier = ref.read(userProvider.notifier);
            notifier.refreshUser();
          }}
          disabled={userAsync.isLoading}
        >
          {userAsync.isLoading ? 'Refreshing…' : 'Refresh User'}
        </button>
      </div>
    </section>
  );
}
