import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/lib/redux/slices/authSlice";
import notificationsReducer from "@/lib/redux/slices/notificationsSlice";
import viewerReducer from "@/lib/redux/slices/viewerSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      viewer: viewerReducer,
      notifications: notificationsReducer,
    },
    devTools: process.env.NODE_ENV !== "production",
  });

export const store = makeStore();

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
