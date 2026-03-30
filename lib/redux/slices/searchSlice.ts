import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { PUBLIC_MEDIA_BUCKET } from "@/lib/media";
import { getSupabaseClient } from "@/lib/supabase";

export type SearchResultItem = {
  id: string;
  name: string;
  fullName: string;
  detail: string;
  avatar: string | null;
};

type SearchState = {
  query: string;
  loading: boolean;
  error: string | null;
  results: SearchResultItem[];
  recentSearches: SearchResultItem[];
};

const initialState: SearchState = {
  query: "",
  loading: false,
  error: null,
  results: [],
  recentSearches: [],
};

const resolveAvatar = async (value: string | null) => {
  const supabase = getSupabaseClient();
  if (!supabase || !value) return null;
  if (value.startsWith("http")) return value;
  return supabase.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(value).data.publicUrl;
};

export const searchUsers = createAsyncThunk<
  SearchResultItem[],
  string,
  { rejectValue: string }
>("search/users", async (rawQuery, { rejectWithValue }) => {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return rejectWithValue("Falta configurar Supabase.");
  }

  const { data, error } = await supabase
    .from("users")
    .select("id,username,avatar_url")
    .ilike("username", `%${query}%`)
    .limit(10);

  if (error) {
    return rejectWithValue(error.message);
  }

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      name: row.username ?? "usuario",
      fullName: row.username ?? "",
      detail: "Sugerencia para ti",
      avatar: await resolveAvatar(row.avatar_url ?? null),
    })),
  );
});

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
      if (!action.payload.trim()) {
        state.results = [];
        state.loading = false;
        state.error = null;
      }
    },
    clearSearchQuery: (state) => {
      state.query = "";
      state.results = [];
      state.loading = false;
      state.error = null;
    },
    setRecentSearches: (state, action: PayloadAction<SearchResultItem[]>) => {
      state.recentSearches = action.payload;
    },
    addRecentSearch: (state, action: PayloadAction<SearchResultItem>) => {
      state.recentSearches = [
        action.payload,
        ...state.recentSearches.filter((item) => item.id !== action.payload.id),
      ].slice(0, 8);
    },
    removeRecentSearch: (state, action: PayloadAction<string>) => {
      state.recentSearches = state.recentSearches.filter(
        (item) => item.id !== action.payload,
      );
    },
    clearRecentSearches: (state) => {
      state.recentSearches = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.results = action.payload;
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "No se pudo cargar la búsqueda.";
      });
  },
});

export const {
  addRecentSearch,
  clearRecentSearches,
  clearSearchQuery,
  removeRecentSearch,
  setRecentSearches,
  setSearchQuery,
} = searchSlice.actions;

export default searchSlice.reducer;
