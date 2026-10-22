import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/use-i18n";
import Sheet from "../sheet/sheet";
import Button from "../button/button";
import {
  detectInstallMode,
  InstallMode,
  promptInstall,
  rememberInstallDismissed,
  subscribeInstallPrompt,
} from "../../features/ui/install";
import "./install_prompt.scss";

// Un attimo dopo l'apertura, non sopra al primo paint: su Android lascia anche
// il tempo a `beforeinstallprompt` di arrivare.
const SHOW_DELAY_MS = 2500;

/**
 * Invito a installare l'app quando la si apre dal browser del telefono.
 * Montato una volta in App.jsx, vale sia sulla schermata di accesso sia dentro.
 */
export default function InstallPrompt() {
  const { t } = useI18n();
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const detected = detectInstallMode();
      setMode(detected);
      setOpen(detected !== null);
    }, SHOW_DELAY_MS);

    // Prompt arrivato dopo (o app appena installata): si ricalcola, ma solo
    // per aggiornare un invito già aperto, non per aprirne uno nuovo.
    const unsubscribe = subscribeInstallPrompt(() => {
      setMode((current) => (current === null ? null : detectInstallMode()));
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const dismiss = () => {
    rememberInstallDismissed();
    setOpen(false);
  };

  const install = async () => {
    const accepted = await promptInstall();
    // Rifiutato dalla finestra del browser: vale come "non ora".
    if (!accepted) rememberInstallDismissed();
    setOpen(false);
  };

  if (mode === null) return null;

  return (
    <Sheet
      open={open}
      onClose={dismiss}
      title={t("install_title")}
      className="install-prompt"
      footer={
        mode === "native" ? (
          <>
            <Button variant="neutral" block onClick={dismiss}>
              {t("install_later")}
            </Button>
            <Button block icon="ph-bold ph-download-simple" onClick={install}>
              {t("install_action")}
            </Button>
          </>
        ) : (
          <Button variant="neutral" block onClick={dismiss}>
            {t("install_got_it")}
          </Button>
        )
      }
    >
      <div className="install-prompt__head">
        <img
          className="install-prompt__icon"
          src="/apple-touch-icon.png"
          alt=""
          width={56}
          height={56}
        />
        <p className="install-prompt__text">{t("install_intro")}</p>
      </div>

      {mode === "ios" && (
        <ol className="install-prompt__steps">
          <li>
            {t("install_ios_step_share")}{" "}
            <i className="ph-bold ph-export" aria-label={t("install_share")} />
          </li>
          <li>{t("install_ios_step_add")}</li>
          <li>{t("install_ios_step_confirm")}</li>
        </ol>
      )}

      {mode === "android_manual" && (
        <ol className="install-prompt__steps">
          <li>
            {t("install_android_step_menu")}{" "}
            <i
              className="ph-bold ph-dots-three-vertical"
              aria-label={t("install_menu")}
            />
          </li>
          <li>{t("install_android_step_add")}</li>
        </ol>
      )}
    </Sheet>
  );
}
