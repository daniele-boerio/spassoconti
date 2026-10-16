// --- INTERFACCE ---

export interface AuthResponse {
  access_token: string;
  username: string;
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams extends LoginParams {
  email: string;
}

export interface ProfileState {
  /**
   * Il token salvato non è ancora stato verificato col server. Finché è vero
   * l'app si comporta come se fossi dentro — evita di sfarfallare — ma un 401
   * vuol dire solo "quel token era vecchio", non "sei stato buttato fuori".
   */
  restoring: boolean;
  loading: boolean;
  token: string | null;
  username: string | null;
  email: string | null;
  isAuthenticated: boolean;
  isOpenBankingAdmin: boolean;
  // Tag da preselezionare nel form di nuova transazione: è l'ultimo usato,
  // ricordato sull'account (quindi valido su ogni dispositivo). null = nessuna
  // precompilazione, ed è lo stato in cui si torna salvando senza tag.
  lastTagId: string | null;
}

export interface ProfileResponse {
  username: string;
  email: string;
  is_open_banking_admin?: boolean;
  // Tetto di spesa mensile (Decimal sul BE: arriva come stringa).
  monthly_spending_budget?: number | string | null;
  last_tag_id?: number | null;
}
