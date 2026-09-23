const crypto = require("crypto");

const getSecret = () => {
    const secret = process.env.GATEPASS_TOKEN_SECRET;

    if (!secret) {
        throw new Error("GATEPASS_TOKEN_SECRET is not configured.");
    }

    return secret;
};

const base64UrlEncode = (value) => {
    return Buffer.from(value)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
};

const base64UrlDecode = (value) => {
    const padded = value
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "=");

    return Buffer.from(padded, "base64").toString("utf8");
};

const sign = (payload) => {
    return crypto
        .createHmac("sha256", getSecret())
        .update(payload)
        .digest("hex");
};

const createGatePassToken = ({
    gatePassId,
    verificationCode,
    verified = false,
    expiresInSeconds = 900
}) => {
    const payload = {
        gatePassId: Number(gatePassId),
        verificationCode,
        verified,
        exp: Date.now() + expiresInSeconds * 1000
    };

    const encodedPayload = base64UrlEncode(
        JSON.stringify(payload)
    );

    const signature = sign(encodedPayload);

    return `${encodedPayload}.${signature}`;
};

const verifyGatePassToken = (token) => {
    if (!token || typeof token !== "string") {
        return null;
    }

    const parts = token.split(".");

    if (parts.length !== 2) {
        return null;
    }

    const [encodedPayload, signature] = parts;
    const expectedSignature = sign(encodedPayload);

    if (
        signature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        )
    ) {
        return null;
    }

    try {
        const payload = JSON.parse(
            base64UrlDecode(encodedPayload)
        );

        if (!payload.gatePassId || !payload.verificationCode) {
            return null;
        }

        if (!payload.exp || Date.now() > Number(payload.exp)) {
            return null;
        }

        return payload;
    } catch (error) {
        return null;
    }
};

module.exports = {
    createGatePassToken,
    verifyGatePassToken
};
