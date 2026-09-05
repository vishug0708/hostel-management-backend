const db = require("../config/database");
const jwt = require("jsonwebtoken");
const {
    createContact,
    createBankFundAccount,
    createVpaFundAccount
} = require("../services/razorpayXService");

function getToken(req) {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
        return null;
    }

    return authHeader.substring(7);
}

function requireAdmin(req) {
    const token = getToken(req);

    if (!token) {
        throw new Error("Unauthorized");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "admin") {
        throw new Error("Admin access required");
    }

    return decoded;
}

function validatePersonType(personType) {
    return personType === "staff" || personType === "rector";
}

async function getPerson(personId, personType) {
    if (personType === "staff") {
        const [rows] = await db.query(
            `
            SELECT
                id,
                staff_id AS person_code,
                name,
                email,
                mobile AS phone,
                status
            FROM staff
            WHERE id = ?
            LIMIT 1
            `,
            [personId]
        );

        return rows[0];
    }

    const [rows] = await db.query(
        `
        SELECT
            id,
            rector_id AS person_code,
            name,
            email,
            phone,
            status
        FROM rectors
        WHERE id = ?
        LIMIT 1
        `,
        [personId]
    );

    return rows[0];
}

async function getSalaryAccount(req, res) {
    try {
        requireAdmin(req);

        const { personType, personId } = req.params;

        if (!validatePersonType(personType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid person type."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                id,
                person_id,
                person_type,
                account_holder_name,
                bank_account_number,
                ifsc_code,
                vpa,
                razorpay_contact_id,
                razorpay_fund_account_id,
                status,
                created_at,
                updated_at
            FROM salary_accounts
            WHERE person_id = ?
              AND person_type = ?
            LIMIT 1
            `,
            [personId, personType]
        );

        return res.json({
            success: true,
            account: rows[0] || null
        });
    } catch (error) {
        console.error("getSalaryAccount error:", error);

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.message === "Unauthorized"
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to fetch salary account."
        });
    }
}

async function saveSalaryAccount(req, res) {
    try {
        requireAdmin(req);

        const {
            person_id,
            person_type,
            account_holder_name,
            bank_account_number,
            ifsc_code,
            vpa
        } = req.body;

        if (!person_id || !person_type || !account_holder_name) {
            return res.status(400).json({
                success: false,
                message: "person_id, person_type and account_holder_name are required."
            });
        }

        if (!validatePersonType(person_type)) {
            return res.status(400).json({
                success: false,
                message: "person_type must be staff or rector."
            });
        }

        const person = await getPerson(person_id, person_type);

        if (!person) {
            return res.status(404).json({
                success: false,
                message: "Staff/Rector not found."
            });
        }

        if (String(person.status).toLowerCase() !== "active") {
            return res.status(400).json({
                success: false,
                message: "Only active Staff/Rector can have a salary payout account."
            });
        }

        const cleanHolderName = String(account_holder_name).trim();
        const cleanAccountNumber = bank_account_number
            ? String(bank_account_number).trim()
            : null;
        const cleanIfsc = ifsc_code
            ? String(ifsc_code).trim().toUpperCase()
            : null;
        const cleanVpa = vpa
            ? String(vpa).trim()
            : null;

        if (!cleanAccountNumber && !cleanVpa) {
            return res.status(400).json({
                success: false,
                message: "Provide either bank account details or VPA."
            });
        }

        if (cleanAccountNumber && !cleanIfsc) {
            return res.status(400).json({
                success: false,
                message: "IFSC code is required for bank account payout."
            });
        }

        const [existingRows] = await db.query(
            `
            SELECT *
            FROM salary_accounts
            WHERE person_id = ?
              AND person_type = ?
            LIMIT 1
            `,
            [person_id, person_type]
        );

        let razorpayContactId =
            existingRows.length > 0
                ? existingRows[0].razorpay_contact_id
                : null;

        let razorpayFundAccountId =
            existingRows.length > 0
                ? existingRows[0].razorpay_fund_account_id
                : null;

        /*
         * Create RazorpayX Contact only if we don't already have one.
         */
        if (!razorpayContactId) {
            const contact = await createContact({
                name: cleanHolderName,
                email: person.email || undefined,
                phone: person.phone || undefined,
                referenceId: `${person_type}_${person.id}`
            });

            razorpayContactId = contact.id;
        }

        /*
         * Create Fund Account only if we don't already have one.
         */
        if (!razorpayFundAccountId) {
            let fundAccount;

            if (cleanAccountNumber) {
                fundAccount = await createBankFundAccount({
                    contactId: razorpayContactId,
                    accountHolderName: cleanHolderName,
                    accountNumber: cleanAccountNumber,
                    ifsc: cleanIfsc
                });
            } else {
                fundAccount = await createVpaFundAccount({
                    contactId: razorpayContactId,
                    vpa: cleanVpa
                });
            }

            razorpayFundAccountId = fundAccount.id;
        }

        await db.query(
            `
            INSERT INTO salary_accounts (
                person_id,
                person_type,
                account_holder_name,
                bank_account_number,
                ifsc_code,
                vpa,
                razorpay_contact_id,
                razorpay_fund_account_id,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            ON DUPLICATE KEY UPDATE
                account_holder_name = VALUES(account_holder_name),
                bank_account_number = VALUES(bank_account_number),
                ifsc_code = VALUES(ifsc_code),
                vpa = VALUES(vpa),
                razorpay_contact_id = VALUES(razorpay_contact_id),
                razorpay_fund_account_id = VALUES(razorpay_fund_account_id),
                status = 'active'
            `,
            [
                person_id,
                person_type,
                cleanHolderName,
                cleanAccountNumber,
                cleanIfsc,
                cleanVpa,
                razorpayContactId,
                razorpayFundAccountId
            ]
        );

        const [savedRows] = await db.query(
            `
            SELECT
                id,
                person_id,
                person_type,
                account_holder_name,
                bank_account_number,
                ifsc_code,
                vpa,
                razorpay_contact_id,
                razorpay_fund_account_id,
                status,
                created_at,
                updated_at
            FROM salary_accounts
            WHERE person_id = ?
              AND person_type = ?
            LIMIT 1
            `,
            [person_id, person_type]
        );

        return res.status(200).json({
            success: true,
            message: "Salary payout account saved successfully.",
            account: savedRows[0]
        });
    } catch (error) {
        console.error(
            "saveSalaryAccount error:",
            error.response?.data || error
        );

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.message === "Unauthorized"
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        return res.status(500).json({
            success: false,
            message:
                error.response?.data?.error?.description ||
                error.response?.data?.message ||
                error.message ||
                "Failed to save salary account."
        });
    }
}

async function deactivateSalaryAccount(req, res) {
    try {
        requireAdmin(req);

        const { personType, personId } = req.params;

        if (!validatePersonType(personType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid person type."
            });
        }

        const [result] = await db.query(
            `
            UPDATE salary_accounts
            SET status = 'inactive'
            WHERE person_id = ?
              AND person_type = ?
            `,
            [personId, personType]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Salary account not found."
            });
        }

        return res.json({
            success: true,
            message: "Salary account deactivated successfully."
        });
    } catch (error) {
        console.error("deactivateSalaryAccount error:", error);

        if (
            error.name === "JsonWebTokenError" ||
            error.name === "TokenExpiredError" ||
            error.message === "Unauthorized"
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to deactivate salary account."
        });
    }
}

module.exports = {
    getSalaryAccount,
    saveSalaryAccount,
    deactivateSalaryAccount
};