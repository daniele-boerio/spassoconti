import { ReactNode, useEffect, useState } from "react";
import { useI18n } from "../../i18n/use-i18n";
import { useAppDispatch, useAppSelector } from "../../store/store";
import Sheet from "../../components/sheet/sheet";
import Button from "../../components/button/button";
import { showToast } from "../../features/ui/ui_slice";
import {
  disableTwoFactor,
  enableTwoFactor,
  regenerateRecoveryCodes,
  setupTwoFactor,
} from "../../features/profile/api_calls";
import { selectTwoFactor } from "../../features/profile/profile_slice";
import { TwoFactorSetup } from "../../features/profile/interfaces";

/**
 * Passi dello sheet:
 * - intro → setup (segreto + primo codice) → codes (codici di recupero);
 * - manage (già attiva) → regenerate (codice) → codes, oppure → disable.
 */
type Step = "intro" | "setup" | "codes" | "manage" | "regenerate" | "disable";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function TwoFactorSheet({ open, onClose }: Props) {
  const { t } = useI18n();
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectTwoFactor);

  const [step, setStep] = useState<Step>("intro");
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Ogni apertura riparte pulita: segreto e codici restano in memoria solo
  // finché servono, mai nello store.
  useEffect(() => {
    if (!open) return;
    setStep(status?.enabled ? "manage" : "intro");
    setSetup(null);
    setQr(null);
    setCode("");
    setPassword("");
    setCodes([]);
    // Solo all'apertura: lo stato cambia proprio per effetto dei passi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Il QR serve a chi configura da computer e inquadra col telefono. La
  // libreria si carica solo qui.
  useEffect(() => {
    if (!setup) return;
    let cancelled = false;
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(setup.otpauth_uri, { margin: 1, width: 220 }),
      )
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        // Senza QR restano il link e il segreto da copiare.
      });
    return () => {
      cancelled = true;
    };
  }, [setup]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      // L'errore lo mostra già l'errorMiddleware (es. codice sbagliato).
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      const result = await dispatch(setupTwoFactor()).unwrap();
      setSetup(result);
      setStep("setup");
    });

  const enable = () =>
    run(async () => {
      const result = await dispatch(enableTwoFactor(code.trim())).unwrap();
      setCodes(result.recovery_codes);
      setCode("");
      setStep("codes");
    });

  const regenerate = () =>
    run(async () => {
      const result = await dispatch(regenerateRecoveryCodes(code.trim())).unwrap();
      setCodes(result.recovery_codes);
      setCode("");
      setStep("codes");
    });

  const disable = () =>
    run(async () => {
      await dispatch(disableTwoFactor({ password, code: code.trim() })).unwrap();
      dispatch(showToast({ variant: "success", title: t("two_factor_disabled") }));
      onClose();
    });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      dispatch(showToast({ variant: "success", title: t("copied") }));
    } catch {
      // Clipboard negata: il testo resta selezionabile a mano.
    }
  };

  const validAppCode = /^\d{6}$/.test(code.trim());
  // Per disattivare vale anche un codice di recupero.
  const validAnyCode = validAppCode || code.trim().length >= 10;

  const codeField = (label: string, allowRecovery: boolean) => (
    <label className="two-factor__field">
      <span className="two-factor__label">{label}</span>
      <input
        className="two-factor__input"
        type="text"
        inputMode={allowRecovery ? "text" : "numeric"}
        autoComplete="one-time-code"
        placeholder="123456"
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
    </label>
  );

  let body: ReactNode = null;
  let footer: ReactNode = null;

  if (step === "intro") {
    body = <p className="two-factor__text">{t("two_factor_intro")}</p>;
    footer = (
      <Button block disabled={busy} onClick={startSetup}>
        {t("two_factor_start")}
      </Button>
    );
  }

  if (step === "setup" && setup) {
    body = (
      <>
        <p className="two-factor__text">{t("two_factor_setup_hint")}</p>

        <a className="two-factor__open" href={setup.otpauth_uri}>
          <i className="ph-bold ph-arrow-square-out" aria-hidden="true" />
          {t("two_factor_open_app")}
        </a>

        {qr && (
          <figure className="two-factor__qr">
            <img src={qr} alt={t("two_factor_qr_alt")} width={180} height={180} />
            <figcaption>{t("two_factor_qr_hint")}</figcaption>
          </figure>
        )}

        <button
          type="button"
          className="two-factor__secret"
          onClick={() => copy(setup.secret)}
        >
          <span className="two-factor__label">{t("two_factor_secret")}</span>
          <code>{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code>
          <i className="ph-bold ph-copy" aria-hidden="true" />
        </button>

        {codeField(t("two_factor_first_code"), false)}
      </>
    );
    footer = (
      <Button block disabled={busy || !validAppCode} onClick={enable}>
        {t("two_factor_enable")}
      </Button>
    );
  }

  if (step === "codes") {
    body = (
      <>
        <p className="two-factor__text">{t("two_factor_codes_hint")}</p>
        <ul className="two-factor__codes">
          {codes.map((recoveryCode) => (
            <li key={recoveryCode}>
              <code>{recoveryCode}</code>
            </li>
          ))}
        </ul>
      </>
    );
    footer = (
      <>
        <Button variant="neutral" block onClick={() => copy(codes.join("\n"))}>
          {t("two_factor_copy_codes")}
        </Button>
        <Button block onClick={onClose}>
          {t("two_factor_codes_saved")}
        </Button>
      </>
    );
  }

  if (step === "manage") {
    body = (
      <>
        <p className="two-factor__text">
          {t("two_factor_active")} · {status?.recovery_codes_remaining ?? 0}{" "}
          {t("two_factor_codes_left")}
        </p>
        <div className="two-factor__actions">
          <Button variant="neutral" block onClick={() => setStep("regenerate")}>
            {t("two_factor_new_codes")}
          </Button>
          <Button variant="danger" block onClick={() => setStep("disable")}>
            {t("two_factor_disable")}
          </Button>
        </div>
      </>
    );
  }

  if (step === "regenerate") {
    body = (
      <>
        <p className="two-factor__text">{t("two_factor_new_codes_hint")}</p>
        {codeField(t("two_factor_code"), false)}
      </>
    );
    footer = (
      <Button block disabled={busy || !validAppCode} onClick={regenerate}>
        {t("two_factor_new_codes")}
      </Button>
    );
  }

  if (step === "disable") {
    body = (
      <>
        <p className="two-factor__text">{t("two_factor_disable_hint")}</p>
        <label className="two-factor__field">
          <span className="two-factor__label">{t("password")}</span>
          <input
            className="two-factor__input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {codeField(t("two_factor_code_or_recovery"), true)}
      </>
    );
    footer = (
      <Button
        variant="danger"
        block
        disabled={busy || !password || !validAnyCode}
        onClick={disable}
      >
        {t("two_factor_disable")}
      </Button>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("two_factor_title")}
      footer={footer}
      className="two-factor"
    >
      {body}
    </Sheet>
  );
}
