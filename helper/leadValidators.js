import { isValidEmail, isValidPhone, isValidPincode, isValidName, isValidText } from "../utils/validators.js";

const ALLOWED_COUNTRY_CODES = ["+91"]; 

export function validatePopupLead(body) {
  const errors = {};
  const clean = {};

  if (!body || typeof body !== "object") {
    return { valid: false, errors: { _: "Invalid request body" }, clean: null };
  }

  const { name, countryCode, phone, query } = body;

  if (!isValidName(name)) errors.name = "Enter a valid name (2-50 letters)";
  else clean.name = name.trim();

  const cc = typeof countryCode === "string" ? countryCode.trim() : "+91";
  if (!ALLOWED_COUNTRY_CODES.includes(cc)) errors.countryCode = "Unsupported country code";
  else clean.countryCode = cc;

  if (!isValidPhone(phone)) errors.phone = "Enter a valid 10-digit mobile number";
  else clean.phone = phone.trim();

  if (!isValidText(query, { min: 3, max: 1000, required: true })) errors.query = "Tell us what you need (3-1000 chars)";
  else clean.details = query.trim(); // mapped into `details` column

  clean.source = "monsoon_makeover_popup"; // never trust client-sent source

  return { valid: Object.keys(errors).length === 0, errors, clean };
}

export function validateContactSectionLead(body) {
  const errors = {};
  const clean = {};

  if (!body || typeof body !== "object") {
    return { valid: false, errors: { _: "Invalid request body" }, clean: null };
  }

  const { name, email, company, phone, service, details } = body;

  const ALLOWED_SERVICES = [
    "INTERIOR DESIGN",
    "INTERIOR ARCHITECTURE",
    "CONSTRUCTION",
    "THE LIVING SYSTEM",
    "PROJECT MANAGEMENT",
    "PORTFOLIO",
  ];

  if (!isValidName(name)) errors.name = "Enter a valid name (2-100 letters)";
  else clean.name = name.trim();

  if (!isValidEmail(email)) errors.email = "Enter a valid email address";
  else clean.email = email.trim().toLowerCase();

  // phone optional on this form
  if (phone !== undefined && phone !== null && phone !== "") {
    if (!isValidPhone(phone)) errors.phone = "Enter a valid 10-digit mobile number";
    else clean.phone = phone.trim();
  } else {
    errors.phone = "Phone number is required"; // your DB column is non-nullable
  }

  if (!isValidText(company, { max: 150 })) errors.company = "Company name too long";
  else if (company) clean.company = company.trim();

  if (service !== undefined && service !== null && service !== "") {
    if (!ALLOWED_SERVICES.includes(service)) errors.service = "Invalid service selected";
  }

  if (!isValidText(details, { max: 2000 })) errors.details = "Details too long (max 2000 chars)";

  // Combine service + details into the single `details` column, since schema has no `service` field
  const detailsParts = [];
  if (service && ALLOWED_SERVICES.includes(service)) detailsParts.push(`Service: ${service}`);
  if (details && details.trim()) detailsParts.push(details.trim());
  clean.details = detailsParts.length ? detailsParts.join(" | ") : null;

  clean.source = "contact_section"; // never trust client-sent source

  return { valid: Object.keys(errors).length === 0, errors, clean };
}