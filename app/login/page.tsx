"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Link from "next/link";

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

  async function handleSubmitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setStep("verify");
      setInfo("We sent a verification code to your email. It expires in 15 minutes.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      email,
      token: code,
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
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (error) {
      setError(error.message);
      return;
    }
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
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff" }}
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #333", background: "#111", color: "#fff" }}
              />
              {error && <p style={{ color: "#e07b7b", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
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
              style={{ background: "none", border: "none", color: "#888", fontSize: "0.85rem", cursor: "pointer", textDecoration: "underline" }}
            >
              Resend code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
