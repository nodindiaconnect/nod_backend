import sanitizeData from "../utils/sanitizeHtml.js";

export const sanitizeRequest = (req, res, next) => {

    if (req.body) {
        req.body = sanitizeData(req.body);
    }

    if (req.query) {
        Object.assign(req.query, sanitizeData(req.query));
    }

    if (req.params) {
        Object.assign(req.params, sanitizeData(req.params));
    }

    next();
};