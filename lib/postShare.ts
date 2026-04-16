import { buildUserProfileHref } from "@/lib/profileRoute";
import type { Post } from "@/lib/store/posts";

export const buildPostSharePath = (post: Post) =>
  `${buildUserProfileHref(post.author)}?post=${encodeURIComponent(post.id)}`;
