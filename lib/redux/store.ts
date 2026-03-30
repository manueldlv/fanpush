import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/lib/redux/slices/authSlice";
import deviceReducer from "@/lib/redux/slices/deviceSlice";
import modalsReducer from "@/lib/redux/slices/modalsSlice";
import notificationsReducer from "@/lib/redux/slices/notificationsSlice";
import postsReducer from "@/lib/redux/slices/postsSlice";
import searchReducer from "@/lib/redux/slices/searchSlice";
import uiReducer from "@/lib/redux/slices/uiSlice";
import viewerReducer from "@/lib/redux/slices/viewerSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      device: deviceReducer,
      modals: modalsReducer,
      ui: uiReducer,
      search: searchReducer,
      posts: postsReducer,
      viewer: viewerReducer,
      notifications: notificationsReducer,
    },
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
