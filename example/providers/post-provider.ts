import { promiseProviderFamily } from 'react-river';

import { sleep } from './utils';

export interface Post {
  id: number;
  title: string;
  body: string;
}

export const postProvider = promiseProviderFamily<Post, number>(
  async (_ref, postId) => {
    await sleep(800 + Math.random() * 700);
    return {
      id: postId,
      title: `Post #${postId}`,
      body: `This is the content of post ${postId}. Loaded at ${new Date().toLocaleTimeString()}.`,
    };
  },
  { name: 'post' },
);
