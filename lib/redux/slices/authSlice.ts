import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getSupabaseClient, getSupabaseSessionSafely } from "@/lib/supabase";

type AuthState = {
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
};

const initialState: AuthState = {
  hydrated: false,
  loading: false,
  error: null,
  isAuthenticated: false,
  userId: null,
  email: null,
};

export const hydrateAuthState = createAsyncThunk<
  Pick<AuthState, "isAuthenticated" | "userId" | "email">,
  void,
  { rejectValue: string }
>("auth/hydrate", async (_, { rejectWithValue }) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return rejectWithValue("Falta configurar Supabase.");
  }

  const session = await getSupabaseSessionSafely(supabase);

  if (!session?.user) {
    return {
      isAuthenticated: false,
      userId: null,
      email: null,
    };
  }

  return {
    isAuthenticated: true,
    userId: session.user.id,
    email: session.user.email ?? null,
  };
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuthState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateAuthState.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(hydrateAuthState.fulfilled, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        state.error = null;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.userId = action.payload.userId;
        state.email = action.payload.email;
      })
      .addCase(hydrateAuthState.rejected, (state, action) => {
        state.loading = false;
        state.hydrated = true;
        state.error = action.payload ?? "No se pudo validar la sesión.";
        state.isAuthenticated = false;
        state.userId = null;
        state.email = null;
      });
  },
});

export const { clearAuthState } = authSlice.actions;

export default authSlice.reducer;
