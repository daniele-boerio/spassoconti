import "axios";

// Flag interni usati dall'interceptor di `services/api.js` per pilotare il
// rinnovo automatico dell'access token. Dichiarati qui perché sono campi nostri
// aggiunti alla config di axios, non parte della sua API.
declare module "axios" {
  export interface AxiosRequestConfig {
    /** Non tentare il refresh su un 401 di questa richiesta (evita i cicli). */
    _skipAuthRefresh?: boolean;
    /** La richiesta è già stata rigiocata una volta dopo un refresh. */
    _retry?: boolean;
  }
}
