const axios = require("axios");
const crypto = require("crypto");

const RAZORPAYX_BASE_URL = "https://api.razorpay.com/v1";

function getCredentials() {
    const keyId =
        process.env.RAZORPAYX_KEY_ID ||
        process.env.RAZORPAY_KEY_ID;

    const keySecret =
        process.env.RAZORPAYX_KEY_SECRET ||
        process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new Error("RazorpayX API credentials are not configured.");
    }

    return {
        keyId,
        keySecret
    };
}

function getHeaders(extraHeaders = {}) {
    return {
        "Content-Type": "application/json",
        ...extraHeaders
    };
}

async function createContact({
    name,
    email,
    phone,
    referenceId
}) {
    const { keyId, keySecret } = getCredentials();

    const payload = {
        name,
        email,
        contact: phone,
        type: "employee",
        reference_id: referenceId
    };

    const response = await axios.post(
        `${RAZORPAYX_BASE_URL}/contacts`,
        payload,
        {
            auth: {
                username: keyId,
                password: keySecret
            },
            headers: getHeaders()
        }
    );

    return response.data;
}

async function createBankFundAccount({
    contactId,
    accountHolderName,
    accountNumber,
    ifsc
}) {
    const { keyId, keySecret } = getCredentials();

    const payload = {
        contact_id: contactId,
        account_type: "bank_account",
        bank_account: {
            name: accountHolderName,
            ifsc,
            account_number: accountNumber
        }
    };

    const response = await axios.post(
        `${RAZORPAYX_BASE_URL}/fund_accounts`,
        payload,
        {
            auth: {
                username: keyId,
                password: keySecret
            },
            headers: getHeaders()
        }
    );

    return response.data;
}

async function createVpaFundAccount({
    contactId,
    vpa
}) {
    const { keyId, keySecret } = getCredentials();

    const payload = {
        contact_id: contactId,
        account_type: "vpa",
        vpa: {
            address: vpa
        }
    };

    const response = await axios.post(
        `${RAZORPAYX_BASE_URL}/fund_accounts`,
        payload,
        {
            auth: {
                username: keyId,
                password: keySecret
            },
            headers: getHeaders()
        }
    );

    return response.data;
}

function generateIdempotencyKey(salaryId) {
    return crypto
        .createHash("sha256")
        .update(`salary-payout-${salaryId}`)
        .digest("hex")
        .substring(0, 36);
}

async function createPayout({
    fundAccountId,
    amount,
    referenceId,
    narration,
    salaryId
}) {
    const { keyId, keySecret } = getCredentials();

    const accountNumber =
        process.env.RAZORPAYX_ACCOUNT_NUMBER;

    if (!accountNumber) {
        throw new Error(
            "RAZORPAYX_ACCOUNT_NUMBER is not configured."
        );
    }

    if (!fundAccountId) {
        throw new Error(
            "RazorpayX fund account ID is required."
        );
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error("Invalid payout amount.");
    }

    const idempotencyKey = generateIdempotencyKey(
        salaryId || referenceId
    );

    const payload = {
        account_number: accountNumber,
        fund_account_id: fundAccountId,
        amount: Math.round(numericAmount * 100),
        currency: "INR",
        mode: "IMPS",
        purpose: "salary",
        queue_if_low_balance: true,
        reference_id: referenceId,
        narration: narration || "Salary Payment"
    };

    const response = await axios.post(
        `${RAZORPAYX_BASE_URL}/payouts`,
        payload,
        {
            auth: {
                username: keyId,
                password: keySecret
            },
            headers: getHeaders({
                "X-Payout-Idempotency": idempotencyKey
            })
        }
    );

    return response.data;
}

async function getPayout(payoutId) {
    const { keyId, keySecret } = getCredentials();

    const response = await axios.get(
        `${RAZORPAYX_BASE_URL}/payouts/${payoutId}`,
        {
            auth: {
                username: keyId,
                password: keySecret
            }
        }
    );

    return response.data;
}

module.exports = {
    createContact,
    createBankFundAccount,
    createVpaFundAccount,
    createPayout,
    getPayout
};