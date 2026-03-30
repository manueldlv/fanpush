import type { PostMediaState } from "@/lib/postMediaState";

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
  media: PostMediaState[];
};

export type { Post };
