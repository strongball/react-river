import { useState } from 'react';

import { useRiverWatch, when } from '@stball/react-river';

import { postProvider } from '../providers';

export function PostCard() {
  const [postId, setPostId] = useState(1);

  return (
    <section className="card">
      <div className="card-badge">promiseProviderFamily</div>
      <h2>Post Viewer</h2>

      <div className="button-row">
        {[1, 2, 3, 4, 5].map((id) => (
          <button key={id} className={id === postId ? 'active' : 'secondary'} onClick={() => setPostId(id)}>
            #{id}
          </button>
        ))}
      </div>

      <PostContent postId={postId} />
    </section>
  );
}

function PostContent({ postId }: { postId: number }) {
  const postAsync = useRiverWatch(postProvider(postId));

  return when(postAsync, {
    loading: () => <div className="skeleton">Loading post #{postId}…</div>,
    error: (e) => <div className="error-box">Error: {String(e)}</div>,
    data: (post) => (
      <div className="post-content">
        <h3>{post.title}</h3>
        <p>{post.body}</p>
      </div>
    ),
  });
}
