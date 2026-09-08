"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

/** Minimum Supabase allows is 6; 10 with some variety is a meaningful floor. */
const MIN_PASSWORD_LENGTH = 10;

/**
 * Rejects the passwords that actually get broken: too short, single
 * character class, or one of the handful everyone tries first. Supabase
 * still enforces its own rules server-side; this is the fast, clear failure.
 */
function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) {
    return "Use at least three of: lowercase, uppercase, numbers, symbols.";
  }
  const common = ["password", "12345678", "qwerty", "letmein", "welcome", "iloveyou", "admin"];
  if (common.some((c) => password.toLowerCase().includes(c))) {
    return "That password is too easy to guess.";
  }
  return null;
}

type Mode = "login" | "signup";
type Step = "credentials" | "verify";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Someone already signed in has no business on the login screen.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
    });
  }, [router]);

  // Supabase rate-limits resends server-side; this stops the user hammering
  // the button and getting an opaque error back.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  async function handleSubmitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // A stray space or a capital letter should not read as wrong password.
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }
    setLoading(true);

    if (mode === "signup") {
      const problem = passwordProblem(password);
      if (problem) {
        setLoading(false);
        setError(problem);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }

      // Supabase does not error on a duplicate signup — that would let
      // anyone enumerate registered emails. It returns a user with no
      // identities instead, which is the only way to tell.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMode("login");
        setError("That email already has an account. Log in instead.");
        return;
      }

      // With email confirmation switched off, signUp returns a live session
      // and no code is ever sent — sending the user to the code step would
      // strand them waiting for an email that never arrives.
      if (data.session) {
        router.push("/dashboard");
        return;
      }

      setStep("verify");
      setResendCooldown(30);
      setInfo("We sent a verification code to your email. It expires in 15 minutes.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/dashboard");
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "signup",
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
  }

  async function handleResendCode() {
    setError(null);
    setInfo(null);
    if (resendCooldown > 0) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });
    if (error) {
      setError(error.message);
      return;
    }
    setResendCooldown(30);
    setInfo("A new code has been sent.");
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#000", color: "#fff", fontFamily: "'Montserrat', Arial, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
      <Link href="/" style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
  <img src="/logo.png" alt="Kinema" style={{ width: 160, height: 160, cursor: "pointer" }} />
</Link>

        {step === "credentials" && (
          <>
            <div style={{ display: "flex", marginBottom: 28, borderRadius: 8, overflow: "hidden", border: "1px solid #333" }}>
              <button
                onClick={() => { setMode("login"); setError(null); }}
                style={{
                  flex: 1, padding: "10px 0", background: mode === "login" ? "#6b0016" : "transparent",
                  color: "#fff", border: "none", cursor: "pointer", fontWeight: 600,
                }}
              >
                Login
              </button>
              <button
                onClick={() => { setMode("signup"); setError(null); }}
                style={{
                  flex: 1, padding: "10px 0", background: mode === "signup" ? "#6b0016" : "transparent",
                  color: "#fff", border: "none", cursor: "pointer", fontWeight: 600,
                }}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmitCredentials} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                type="email"
                required
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                aria-label="Email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff" }}
              />
              <input
                type="password"
                required
                minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : 6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                aria-label="Password"
                aria-describedby={mode === "signup" ? "password-requirements" : undefined}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff" }}
              />
              {mode === "signup" && (
                <p
                  id="password-requirements"
                  style={{ color: "#8a8a8a", fontSize: "0.78rem", margin: 0, lineHeight: 1.5 }}
                >
                  At least {MIN_PASSWORD_LENGTH} characters, mixing three of: lowercase,
                  uppercase, numbers, symbols.
                </p>
              )}
              {error && (
                <p role="alert" style={{ color: "#e07b7b", fontSize: "0.85rem", margin: 0 }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                style={{ marginTop: 8, padding: "12px 0", borderRadius: 8, border: "none", background: "#6b0016", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
              </button>
            </form>
          </>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: "#bdbdbd", fontSize: "0.9rem", textAlign: "center" }}>
              {info}
            </p>
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              aria-label="Verification code"
              placeholder="Verification code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff", textAlign: "center", letterSpacing: "4px", fontSize: "1.1rem" }}
            />
            {error && <p style={{ color: "#e07b7b", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ padding: "12px 0", borderRadius: 8, border: "none", background: "#6b0016", color: "#fff", fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCooldown > 0}
              style={{
                background: "none",
                border: "none",
                color: resendCooldown > 0 ? "#555" : "#888",
                fontSize: "0.85rem",
                cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                textDecoration: "underline",
              }}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
