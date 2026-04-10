import { type FormEvent, useEffect, useState } from "react";

export type LoginCredentials = {
  identifier: string;
  password: string;
  rememberSession: boolean;
};

export type DevelopmentLoginAccountHint = {
  label: string;
  identifier: string;
  password: string;
  accessTier: "super-admin" | "admin";
};

export function LoginScreen({
  onSubmit,
  errorMessage,
  isSubmitting = false,
  developmentAccounts = [],
}: {
  onSubmit?: (credentials: LoginCredentials) => void | Promise<void>;
  errorMessage?: string;
  isSubmitting?: boolean;
  developmentAccounts?: DevelopmentLoginAccountHint[];
}) {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    identifier: "",
    password: "",
    rememberSession: false,
  });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    document.title = "Login | Ghaniya Tour and Travel";
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit?.(credentials);
  };

  return (
    <main className="flex min-h-screen bg-surface text-on-surface">
      <section className="relative hidden w-1/2 overflow-hidden border-r border-outline-variant/20 bg-surface-container-low p-12 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="serene-login-pattern absolute inset-0" aria-hidden="true" />

        <div className="relative z-10 flex max-w-md flex-col items-center space-y-8 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-primary shadow-float">
            <span
              className="material-symbols-outlined text-5xl text-white"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
              aria-hidden="true"
            >
              travel_explore
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="font-display text-5xl font-extrabold leading-tight tracking-tight text-primary-container">
              Ghaniya Tour and Travel
            </h1>
            <p className="px-4 text-xl leading-relaxed text-on-surface-variant">
              Manage your travel and Umrah operations with clarity and ease.
            </p>
          </div>

          <div className="h-1 w-16 rounded-full bg-primary/20" aria-hidden="true" />

          <div className="grid w-full grid-cols-2 gap-4 pt-8">
            <article className="flex flex-col items-start space-y-2 rounded-xl bg-surface-container-lowest p-6 text-left shadow-ambient">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">
                flight_takeoff
              </span>
              <span className="text-sm font-semibold text-on-surface">Travel Coordination</span>
            </article>

            <article className="flex flex-col items-start space-y-2 rounded-xl bg-surface-container-lowest p-6 text-left shadow-ambient">
              <span className="material-symbols-outlined text-primary" aria-hidden="true">
                mosque
              </span>
              <span className="text-sm font-semibold text-on-surface">Umrah Assistance</span>
            </article>
          </div>
        </div>

        <p className="absolute bottom-8 text-xs font-medium text-on-surface-variant/70">
          (c) 2024 Ghaniya Tour and Travel. Built for Excellence.
        </p>
      </section>

      <section className="flex w-full items-center justify-center bg-surface p-6 sm:p-12 md:p-24 lg:w-1/2">
        <div className="w-full max-w-md space-y-8 text-center lg:text-left">
          <div className="mb-8 flex justify-center lg:hidden">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary">
              <span
                className="material-symbols-outlined text-3xl text-white"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
                aria-hidden="true"
              >
                travel_explore
              </span>
            </div>
          </div>

          <header>
            <h2 className="font-display text-3xl font-bold text-on-surface">Welcome Back</h2>
            <p className="mt-2 text-on-surface-variant">Please login to continue to your dashboard.</p>
          </header>

          <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-8 text-left shadow-ambient">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <label className="block space-y-2" htmlFor="login-identifier">
                <span className="block text-sm font-semibold text-on-surface-variant">
                  Email or Username
                </span>
                <span className="group relative block">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-outline-variant transition-colors group-focus-within:text-primary">
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      person
                    </span>
                  </span>
                  <input
                    id="login-identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. operator@alrawda.com"
                    value={credentials.identifier}
                    onChange={(event) =>
                      setCredentials((current) => ({
                        ...current,
                        identifier: event.target.value,
                      }))
                    }
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-lg border border-outline-variant/45 bg-surface-container-low pl-10 pr-4 text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/55 focus:border-primary/55 focus:ring-2 focus:ring-primary/20"
                  />
                </span>
              </label>

              <label className="block space-y-2" htmlFor="login-password">
                <span className="flex items-center justify-between">
                  <span className="block text-sm font-semibold text-on-surface-variant">Password</span>
                  <a href="#" className="text-xs font-semibold text-primary transition-colors hover:text-primary-container">
                    Forgot Password?
                  </a>
                </span>
                <span className="group relative block">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-outline-variant transition-colors group-focus-within:text-primary">
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      lock
                    </span>
                  </span>
                  <input
                    id="login-password"
                    name="password"
                    type={isPasswordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="********"
                    value={credentials.password}
                    onChange={(event) =>
                      setCredentials((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-lg border border-outline-variant/45 bg-surface-container-low pl-10 pr-12 text-sm text-on-surface outline-none transition-all placeholder:text-on-surface-variant/55 focus:border-primary/55 focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-outline-variant transition-colors hover:text-on-surface"
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                    disabled={isSubmitting}
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      {isPasswordVisible ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </span>
              </label>

              <label className="flex items-center gap-3 text-sm font-medium text-on-surface-variant" htmlFor="login-remember">
                <input
                  id="login-remember"
                  name="remember"
                  type="checkbox"
                  className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary focus:ring-offset-0"
                  checked={credentials.rememberSession}
                  onChange={(event) =>
                    setCredentials((current) => ({
                      ...current,
                      rememberSession: event.target.checked,
                    }))
                  }
                  disabled={isSubmitting}
                />
                Keep me logged in
              </label>

              {errorMessage ? (
                <div
                  className="rounded-lg border border-error-container/70 bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container"
                  role="alert"
                  aria-live="assertive"
                >
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                aria-label={isSubmitting ? "Signing in" : "Login to Dashboard"}
                className="flex w-full items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-container active:scale-[0.99] disabled:opacity-70"
              >
                <span>{isSubmitting ? "Signing In..." : "Login"}</span>
              </button>
            </form>
          </div>

          {developmentAccounts.length > 0 ? (
            <section className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-5 text-center text-xs text-on-surface-variant lg:text-left">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                Development Accounts
              </p>
              <div className="mt-3 space-y-3">
                {developmentAccounts.map((account) => (
                  <article key={account.identifier} className="rounded-lg border border-outline-variant/15 p-3 text-left">
                    <p className="font-semibold text-on-surface">
                      {account.label} ({account.accessTier})
                    </p>
                    <p className="mt-1 font-mono text-[11px]">ID: {account.identifier}</p>
                    <p className="font-mono text-[11px]">PW: {account.password}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <p className="pt-4 text-center text-sm text-on-surface-variant">
            Don&apos;t have an account?{" "}
            <a href="#" className="font-bold text-primary hover:underline">
              Contact Administrator
            </a>
          </p>

          <div className="flex items-center justify-center gap-4 pt-12 text-outline-variant">
            <a href="#" className="flex items-center gap-1 text-xs transition-colors hover:text-on-surface">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                help
              </span>
              <span>Support Center</span>
            </a>
            <span className="text-outline-variant/30" aria-hidden="true">
              |
            </span>
            <a href="#" className="flex items-center gap-1 text-xs transition-colors hover:text-on-surface">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                language
              </span>
              <span>English (US)</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
