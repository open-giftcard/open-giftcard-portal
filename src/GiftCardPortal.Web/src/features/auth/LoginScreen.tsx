import { useState, type FormEvent } from "react";
import {
  Button,
  FieldError,
  Input,
  Label,
  TextField,
} from "react-aria-components";
import { useTranslation } from "../../i18n/translate";

interface LoginScreenProps {
  isPending: boolean;
  errorMessage?: string;
  onLogin: (email: string, password: string) => void;
}

export function LoginScreen({
  isPending,
  errorMessage,
  onLogin,
}: LoginScreenProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      return;
    }

    onLogin(email.trim(), password);
  }

  return (
    <main id="main-content" className="auth-layout">
      <section className="auth-intro" aria-labelledby="welcome-title">
        <p className="eyebrow">{t("Corporate services")}</p>
        <h1 id="welcome-title" className="display-title">
          {t("Your gift card workspace, securely connected.")}
        </h1>
        <p className="auth-intro__copy">
          {t(
            "Sign in with your staff account. Your organizations and access are supplied directly by the platform.",
          )}
        </p>
        <ul className="trust-list" aria-label={t("Security commitments")}>
          <li>{t("No access tokens in browser storage")}</li>
          <li>{t("No organization IDs to copy or paste")}</li>
          <li>{t("Access is always verified by the platform")}</li>
        </ul>
      </section>

      <section className="auth-card" aria-labelledby="sign-in-title">
        <p className="eyebrow">{t("Secure access")}</p>
        <h2 id="sign-in-title" className="section-title">
          {t("Sign in")}
        </h2>
        <p className="supporting-copy">
          {t("Use your staff email and password.")}
        </p>

        <form className="form-stack" onSubmit={submit} noValidate>
          <TextField
            className="field"
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
            isRequired
            isDisabled={isPending}
          >
            <Label className="field__label">{t("Email address")}</Label>
            <Input
              className="field__input"
              autoComplete="username"
              inputMode="email"
            />
            <FieldError className="field__error">
              {t("Enter a valid email address.")}
            </FieldError>
          </TextField>

          <TextField
            className="field"
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            isRequired
            isDisabled={isPending}
          >
            <Label className="field__label">{t("Password")}</Label>
            <Input className="field__input" autoComplete="current-password" />
            <FieldError className="field__error">
              {t("Enter your password.")}
            </FieldError>
          </TextField>

          <div className="form-message" aria-live="polite">
            {errorMessage ? (
              <p className="error-banner" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <Button
            className="button button--primary button--full"
            type="submit"
            isDisabled={isPending || !email.trim() || !password}
          >
            {isPending ? t("Signing in…") : t("Sign in securely")}
          </Button>
        </form>
      </section>
    </main>
  );
}
