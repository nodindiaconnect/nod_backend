import prisma from "../config/prismaClient.js";
import emailService from "../helper/emailService.js";
import { validatePopupLead, validateContactSectionLead } from "../helper/leadValidators.js";
console.log(Object.getOwnPropertyNames(emailService));


const LEAD_NOTIFICATION_RECIPIENTS = ["nodindiaconnect@gmail.com"];

class ContactController {

    // POST /api/leads/popup
    static async submitPopupLead(req, res) {
        try {
            const { valid, errors, clean } = validatePopupLead(req.body);

            if (!valid) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors,
                });
            }

            const lead = await prisma.contactLead.create({
                data: {
                    name: clean.name,
                    countryCode: clean.countryCode,
                    phone: clean.phone,
                    details: clean.details,
                    source: clean.source,
                    status: "new",
                    ip: req.ip,
                    userAgent: req.get("user-agent") || null,
                },
            });

            try {
                await emailService.sendPopupLeadMail(lead, LEAD_NOTIFICATION_RECIPIENTS);
            } catch (emailErr) {
                console.error("Failed to send popup lead notification email:", emailErr.message);
            }

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
            console.error("submitPopupLead error:", error);
            return res.status(500).json({
                success: false,
                message: "Something went wrong. Please try again.",
            });
        }
    }

    // POST /api/leads/contact
    static async submitContactSectionLead(req, res) {
        try {
            const { valid, errors, clean } = validateContactSectionLead(req.body);

            if (!valid) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors,
                });
            }

            const lead = await prisma.contactLead.create({
                data: {
                    name: clean.name,
                    email: clean.email,
                    phone: clean.phone,
                    company: clean.company || null,
                    details: clean.details,
                    source: clean.source,
                    status: "new",
                    ip: req.ip,
                    userAgent: req.get("user-agent") || null,
                },
            });

            try {
                await emailService.sendContactSectionLeadMail(lead, LEAD_NOTIFICATION_RECIPIENTS);
            } catch (emailErr) {
                console.error("Failed to send contact-section lead notification email:", emailErr.message);
            }

            return res.status(201).json({
                success: true,
                message: "Thanks! Someone from our team will be in touch shortly.",
                data: {
                    id: lead.id,
                    name: lead.name,
                    email: lead.email,
                    createdAt: lead.createdAt,
                },
            });

        } catch (error) {
            console.error("submitContactSectionLead error:", error);
            return res.status(500).json({
                success: false,
                message: "Something went wrong. Please try again.",
            });
        }
    }

}

export default ContactController;