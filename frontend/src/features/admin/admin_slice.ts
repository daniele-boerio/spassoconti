import { Action, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { banUser, getAdminUsers, unbanUser } from "./api_calls";
import { AdminState, AdminUser } from "./interfaces";
import { RootState } from "../../store/store";
import { logout } from "../profile/api_calls";

const initialState: AdminState = {
  users: null,
  loading: false,
};

/** Ban e riattivazione rispondono con la riga aggiornata: la sostituiamo. */
const replaceUser = (state: AdminState, action: PayloadAction<AdminUser>) => {
  if (!state.users) return;
  state.users = state.users.map((user) =>
    String(user.id) === String(action.payload.id) ? action.payload : user,
  );
};

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getAdminUsers.fulfilled, (state, action) => {
        state.users = action.payload;
      })
      .addCase(banUser.fulfilled, replaceUser)
      .addCase(unbanUser.fulfilled, replaceUser)

      // La lista è dell'admin: un altro account sullo stesso dispositivo non la deve vedere.
      .addCase(logout.fulfilled, () => initialState)

      .addMatcher(
        (action: Action) =>
          action.type.startsWith("admin/") && action.type.endsWith("/pending"),
        (state) => {
          state.loading = true;
        },
      )
      .addMatcher(
        (action: Action) =>
          action.type.startsWith("admin/") &&
          (action.type.endsWith("/fulfilled") || action.type.endsWith("/rejected")),
        (state) => {
          state.loading = false;
        },
      );
  },
});

export const selectAdminUsers = (state: RootState) => state.admin.users;
export const selectAdminLoading = (state: RootState) => state.admin.loading;

export default adminSlice.reducer;
