"use client";
import { useState } from "react";

/**
 * Password input with a show/hide toggle.
 *
 * Typing a long password blind is where people give up or mistype, so every
 * password box in the app gets the same eye button. One component rather than
 * three copies, so the behaviour and the accessible labelling stay identical.
 */
export default function PasswordField({
  value,
  onChange,
  placeholder = "Password",
  ariaLabel = "Password",
  ariaDescribedBy,
  autoComplete = "current-password",
  minLength,
  required = false,
  fill = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  /** Stretch to fill a flex row (the profile page puts a button beside it). */
  fill?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", display: "flex", flex: fill ? 1 : undefined }}>
      <input
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "12px 46px 12px 14px",
          borderRadius: 8,
          border: "1px solid #333",
          background: "#111",
          color: "#fff",
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          background: "none",
          border: "none",
          borderRadius: 8,
          color: visible ? "#c9a227" : "#8a8a8a",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {visible ? (
          // Eye with a slash — currently visible, click to hide.
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 002.8 2.8" />
            <path d="M9.4 5.3A9.6 9.6 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.4 3.4" />
            <path d="M6.3 6.9C4 8.4 3 10.6 3 12c0 2.5 4 7 9 7a9.4 9.4 0 004-.9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
        )}
      </button>
    </div>
  );
}
