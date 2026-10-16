import { useSelector } from "react-redux";
import AuthPage from "./pages/auth_page/auth_page";
import TabBar from "./components/tab_bar/tab_bar";
import NavRail from "./components/nav_rail/nav_rail";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.scss";
import { useAppDispatch } from "./store/store";
import { Suspense, useEffect } from "react";
import { getProfile, restoreSession } from "./features/profile/api_calls";
import SkeletonList from "./components/skeleton/skeleton";
import { useI18n } from "./i18n/use-i18n";
import ErrorDialog from "./components/dialog/error_dialog/error_dialog";
import { ConfirmPopup } from "primereact/confirmpopup";
import BankProposalsGate from "./components/bank_proposals_gate/bank_proposals_gate";
import SheetHost from "./components/sheet_host/sheet_host";
import ToastHost from "./components/toast/toast";
import { useThemeSync } from "./features/ui/use_theme";
import { useOfflineSync } from "./features/transactions/use_offline_sync";
import { lazyWithRetry } from "./services/lazy_with_retry";

// Code-splitting per route: ogni pagina è un chunk separato caricato solo
// quando ci si naviga, così non gravano sul bundle iniziale.
//
// `lazyWithRetry` e non `lazy`: il chunk della home viene chiesto
// all'avvio, cioè nel momento in cui la rete di un telefono è meno
// affidabile (vedi services/lazy_with_retry).
const HomePage = lazyWithRetry(() => import("./pages/home_page/home_page"));
const TransactionPage = lazyWithRetry(
  () => import("./pages/transaction_page/transaction_page"),
);
const CategoryPage = lazyWithRetry(
  () => import("./pages/category_page/category_page"),
);
const CategoryDetailPage = lazyWithRetry(
  () => import("./pages/category_detail_page/category_detail_page"),
);
const ContiPage = lazyWithRetry(() => import("./pages/conti_page/conti_page"));
const DebitiPage = lazyWithRetry(() => import("./pages/debiti_page/debiti_page"));
const AnalysisPage = lazyWithRetry(
  () => import("./pages/analysis_page/analysis_page"),
);
const RecurringsPage = lazyWithRetry(
  () => import("./pages/recurrings_page/recurrings_page"),
);
const SettingsPage = lazyWithRetry(
  () => import("./pages/settings_page/settings_page"),
);
const AltroPage = lazyWithRetry(() => import("./pages/altro_page/altro_page"));
const InvestimentiPage = lazyWithRetry(
  () => import("./pages/investimenti_page/investimenti_page"),
);
const ResetPasswordPage = lazyWithRetry(
  () => import("./pages/reset_password_page/reset_password_page"),
);
const NotFoundPage = lazyWithRetry(
  () => import("./pages/not_found_page/not_found_page"),
);
const BankCallbackPage = lazyWithRetry(
  () => import("./pages/bank_callback_page/bank_callback_page"),
);

// Mentre si scarica il codice di una pagina: la sagoma di una lista invece di
// uno spinner, così il passaggio alla pagina vera non fa saltare il layout.
function RouteFallback() {
  return (
    <div className="route-fallback" aria-busy="true">
      <SkeletonList />
    </div>
  );
}

function App() {
  const { t } = useI18n();
  const { isAuthenticated } = useSelector((state) => state.profile);

  // Tiene `data-theme` su <html> allineato alla preferenza salvata.
  useThemeSync();

  // Invia i movimenti salvati senza rete appena è possibile (avvio, ritorno
  // online, app di nuovo in primo piano).
  useOfflineSync();

  const dispatch = useAppDispatch();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      // L'access token può essere scaduto: ci pensa l'interceptor a rinnovarlo
      // col cookie e a rigiocare questa chiamata. Se anche il cookie è finito
      // si torna al login in silenzio: è un tentativo, non un'operazione
      // dell'utente da commentare con un errore.
      dispatch(getProfile());
      return;
    }

    // Nessun access token, ma il cookie httpOnly potrebbe reggere ancora la
    // sessione (es. localStorage svuotato da Safari/ITP): proviamo a recuperarla.
    dispatch(restoreSession()).then((action) => {
      if (action.payload) {
        dispatch(getProfile());
      }
    });
  }, [dispatch]);

  return (
    <Router>
      <a className="skip-link" href="#contenuto">
        {t("skip_to_content")}
      </a>
      <div className="App">
        {!isAuthenticated ? (
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/bank-callback" element={<BankCallbackPage />} />
              <Route path="*" element={<AuthPage />} />
            </Routes>
          </Suspense>
        ) : (
          <>
            <BankProposalsGate /> {/* Controllo automatico proposte bancarie */}
            {/* Le due navigazioni non convivono mai: il CSS accende il rail
                da 900px in su e la tab bar sotto. Il rail sta prima delle
                rotte perché in riga va a sinistra della pagina. */}
            <NavRail />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* I sei slot della tab bar */}
                <Route path="/" element={<HomePage />} />
                <Route path="/transactions" element={<TransactionPage />} />
                <Route path="/analysis" element={<AnalysisPage />} />
                <Route path="/accounts" element={<ContiPage />} />
                <Route path="/investments" element={<InvestimentiPage />} />
                <Route path="/altro" element={<AltroPage />} />

                {/* Destinazioni secondarie: ricorrenze e debiti dai Movimenti,
                    categorie e impostazioni da "Altro". */}
                <Route path="/categories" element={<CategoryPage />} />
                {/* Dettaglio di una categoria, aperto da Analisi. */}
                <Route
                  path="/categories/:id"
                  element={<CategoryDetailPage />}
                />
                {/* I tag sono la terza vista di "Categorie e tag". */}
                <Route
                  path="/tags"
                  element={<Navigate to="/categories?vista=tags" replace />}
                />
                <Route path="/recurrings" element={<RecurringsPage />} />
                <Route path="/debts" element={<DebitiPage />} />
                <Route path="/settings" element={<SettingsPage />} />

                <Route path="/bank-callback" element={<BankCallbackPage />} />

                {/* Statistiche e Grafici si sono fuse in Analisi */}
                <Route
                  path="/statistics"
                  element={<Navigate to="/analysis" replace />}
                />
                <Route
                  path="/charts"
                  element={
                    <Navigate to="/analysis?scope=categories" replace />
                  }
                />

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            <TabBar />
            <SheetHost />
            <ToastHost />
          </>
        )}
      </div>
      <ConfirmPopup />
      <ErrorDialog />
    </Router>
  );
}

export default App;
