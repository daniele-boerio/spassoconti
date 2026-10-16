// 1. Definiamo l'interfaccia per lo stato dell'errore
export interface ErrorState {
  isOpen: boolean;
  message: string;
  title: string;
}

// 2. Definiamo l'interfaccia per il payload del messaggio
export interface ErrorPayload {
  message?: string;
  title?: string;
}
