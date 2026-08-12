import sanitizeHtml from "sanitize-html";

/**
 * Recursively sanitizes every string in an object/array.
 * Removes HTML tags and dangerous JavaScript.
 */
const sanitizeData = (value) => {

    if (Array.isArray(value)) {
        return value.map(sanitizeData);
    }

    if (value !== null && typeof value === "object") {

        const result = {};

        for (const key of Object.keys(value)) {
            result[key] = sanitizeData(value[key]);
        }

        return result;
    }

    if (typeof value === "string") {

        return sanitizeHtml(value, {

            // Remove every HTML tag
            allowedTags: [],

            // Remove every HTML attribute
            allowedAttributes: {},

            // Remove dangerous tags completely
            disallowedTagsMode: "discard",

            // Allowed URL protocols if HTML is ever allowed later
            allowedSchemes: [
                "http",
                "https",
                "mailto",
                "tel"
            ]

        })
            .trim()
            .replace(/\s+/g, " ");
    }

    return value;
};

export default sanitizeData;