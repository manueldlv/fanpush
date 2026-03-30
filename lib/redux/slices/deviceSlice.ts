import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type DeviceRuntimeState = {
  hydrated: boolean;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  isMobileViewport: boolean;
  isTouch: boolean;
  orientation: "portrait" | "landscape";
  prefersReducedMotion: boolean;
};

const initialState: DeviceRuntimeState = {
  hydrated: false,
  viewportWidth: 0,
  viewportHeight: 0,
  screenWidth: 0,
  screenHeight: 0,
  devicePixelRatio: 1,
  isMobileViewport: false,
  isTouch: false,
  orientation: "portrait",
  prefersReducedMotion: false,
};

const deviceSlice = createSlice({
  name: "device",
  initialState,
  reducers: {
    setDeviceRuntime: (state, action: PayloadAction<DeviceRuntimeState>) => {
      return action.payload;
    },
  },
});

export const { setDeviceRuntime } = deviceSlice.actions;

export default deviceSlice.reducer;
