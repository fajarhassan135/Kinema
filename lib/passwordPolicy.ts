/** Minimum Supabase allows is 6; 10 with some variety is a meaningful floor. */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Rejects the passwords that actually get broken: too short, single character
 * class, or one of the handful everyone tries first. Supabase still enforces
 * its own rules server-side; this is the fast, clear failure.
 *
 * Shared so every entry point agrees. The profile page used to accept six
 * characters, which let an account be weakened after signup.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(password)
  ).length;
  if (classes < 3) {
    return "Use at least three of: lowercase, uppercase, numbers, symbols.";
  }
  const common = [
    "password",
    "12345678",
    "qwerty",
    "letmein",
    "welcome",
    "iloveyou",
    "admin",
  ];
  if (common.some((c) => password.toLowerCase().includes(c))) {
    return "That password is too easy to guess.";
  }
  return null;
}
