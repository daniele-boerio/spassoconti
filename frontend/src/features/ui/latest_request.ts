/**
 * "Vince l'ultima richiesta": per le letture che dipendono da filtri, periodo o
 * anno, una risposta lenta di una richiesta superata non deve sovrascrivere
 * quella nuova. Cambiando filtro due volte in fretta, o con rete lenta, senza
 * questo restava a schermo la lista (o il grafico) del filtro vecchio.
 *
 * Uso nello slice:
 *   pending   → rememberLatest(state.latest, action)
 *   fulfilled → if (!isLatest(state.latest, action)) return;
 *
 * La chiave è il tipo del thunk senza il suffisso (pending/fulfilled/rejected):
 * thunk diversi non si ostacolano a vicenda.
 */

/** requestId dell'ultima richiesta partita, per tipo di thunk. */
export type LatestRequests = Record<string, string>;

interface ThunkLifecycleAction {
  type: string;
  meta: { requestId: string };
}

const thunkType = (type: string) => type.replace(/\/(pending|fulfilled|rejected)$/, "");

export const rememberLatest = (
  latest: LatestRequests,
  action: ThunkLifecycleAction,
): void => {
  latest[thunkType(action.type)] = action.meta.requestId;
};

export const isLatest = (
  latest: LatestRequests,
  action: ThunkLifecycleAction,
): boolean => latest[thunkType(action.type)] === action.meta.requestId;
