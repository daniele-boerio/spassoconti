// --- INTERFACCE ---

/** Un utente come lo vede l'admin (GET /admin/users). */
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  /** null = attivo; ISO della data del ban altrimenti. */
  banned_at: string | null;
  /** L'admin stesso: non si può bannare. */
  is_admin: boolean;
}

export interface AdminState {
  /** null finché la lista non è stata chiesta. */
  users: AdminUser[] | null;
  loading: boolean;
}
