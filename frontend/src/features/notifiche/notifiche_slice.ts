import { Action, createSlice } from "@reduxjs/toolkit";
import {
  disablePushOnDevice,
  enablePushOnDevice,
  getNotifiche,
  updatePreferenzeNotifiche,
} from "./api_calls";
import { NotificheState } from "./interfaces";
import { RootState } from "../../store/store";
import { logout } from "../profile/api_calls";

const initialState: NotificheState = {
  config: null,
  thisDevice: false,
  loading: false,
};

const notificheSlice = createSlice({
  name: "notifiche",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getNotifiche.fulfilled, (state, action) => {
        state.config = action.payload.config;
        state.thisDevice = action.payload.thisDevice;
      })
      .addCase(updatePreferenzeNotifiche.fulfilled, (state, action) => {
        state.config = action.payload;
      })
      .addCase(enablePushOnDevice.fulfilled, (state, action) => {
        if (!action.payload.config) return;
        state.config = action.payload.config;
        state.thisDevice = true;
      })
      .addCase(disablePushOnDevice.fulfilled, (state, action) => {
        if (action.payload) state.config = action.payload;
        state.thisDevice = false;
      })
      .addCase(logout.fulfilled, () => initialState)

      .addMatcher(
        (action: Action) =>
          action.type.startsWith("notifiche/") && action.type.endsWith("/pending"),
        (state) => {
          state.loading = true;
        },
      )
      .addMatcher(
        (action: Action) =>
          action.type.startsWith("notifiche/") &&
          (action.type.endsWith("/fulfilled") || action.type.endsWith("/rejected")),
        (state) => {
          state.loading = false;
        },
      );
  },
});

export const selectNotificheConfig = (state: RootState) => state.notifiche.config;

export const selectNotificheThisDevice = (state: RootState) =>
  state.notifiche.thisDevice;

export const selectNotificheLoading = (state: RootState) => state.notifiche.loading;

export default notificheSlice.reducer;
