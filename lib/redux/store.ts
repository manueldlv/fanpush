import { configureStore } from "@reduxjs/toolkit";
import { commerceApi } from "@/lib/redux/api/commerceApi";
import { authorApi } from "@/lib/redux/api/authorApi";
import { authApi } from "@/lib/redux/api/authApi";
import { feedApi } from "@/lib/redux/api/feedApi";
import { discoveryApi } from "@/lib/redux/api/discoveryApi";
import { settingsApi } from "@/lib/redux/api/settingsApi";
import { notificationsApi } from "@/lib/redux/api/notificationsApi";
import { profileApi } from "@/lib/redux/api/profileApi";
import { socialApi } from "@/lib/redux/api/socialApi";
import { searchApi } from "@/lib/redux/api/searchApi";
import { sessionApi } from "@/lib/redux/api/sessionApi";
import authReducer from "@/lib/redux/slices/authSlice";
import deviceReducer from "@/lib/redux/slices/deviceSlice";
import modalsReducer from "@/lib/redux/slices/modalsSlice";
import notificationsReducer from "@/lib/redux/slices/notificationsSlice";
import postsReducer from "@/lib/redux/slices/postsSlice";
import searchReducer from "@/lib/redux/slices/searchSlice";
import chatReducer from "@/lib/redux/slices/chatSlice";
import uiReducer from "@/lib/redux/slices/uiSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      device: deviceReducer,
      modals: modalsReducer,
      ui: uiReducer,
      search: searchReducer,
      posts: postsReducer,
      chat: chatReducer,
      notifications: notificationsReducer,
      [authApi.reducerPath]: authApi.reducer,
      [commerceApi.reducerPath]: commerceApi.reducer,
      [authorApi.reducerPath]: authorApi.reducer,
      [feedApi.reducerPath]: feedApi.reducer,
      [discoveryApi.reducerPath]: discoveryApi.reducer,
      [settingsApi.reducerPath]: settingsApi.reducer,
      [socialApi.reducerPath]: socialApi.reducer,
      [profileApi.reducerPath]: profileApi.reducer,
      [sessionApi.reducerPath]: sessionApi.reducer,
      [searchApi.reducerPath]: searchApi.reducer,
      [notificationsApi.reducerPath]: notificationsApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(
        commerceApi.middleware,
        authorApi.middleware,
        authApi.middleware,
        feedApi.middleware,
        discoveryApi.middleware,
        settingsApi.middleware,
        socialApi.middleware,
        profileApi.middleware,
        sessionApi.middleware,
        searchApi.middleware,
        notificationsApi.middleware,
      ),
    devTools:
      process.env.NODE_ENV !== "production"
        ? {
            name: "FanPush",
          }
        : false,
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
