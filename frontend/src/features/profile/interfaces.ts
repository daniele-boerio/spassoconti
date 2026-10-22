// --- INTERFACCE ---

export interface AuthResponse {
  /** null quando il login chiede il secondo passaggio (`mfa_required`). */
  access_token: string | null;
  username: string;
  mfa_required?: boolean;
  /** Token a 5 minuti da ripresentare col codice a /auth/2fa/verify. */
  mfa_token?: string | null;
}

export interface VerifyTwoFactorParams {
  mfa_token: string;
  /** Codice a 6 cifre dell'app o codice di recupero. */
  code: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  recovery_codes_remaining: number;
}

export interface TwoFactorSetup {
  /** Il segreto in base32, da scrivere a mano nell'app se il QR non si può inquadrare. */
  secret: string;
  otpauth_uri: string;
}

export interface RecoveryCodesResponse {
  recovery_codes: string[];
}

/** Una passkey registrata (Face ID, impronta, PIN del dispositivo). */
export interface Passkey {
  id: number;
  nome: string;
  created_at: string;
  last_used_at: string | null;
}

export interface DisableTwoFactorParams {
  password: string;
  code: string;
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams extends LoginParams {
  email: string;
}

/** GET /auth/registration: pubblico, letto dalla schermata di accesso. */
export interface RegistrationStatus {
  enabled: boolean;
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
  /** Admin dell'app: vede la sezione "Utenti" nelle impostazioni. */
  isAdmin: boolean;
  /**
   * Iscrizioni aperte (REGISTRATION_ENABLED sul server). Parte da true: finché
   * la risposta non arriva il link "Registrati" resta com'è sempre stato.
   */
  registrationOpen: boolean;
  // Tag da preselezionare nel form di nuova transazione: è l'ultimo usato,
  // ricordato sull'account (quindi valido su ogni dispositivo). null = nessuna
  // precompilazione, ed è lo stato in cui si torna salvando senza tag.
  lastTagId: string | null;
  /**
   * Password giusta, manca il codice della verifica in due passaggi: finché
   * c'è, la schermata di accesso chiede il codice invece delle credenziali.
   */
  mfaToken: string | null;
  /** Stato della 2FA dell'account; null finché non è stato chiesto. */
  twoFactor: TwoFactorStatus | null;
  /** Passkey dell'account; null finché non sono state chieste. */
  passkeys: Passkey[] | null;
}

export interface ProfileResponse {
  username: string;
  email: string;
  is_open_banking_admin?: boolean;
  is_admin?: boolean;
  // Tetto di spesa mensile (Decimal sul BE: arriva come stringa).
  monthly_spending_budget?: number | string | null;
  last_tag_id?: number | null;
}
