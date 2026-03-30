import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Post } from "@/lib/store/posts";

type PostsState = {
  items: Post[];
};

const initialState: PostsState = {
  items: [],
};

const postsSlice = createSlice({
  name: "posts",
  initialState,
  reducers: {
    clearPostsState: () => initialState,
    setFeedPosts: (state, action: PayloadAction<Post[]>) => {
      state.items = action.payload;
    },
    prependFeedPost: (state, action: PayloadAction<Post>) => {
      state.items = [action.payload, ...state.items];
    },
  },
});

export const { clearPostsState, prependFeedPost, setFeedPosts } = postsSlice.actions;

export default postsSlice.reducer;
