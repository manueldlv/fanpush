import { createSlice } from "@reduxjs/toolkit";

type ModalsState = {
  profileMenuOpen: boolean;
};

const initialState: ModalsState = {
  profileMenuOpen: false,
};

const modalsSlice = createSlice({
  name: "modals",
  initialState,
  reducers: {
    openProfileMenu: (state) => {
      state.profileMenuOpen = true;
    },
    closeProfileMenu: (state) => {
      state.profileMenuOpen = false;
    },
    toggleProfileMenu: (state) => {
      state.profileMenuOpen = !state.profileMenuOpen;
    },
    closeAllModals: (state) => {
      state.profileMenuOpen = false;
    },
  },
});

export const {
  closeAllModals,
  closeProfileMenu,
  openProfileMenu,
  toggleProfileMenu,
} = modalsSlice.actions;

export default modalsSlice.reducer;
