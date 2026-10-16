export interface Tag {
  id: string;
  nome: string;
  /** Quante transazioni lo usano: lo conta il BE a ogni GET. */
  n_transazioni?: number;
}

// 2. Definiamo lo stato dello slice
export interface TagState {
  loading: boolean;
  tags: Tag[];
  selectedTag: Tag | null;
  filters: TagsFilters;
}

export interface createTagParams {
  nome: string;
}

export interface UpdateTagParams {
  id: string;
  nome: string;
}

export interface DeleteTagParams {
  id: string;
}

export interface TagsFilters {
  sort_by?: string[];
}
