const crypto = require("crypto");
const bcrypt = require("bcrypt");
const db = require("../config/connections");
const collections = require("../config/collections");

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;

let otpIndexPromise = null;

/**
 * Ensures MongoDB indexes exist for the OTP collection.
 * Includes a TTL index on `expiresAt` and a compound lookup index on `phone` and `purpose`.
 */
function ensureOtpIndexes(otpCollection) {
  if (!otpIndexPromise) {
    otpIndexPromise = Promise.all([
      otpCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      otpCollection.createIndex({ phone: 1, purpose: 1 }),
    ]).catch((error) => {
      otpIndexPromise = null;
      throw error;
    });
  }
  return otpIndexPromise;
}

/**
 * Normalizes Indian phone numbers to standard E.164 format (+91XXXXXXXXXX).
 * Accepts various common inputs like:
 *   - "9876543210"
 *   - "+91 98765 43210"
 *   - "09876543210"
 *   - "919876543210"
 * Returns the normalized string "+91XXXXXXXXXX" or null if invalid.
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== "string" && typeof rawPhone !== "number") {
    return null;
  }

  const cleaned = String(rawPhone).trim().replace(/[\s\-\(\)\.]/g, "");

  let nationalNumber = "";

  if (cleaned.startsWith("+91")) {
    nationalNumber = cleaned.slice(3);
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    nationalNumber = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    nationalNumber = cleaned.slice(1);
  } else if (cleaned.length === 10) {
    nationalNumber = cleaned;
  } else {
    return null;
  }

  // Indian mobile numbers must be 10 digits and start with 6, 7, 8, or 9
  const indianMobileRegex = /^[6-9]\d{9}$/;
  if (!indianMobileRegex.test(nationalNumber)) {
    return null;
  }

  return `+91${nationalNumber}`;
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
function generateNumericOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Returns collection reference for OTPs.
 */
function getOtpCollection() {
  return db.get().collection(collections.OTP_COLLECTION);
}

module.exports = {
  OTP_EXPIRY_MS,
  RESEND_COOLDOWN_MS,
  MAX_ATTEMPTS,

  normalizePhoneNumber,
  generateNumericOtp,

  /**
   * Checks whether a resend cooldown is active for a phone number and purpose.
   */
  getOtpCooldown: async (phone, purpose = "signup") => {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return { canResend: false, waitSeconds: 0, error: "INVALID_PHONE" };
    }

    const otpCollection = getOtpCollection();
    const existing = await otpCollection.findOne({
      phone: normalizedPhone,
      purpose,
    });

    if (!existing || !existing.createdAt) {
      return { canResend: true, waitSeconds: 0 };
    }

    const elapsed = Date.now() - new Date(existing.createdAt).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return { canResend: false, waitSeconds };
    }

    return { canResend: true, waitSeconds: 0 };
  },

  /**
   * Generates a secure OTP, hashes it, and stores the OTP record in MongoDB.
   * Enforces 60-second resend cooldown.
   * Returns { ok: true, phone, expiresAt, otp } on success (never logs the OTP).
   */
  createAndStoreOtp: async ({ phone, purpose = "signup" }) => {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return {
        ok: false,
        error: "INVALID_PHONE",
        message: "Please enter a valid 10-digit Indian mobile number.",
      };
    }

    const otpCollection = getOtpCollection();
    await ensureOtpIndexes(otpCollection);

    // Check for existing active OTP and enforce 60s resend cooldown
    const existing = await otpCollection.findOne({
      phone: normalizedPhone,
      purpose,
    });

    if (existing && existing.createdAt) {
      const elapsed = Date.now() - new Date(existing.createdAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return {
          ok: false,
          error: "RESEND_COOLDOWN",
          waitSeconds,
          message: `Please wait ${waitSeconds}s before requesting a new OTP.`,
        };
      }
      // If cooldown has expired, remove the previous record before creating a new one
      await otpCollection.deleteMany({ phone: normalizedPhone, purpose });
    }

    const plainOtp = generateNumericOtp();
    const otpHash = await bcrypt.hash(plainOtp, 10);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

    const otpDocument = {
      phone: normalizedPhone,
      otpHash,
      purpose,
      attempts: 0,
      createdAt: now,
      expiresAt,
    };

    await otpCollection.insertOne(otpDocument);

    return {
      ok: true,
      phone: normalizedPhone,
      expiresAt,
      otp: plainOtp,
    };
  },

  /**
   * Verifies an OTP against stored hash for a given phone and purpose.
   * Checks expiration (5 minutes), attempt limit (max 5), and increments attempts on failure.
   * On successful verification or max attempts reached, invalidates the OTP record.
   */
  verifyOtp: async ({ phone, otp, purpose = "signup" }) => {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return {
        ok: false,
        error: "INVALID_PHONE",
        message: "Invalid phone number format.",
      };
    }

    if (!otp || (typeof otp !== "string" && typeof otp !== "number")) {
      return {
        ok: false,
        error: "INVALID_OTP",
        message: "Please enter the OTP.",
      };
    }

    const candidateOtp = String(otp).trim();
    const otpCollection = getOtpCollection();

    const otpDoc = await otpCollection.findOne({
      phone: normalizedPhone,
      purpose,
    });

    if (!otpDoc) {
      return {
        ok: false,
        error: "OTP_NOT_FOUND",
        message: "No active OTP found. Please request a new OTP.",
      };
    }

    // Explicit expiration check (do not rely solely on MongoDB TTL background thread)
    if (new Date() > new Date(otpDoc.expiresAt)) {
      await otpCollection.deleteOne({ _id: otpDoc._id });
      return {
        ok: false,
        error: "OTP_EXPIRED",
        message: "OTP has expired. Please request a new OTP.",
      };
    }

    // Check attempts limit before verifying
    if (otpDoc.attempts >= MAX_ATTEMPTS) {
      await otpCollection.deleteOne({ _id: otpDoc._id });
      return {
        ok: false,
        error: "MAX_ATTEMPTS_EXCEEDED",
        message: "Maximum verification attempts exceeded. Please request a new OTP.",
      };
    }

    // Compare with hashed OTP
    const isMatch = await bcrypt.compare(candidateOtp, otpDoc.otpHash);

    if (!isMatch) {
      await otpCollection.updateOne(
        { _id: otpDoc._id },
        { $inc: { attempts: 1 } }
      );

      const updatedAttempts = otpDoc.attempts + 1;
      if (updatedAttempts >= MAX_ATTEMPTS) {
        await otpCollection.deleteOne({ _id: otpDoc._id });
        return {
          ok: false,
          error: "MAX_ATTEMPTS_EXCEEDED",
          attemptsRemaining: 0,
          message: "Maximum verification attempts exceeded. Please request a new OTP.",
        };
      }

      const attemptsRemaining = MAX_ATTEMPTS - updatedAttempts;
      return {
        ok: false,
        error: "INVALID_OTP",
        attemptsRemaining,
        message: `Invalid OTP. ${attemptsRemaining} attempt(s) remaining.`,
      };
    }

    // Successful verification - delete OTP document so it cannot be reused
    await otpCollection.deleteOne({ _id: otpDoc._id });

    return {
      ok: true,
      phone: normalizedPhone,
      purpose: otpDoc.purpose,
    };
  },

  /**
   * Manually invalidates/deletes any active OTP for a phone and purpose.
   */
  invalidateOtp: async (phone, purpose = "signup") => {
    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone) {
      return { ok: false, error: "INVALID_PHONE" };
    }

    const otpCollection = getOtpCollection();
    await otpCollection.deleteMany({ phone: normalizedPhone, purpose });

    return { ok: true };
  },
};
