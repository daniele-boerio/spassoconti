import axios from "axios";
import { toApiError } from "./api_error";

const api = axios.create({
  // Il BE è sullo stesso origin, sotto /api: in produzione lo gira nginx, in
  // sviluppo il proxy di Vite (vite.config.js).
  baseURL: "/api",
  // Il refresh token vive in un cookie httpOnly. Sullo stesso origin il browser
  // lo allega comunque; il flag resta perché non costa nulla e regge anche un BE
  // su un altro origin.
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// L'access token dura poco (30 min): quando scade lo rinnoviamo in automatico usando
// il cookie httpOnly e rigiochiamo la richiesta fallita, così l'utente non se ne
// accorge e resta loggato sul dispositivo.
//
// Se scadono più chiamate insieme, un refresh per ciascuna significherebbe token
// ruotati in parallelo: il server invaliderebbe i doppioni e scatterebbe la reuse
// detection, buttando fuori l'utente. Quindi il refresh è UNO solo, condiviso: le
// altre richieste aspettano la stessa promise.
let refreshPromise = null;

const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
};

const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh", null, { _skipAuthRefresh: true })
      .then((response) => {
        const { access_token, username } = response.data;
        localStorage.setItem("token", access_token);
        if (username) {
          localStorage.setItem("username", username);
        }
        return access_token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Tutti i thunk rigettano con `error.response?.data`: normalizzandolo QUI, una
    // volta sola, ogni chiamata (anche quelle scritte in futuro) consegna alla UI
    // uno `status` e un `detail` leggibile invece del corpo grezzo del BE.
    // Se `error.response` manca, il server non ha risposto affatto: lo lasciamo
    // così com'è, ed è proprio quel "payload non normalizzato" che l'errorMiddleware
    // riconosce come problema di rete.
    if (error.response) {
      error.response.data = toApiError(error.response.status, error.response.data);
    }

    const originalRequest = error.config;
    const isAuthError = error.response?.status === 401;

    // Un 401 sul refresh stesso vuol dire sessione finita davvero: non si riprova,
    // altrimenti si entra in un ciclo infinito.
    const canRetry =
      isAuthError &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest._skipAuthRefresh;

    if (!canRetry) {
      if (isAuthError && originalRequest?._skipAuthRefresh) {
        clearSession();
      }
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      const refreshStatus = refreshError.response?.status;

      // 409: un'altra scheda ha rinnovato la sessione nello stesso istante. Il
      // cookie nuovo è già nel browser e il token nuovo in localStorage (che le
      // schede condividono): si riprova con quello, senza buttare fuori nessuno.
      if (refreshStatus === 409) {
        const sharedToken = localStorage.getItem("token");
        if (sharedToken) {
          originalRequest.headers.Authorization = `Bearer ${sharedToken}`;
          return api(originalRequest);
        }
      }

      // Solo un "no" esplicito del server chiude la sessione: cookie scaduto o
      // revocato. Senza rete o con il server giù la sessione è ancora buona, e
      // cancellarla vorrebbe dire rifare il login per un problema passeggero.
      if (refreshStatus === 401 || refreshStatus === 403) {
        clearSession();
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
