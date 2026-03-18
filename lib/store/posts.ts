import { create } from "zustand";

type Post = {
  id: string;
  userId: string;
  mediaPostIds: string[];
  author: string;
  verified: boolean;
  time: string;
  suggestion: string;
  caption: string;
  likes: number;
  avatar: string | null;
  price?: number;
  media: {
    url: string;
    kind: "image" | "video";
    locked: boolean;
  }[];
};

type PostsState = {
  posts: Post[];
  addPost: (post: Post) => void;
  setPosts: (posts: Post[] | ((prev: Post[]) => Post[])) => void;
};

export const usePostsStore = create<PostsState>((set) => ({
  posts: [],
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  setPosts: (posts) =>
    set((state) => ({
      posts: typeof posts === "function" ? posts(state.posts) : posts,
    })),
}));

export type { Post };
