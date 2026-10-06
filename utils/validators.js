const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile: 10 digits, starts 6-9
const PINCODE_RE = /^\d{6}$/;
const NAME_RE = /^[a-zA-Z\s.'-]{2,50}$/;
const USERNAME_RE = /^[A-Za-z0-9_.]{3,30}$/;// At least 8 chars, one uppercase, one lowercase, one digit, one special char
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,64}$/;

export const isValidEmail = (v) => typeof v === "string" && EMAIL_RE.test(v.trim());
// Allow any non-empty phone string (accepts international formats, spaces, dashes)
export const isValidPhone = (v) => typeof v === "string" && v.trim().length >= 4;
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

/**
 * Validates whether user-generated input contains email addresses, phone numbers,
 * or direct off-platform contact channels to prevent off-platform bypass.
 * @param {string} input - Any free-text or user-supplied string
 * @returns {{ hasContact: boolean, reason?: string }}
 */
export const containsContactInfo = (input) => {
  if (!input || typeof input !== "string") return { hasContact: false };
  const text = input.trim();
  if (!text) return { hasContact: false };

  // 1. Standard & obfuscated email patterns
  const standardEmailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  const obfuscatedEmailRegex = /[a-zA-Z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|\bat\b)\s*[a-zA-Z0-9.-]+\s*(?:\.|\bdot\b|\[dot\]|\(dot\))\s*(?:com|in|org|net|co|io|ai|me|info|biz|co\.in)/i;
  if (standardEmailRegex.test(text) || obfuscatedEmailRegex.test(text)) {
    return {
      hasContact: true,
      reason: "Sharing email addresses is restricted to ensure platform safety and security.",
    };
  }

  // 2. Phone / mobile number detection
  const phonePatterns = [
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, // standard 10 digit (XXX-XXX-XXXX)
    /(?:\+91[\s-]?)?[6-9]\d{9}/, // Indian 10-digit mobile starting with 6,7,8,9
    /(?:\+?\d{1,4}[-.\s]?)?(?:\d[-.\s]?){9,14}\d/, // sequence of 10-15 digits with spaces/dots/dashes
    /\b\d{5}\s+\d{5}\b/, // 5 digits space 5 digits
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    /(?:\b|\D)(?:\+?91|0091)?[6-9]\d{9}(?:\b|\D)/,
  ];

  for (const pattern of phonePatterns) {
    if (pattern.test(text)) {
      return {
        hasContact: true,
        reason: "Sharing phone or mobile numbers is restricted to protect user safety and prevent off-platform bypass.",
      };
    }
  }

  // Continuous digit check (10 or more digits total formatted together)
  const rawDigits = text.replace(/\D/g, "");
  if (rawDigits.length >= 10 && /\b(?:\d[\s.-]?){10,}\b/.test(text)) {
    return {
      hasContact: true,
      reason: "Sharing phone or contact numbers is restricted.",
    };
  }

  // 3. Spelled-out phone numbers (e.g. "nine eight seven six...")
  const digitWordsRegex = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b(?:\s*,\s*|\s+)?\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b(?:\s*,\s*|\s+)?\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b(?:\s*,\s*|\s+)?\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b/i;
  if (digitWordsRegex.test(text)) {
    return {
      hasContact: true,
      reason: "Sharing contact numbers is restricted.",
    };
  }

  // 4. Direct off-platform handles
  const offPlatformKeywords = [
    /\b(?:whatsapp|what's\s*app|whats\s*app|wapp)\b/i,
    /\b(?:telegram|tg\s*me|t\.me)\b/i,
    /\b(?:wa\.me|api\.whatsapp\.com)\b/i,
    /\b(?:call\s*me\s*at|call\s*me\s*on|reach\s*me\s*at|contact\s*me\s*on|my\s*number\s*is|my\s*num\s*is|ping\s*me\s*on)\b/i,
  ];

  for (const keyword of offPlatformKeywords) {
    if (keyword.test(text)) {
      return {
        hasContact: true,
        reason: "Off-platform contact or communication requests are not permitted.",
      };
    }
  }

  return { hasContact: false };
};