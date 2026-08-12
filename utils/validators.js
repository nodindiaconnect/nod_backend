const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile: 10 digits, starts 6-9
const PINCODE_RE = /^\d{6}$/;
const NAME_RE = /^[a-zA-Z\s.'-]{2,50}$/;
const USERNAME_RE = /^[A-Za-z0-9_.]{3,30}$/;// At least 8 chars, one uppercase, one lowercase, one digit, one special char
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,64}$/;

export const isValidEmail = (v) => typeof v === "string" && EMAIL_RE.test(v.trim());
export const isValidPhone = (v) => typeof v === "string" && PHONE_RE.test(v.trim());
export const isValidPincode = (v) => typeof v === "string" && PINCODE_RE.test(v.trim());
export const isValidName = (v) => typeof v === "string" && NAME_RE.test(v.trim());
export const isValidUsername = (v) => typeof v === "string" && USERNAME_RE.test(v.trim());

// Password validated as-is (NOT trimmed) — leading/trailing spaces in a
// password are legitimate characters the user typed and must be preserved,
// unlike email/name/username where trimming stray whitespace is expected.
export const isValidPassword = (v) => typeof v === "string" && PASSWORD_RE.test(v);

// Generic bounded-length string check for free-text fields
export const isValidText = (v, { min = 0, max = 2000, required = false } = {}) => {
  if (v === undefined || v === null || v === "") return !required;
  if (typeof v !== "string") return false;
  const trimmed = v.trim();
  return trimmed.length >= min && trimmed.length <= max;
};