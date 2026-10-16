import { createSlice, PayloadAction, Action } from "@reduxjs/toolkit";
import { Tag, TagState } from "./interfaces";
import { createTag, deleteTag, getTags, updateTag } from "./api_calls";
import { RootState } from "../../store/store";

const initialState: TagState = {
  loading: false,
  tags: [],
  selectedTag: null,
  filters: {
    sort_by: ["nome:asc"],
  },
};

// 3. Helper per i matcher tipizzati
const handlePending = (state: TagState) => {
  state.loading = true;
};

const handleRejected = (state: TagState) => {
  state.loading = false;
};

const tagSlice = createSlice({
  name: "tag",
  initialState,
  reducers: {
    // Se avessi bisogno di reducer sincroni (es. per pulire il tag selezionato)
    setSelectedTag: (state, action: PayloadAction<Tag | null>) => {
      state.selectedTag = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getTags.fulfilled, (state, action: PayloadAction<Tag[]>) => {
        state.tags = action.payload;
      })

      .addCase(createTag.fulfilled, (state, action: PayloadAction<Tag>) => {
        state.tags.push(action.payload);
      })

      .addCase(updateTag.fulfilled, (state, action: PayloadAction<Tag>) => {
        const index = state.tags.findIndex(
          (tag) => tag.id === action.payload.id,
        );
        if (index !== -1) {
          state.tags[index] = action.payload;
        }
      })

      .addCase(deleteTag.fulfilled, (state, action: PayloadAction<string>) => {
        state.tags = state.tags.filter((tag) => tag.id !== action.payload);
      })

      .addMatcher(
        (action: Action) =>
          action.type.endsWith("/pending") && action.type.startsWith("tag/"),
        handlePending,
      )
      .addMatcher(
        (action: Action) =>
          (action.type.endsWith("/rejected") ||
            action.type.endsWith("/fulfilled")) &&
          action.type.startsWith("tag/"),
        handleRejected,
      );
  },
});

export const { setSelectedTag } = tagSlice.actions;

export const selectTagLoading = (state: RootState) => state.tag.loading;

export const selectTagTags = (state: RootState) => state.tag.tags;

export const selectTagSelectedTag = (state: RootState) => state.tag.selectedTag;

export const selectTagFilters = (state: RootState) => state.tag.filters;

export default tagSlice.reducer;
