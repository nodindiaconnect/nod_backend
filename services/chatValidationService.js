/**
 * Chat Message Validation Service
 * Enforces platform communication safety and restricts off-platform contact sharing.
 */
class ChatValidationService {
    /**
     * Validate chat message text and attachments
     * @param {string} text - Message text content
     * @param {Array} attachments - Optional list of file/media URLs
     * @returns {{ isValid: boolean, sanitizedText: string }}
     * @throws {Error} If message violates safety policies
     */
    static validateMessage(text = "", attachments = []) {
        const rawText = typeof text === "string" ? text.trim() : "";

        // 1. Enforce no file attachments in chat
        if (Array.isArray(attachments) && attachments.length > 0) {
            throw new Error("File attachments are disabled in chat.");
        }

        // 2. Check for empty message
        if (!rawText) {
            throw new Error("Message cannot be empty. Please enter your message.");
        }

        // 3. Reject messages consisting only of numbers or punctuation with numbers (e.g., "1", "123", "9999", "...", "1.")
        // Also reject single-number or meaningless numeric spam
        const numericOnlyRegex = /^[\d\s.,\-–—_/\\#+*()%$@!?:;'"~`^&=[\]{}|<>]+$/;
        if (numericOnlyRegex.test(rawText)) {
            throw new Error("Number-only or meaningless inputs are not permitted. Please write a descriptive message.");
        }

        // Check that text contains at least some alphabetic characters
        const alphaMatch = rawText.match(/[a-zA-Z]/g);
        if (!alphaMatch || alphaMatch.length < 2) {
            throw new Error("Please write a descriptive message with valid text.");
        }

        // 4. URL and External Website Link Detection
        const urlPatterns = [
            /https?:\/\/[^\s]+/i,
            /www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/i,
            /\b[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:com|in|org|net|co|io|ai|app|biz|info|xyz|site|online|tech|store|dev|me|club|live|link|pro|top|vip|us|uk|ca|au|de|fr|jp|ru|cn|tv|cc|to|space|fun|cloud|gov|edu)(?:\/[^\s]*)?\b/i,
            /\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|adf\.ly|bitly\.com)\b/i,
            /(?:https?|ftp)\s*:\s*\/\s*\//i,
            /[a-zA-Z0-9-]+\s*\.\s*(?:com|in|org|net|co|io|ai|app|xyz|site|online|tech|dev)\b/i,
        ];

        for (const pattern of urlPatterns) {
            if (pattern.test(rawText)) {
                throw new Error("Sharing website links or external URLs in chat is restricted for platform safety.");
            }
        }

        // 3. Email Address Detection
        // Standard email regex + obfuscated formats like "user at domain dot com", "user[at]domain[dot]com"
        const standardEmailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
        const obfuscatedEmailRegex = /[a-zA-Z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|at)\s*[a-zA-Z0-9.-]+\s*(?:\.|\bdot\b|\[dot\]|\(dot\))\s*(?:com|in|org|net|co|io|ai|me|info|biz)/i;

        if (standardEmailRegex.test(rawText) || obfuscatedEmailRegex.test(rawText)) {
            throw new Error("Sharing email addresses in workspace chat is restricted for platform safety.");
        }

        // 4. Phone / Mobile Number Detection
        // Detects 10-digit Indian numbers, international formats with country codes (+91, 0091),
        // spaced/hyphenated sequences (e.g. 98765 43210, 987-654-3210, +91 9876543210, (123) 456-7890)
        // Also catches strings where 7 to 15 digits are separated by spaces or punctuation
        const phonePatterns = [
            /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, // standard 10 digit (XXX-XXX-XXXX or (XXX) XXX-XXXX)
            /(?:\+91[\s-]?)?[6-9]\d{9}/, // Indian 10-digit mobile starting with 6,7,8,9
            /(?:\+?\d{1,4}[-.\s]?)?(?:\d[-.\s]?){9,14}\d/, // sequence of 10-15 digits with spaces/dots/dashes
        ];

        for (const pattern of phonePatterns) {
            if (pattern.test(rawText)) {
                throw new Error("Sharing phone or contact numbers in workspace chat is restricted for platform safety.");
            }
        }

        // 5. Spelled-out phone numbers (e.g., "nine eight seven six...")
        const digitWordsRegex = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b(?:\s*,\s*|\s+)?\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b(?:\s*,\s*|\s+)?\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b(?:\s*,\s*|\s+)?\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\b/i;
        if (digitWordsRegex.test(rawText)) {
            throw new Error("Sharing contact numbers in workspace chat is restricted for platform safety.");
        }

        // 6. Off-platform Communication Channels & Social Handles
        const offPlatformKeywords = [
            /\b(?:whatsapp|what's\s*app|whats\s*app|wapp)\b/i,
            /\b(?:telegram|tg\s*me|t\.me)\b/i,
            /\b(?:instagram|insta|dm\s*me)\b/i,
            /\b(?:wa\.me|api\.whatsapp\.com)\b/i,
            /\b(?:call\s*me\s*at|call\s*me\s*on|reach\s*me\s*at|contact\s*me\s*on|my\s*number\s*is|my\s*num\s*is|ping\s*me\s*on)\b/i,
        ];

        for (const keyword of offPlatformKeywords) {
            if (keyword.test(rawText)) {
                throw new Error("Off-platform contact or external communication requests are restricted. Please communicate within the workspace.");
            }
        }

        return {
            isValid: true,
            sanitizedText: rawText,
        };
    }
}

export default ChatValidationService;
