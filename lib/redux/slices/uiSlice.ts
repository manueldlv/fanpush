import { createSlice } from "@reduxjs/toolkit";

type UiState = {
  searchPanelOpen: boolean;
  notificationsPanelOpen: boolean;
};

const initialState: UiState = {
  searchPanelOpen: false,
  notificationsPanelOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    openSearchPanel: (state) => {
      state.searchPanelOpen = true;
      state.notificationsPanelOpen = false;
    },
    closeSearchPanel: (state) => {
      state.searchPanelOpen = false;
    },
    openNotificationsPanel: (state) => {
      state.notificationsPanelOpen = true;
      state.searchPanelOpen = false;
    },
    closeNotificationsPanel: (state) => {
      state.notificationsPanelOpen = false;
    },
    closeShellPanels: (state) => {
      state.searchPanelOpen = false;
      state.notificationsPanelOpen = false;
    },
  },
});

export const {
  closeNotificationsPanel,
  closeSearchPanel,
  closeShellPanels,
  openNotificationsPanel,
  openSearchPanel,
} = uiSlice.actions;

export default uiSlice.reducer;
