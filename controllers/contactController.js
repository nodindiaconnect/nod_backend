import prisma from "../config/prismaClient.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\d{7,10}$/;
const PINCODE_RE = /^\d{6}$/;

class ContactController {

    static async submitContactLead(req, res) {
        try {
            const {
                name,
                email,
                countryCode = "+91",
                phone,
                pincode,
                company,
                details,
                source = "other",
            } = req.body || {};


            // Validation
            const errors = {};

            if (!name || typeof name !== "string" || name.trim().length < 2) {
                errors.name = "Enter a valid name";
            }

            if (!phone || !PHONE_RE.test(String(phone).trim())) {
                errors.phone = "Enter a valid phone number";
            }

            if (email && !EMAIL_RE.test(String(email).trim())) {
                errors.email = "Enter a valid email address";
            }

            if (pincode && !PINCODE_RE.test(String(pincode).trim())) {
                errors.pincode = "Enter a valid 6-digit pincode";
            }


            if (Object.keys(errors).length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors,
                });
            }


            // Create Lead
            const lead = await prisma.contactLead.create({
                data: {
                    name: name.trim(),

                    email: email
                        ? email.trim()
                        : null,

                    countryCode: countryCode?.trim() || "+91",

                    phone: phone.trim(),

                    pincode: pincode
                        ? pincode.trim()
                        : null,

                    company: company
                        ? company.trim()
                        : null,

                    details: details
                        ? details.trim()
                        : null,

                    source,

                    status: "new",

                    ip: req.ip,

                    userAgent: req.get("user-agent") || null,
                },
            });


            return res.status(201).json({
                success: true,
                message: "Thanks! Our team will reach out shortly.",
                data: {
                    id: lead.id,
                    name: lead.name,
                    phone: lead.phone,
                    createdAt: lead.createdAt,
                },
            });


        } catch (error) {

            console.error(
                "submitContactLead error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Something went wrong. Please try again.",
            });
        }
    }

}


export default ContactController;