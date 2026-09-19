const nodemailer = require("nodemailer");

const smtpHost =
    process.env.BREVO_SMTP_HOST ||
    "smtp-relay.brevo.com";

const smtpPort = Number(
    process.env.BREVO_SMTP_PORT ||
    587
);

const smtpUser =
    process.env.BREVO_SMTP_USER ||
    "";

const smtpPass = String(
    process.env.BREVO_SMTP_PASS ||
    ""
).replace(/\s/g, "");

const fromEmail =
    process.env.BREVO_FROM_EMAIL ||
    "";

const fromName =
    process.env.BREVO_FROM_NAME ||
    "Hostel Management System";

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
        user: smtpUser,
        pass: smtpPass
    }
});

const sendEmail = async ({
    to,
    subject,
    html,
    text = ""
}) => {
    try {
        if (!to) {
            throw new Error(
                "Recipient email is required."
            );
        }

        if (!smtpUser || !smtpPass) {
            throw new Error(
                "Brevo SMTP credentials are not configured."
            );
        }

        if (!fromEmail) {
            throw new Error(
                "BREVO_FROM_EMAIL is not configured."
            );
        }

        const info = await transporter.sendMail({
            from: `"${fromName}" <${fromEmail}>`,
            to,
            subject,
            text,
            html
        });

        console.log(
            "✅ Brevo Email Sent:",
            info.messageId
        );

        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        console.error(
            "❌ Brevo Email Error:",
            error.message
        );

        return {
            success: false,
            message: error.message
        };
    }
};

module.exports = {
    transporter,
    sendEmail
};
