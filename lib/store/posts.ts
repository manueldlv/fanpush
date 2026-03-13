import { create } from "zustand";

type Post = {
  id: string;
  author: string;
  verified: boolean;
  time: string;
  suggestion: string;
  caption: string;
  likes: number;
  avatar: string;
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
};

const initialPosts: Post[] = [
  {
    id: "post-1",
    author: "infobae",
    verified: true,
    time: "10 h",
    suggestion: "Sugerencia para ti",
    caption:
      "Una joven argentina se prepara para ocupar un lugar inedito en la historia espacial del pais.",
    likes: 3866,
    avatar: "https://picsum.photos/seed/infobae-avatar/64/64",
    price: 10,
    media: [
      {
        url: "https://picsum.photos/seed/post-noel/900/720",
        kind: "image",
        locked: false,
      },
    ],
  },
  {
    id: "post-2",
    author: "cami.rojas",
    verified: false,
    time: "2 h",
    suggestion: "Sugerencia para ti",
    caption: "Sesion urbana en el centro. Luz dorada y texturas nuevas.",
    likes: 1240,
    avatar: "https://picsum.photos/seed/cami-avatar/64/64",
    price: 8,
    media: [
      {
        url: "https://picsum.photos/seed/post-urban/900/720",
        kind: "image",
        locked: false,
      },
    ],
  },
  {
    id: "post-3",
    author: "mateod",
    verified: false,
    time: "5 h",
    suggestion: "Sugerencia para ti",
    caption: "Nueva serie en progreso. Colores pastel y calma.",
    likes: 912,
    avatar: "https://picsum.photos/seed/mateo-avatar/64/64",
    price: 6,
    media: [
      {
        url: "https://picsum.photos/seed/post-pastel/900/720",
        kind: "image",
        locked: false,
      },
    ],
  },
];

export const usePostsStore = create<PostsState>((set) => ({
  posts: initialPosts,
  addPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
}));

export type { Post };
