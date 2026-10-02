var express = require("express");
var router = express.Router();
const userHelper = require("../helpers/user-helper");
const collections = require("../config/collections");
const { ObjectId } = require("mongodb");
const db = require("../config/connections");
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
const xpHelper = require("../helpers/xpsystem-helper");
const rewardHelper = require("../helpers/reward-helper");
dayjs.extend(relativeTime);
const xp = require("../config/xp-points");
const aiService = require("../services/aiService");
const otpHelper = require("../helpers/otp-helper");
/* GET home page. */
const verify = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
};

router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

router.get("/signup", (req, res) => {
  res.render("user/user_auth/signup_page");
});

router.post("/signup/request-otp", async (req, res) => {
  try {
    const rawPhone = req.body.phone;
    const normalizedPhone = otpHelper.normalizePhoneNumber(rawPhone);

    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PHONE",
        message: "Please enter a valid 10-digit Indian mobile number.",
      });
    }

    // Check duplicate phone in students collection
    const existingStudent = await userHelper.findStudentByPhone(normalizedPhone);
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        error: "DUPLICATE_PHONE",
        message: "A student account with this mobile number already exists.",
      });
    }

    const otpResult = await otpHelper.createAndStoreOtp({
      phone: normalizedPhone,
      purpose: "signup",
    });

    if (!otpResult.ok) {
      if (otpResult.error === "RESEND_COOLDOWN") {
        return res.status(429).json({
          success: false,
          error: "RESEND_COOLDOWN",
          waitSeconds: otpResult.waitSeconds,
          message: otpResult.message,
        });
      }
      return res.status(400).json({
        success: false,
        error: otpResult.error || "OTP_REQUEST_FAILED",
        message: otpResult.message || "Failed to generate OTP. Please try again.",
      });
    }

    // Clear any previous verification in session since a new OTP was requested
    delete req.session.pendingSignupVerification;

    const responseData = {
      success: true,
      message: "OTP sent successfully to your mobile number.",
      phone: normalizedPhone,
      cooldownSeconds: 60,
    };

    // Development-only testing flow (no SMS provider connected yet)
    if (process.env.NODE_ENV !== "production") {
      responseData.devOtp = otpResult.otp;
      responseData.isDev = true;
    }

    return res.json(responseData);
  } catch (error) {
    console.error("Error requesting signup OTP:", error.message);
    return res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: "An unexpected error occurred while requesting OTP. Please try again.",
    });
  }
});

router.post("/signup/verify-otp", async (req, res) => {
  try {
    const rawPhone = req.body.phone;
    const rawOtp = req.body.otp;

    const normalizedPhone = otpHelper.normalizePhoneNumber(rawPhone);
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PHONE",
        message: "Please enter a valid 10-digit Indian mobile number.",
      });
    }

    if (!rawOtp) {
      return res.status(400).json({
        success: false,
        error: "INVALID_OTP",
        message: "Please enter the 6-digit OTP.",
      });
    }

    const verifyResult = await otpHelper.verifyOtp({
      phone: normalizedPhone,
      otp: rawOtp,
      purpose: "signup",
    });

    if (!verifyResult.ok) {
      const statusCode = verifyResult.error === "MAX_ATTEMPTS_EXCEEDED" ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        error: verifyResult.error,
        attemptsRemaining: verifyResult.attemptsRemaining,
        message: verifyResult.message,
      });
    }

    // Set server-side temporary verification state in session
    req.session.pendingSignupVerification = {
      phone: normalizedPhone,
      verified: true,
      verifiedAt: new Date(),
    };

    return res.json({
      success: true,
      message: "Phone number verified successfully!",
      phone: normalizedPhone,
    });
  } catch (error) {
    console.error("Error verifying signup OTP:", error.message);
    return res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: "An unexpected error occurred while verifying OTP. Please try again.",
    });
  }
});

router.post("/signup", async (req, res) => {
  const isJson =
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes("application/json")) ||
    req.is("json");

  const sendError = (status, errorMessage) => {
    if (isJson) {
      return res.status(status).json({ success: false, error: errorMessage });
    }
    return res.status(status).render("user/user_auth/signup_page", {
      error: errorMessage,
      formData: {
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        class: req.body.class,
        division: req.body.division,
      },
    });
  };

  try {
    const { name, email, password, phone } = req.body;
    const studentClass = req.body.class;
    const division = req.body.division;

    const trimmedName = (name || "").trim();
    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedPassword = password || "";
    const normalizedPhone = otpHelper.normalizePhoneNumber(phone);

    if (!trimmedName) {
      return sendError(400, "Full Name is required.");
    }

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      return sendError(400, "A valid email address is required.");
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      return sendError(400, "Password must be at least 6 characters long.");
    }

    const validClasses = ["5", "6", "7", "8", "9", "10"];
    if (!validClasses.includes(studentClass)) {
      return sendError(400, "Please select a valid class (5th to 10th Standard).");
    }

    const validDivisions = ["A", "B", "C", "D", "E", "F", "G"];
    if (!validDivisions.includes(division)) {
      return sendError(400, "Please select a valid division (A to G).");
    }

    if (!normalizedPhone) {
      return sendError(400, "Please enter a valid 10-digit Indian mobile number.");
    }

    // SERVER-SIDE SECURITY CHECK:
    // Verify that the session has an active, successful verification for THIS exact phone number
    const pendingVerification = req.session.pendingSignupVerification;
    if (
      !pendingVerification ||
      pendingVerification.verified !== true ||
      pendingVerification.phone !== normalizedPhone
    ) {
      return sendError(
        400,
        "Phone number has not been verified. Please verify your mobile number with OTP before completing signup."
      );
    }

    // Check duplicate phone in database
    const existingPhone = await userHelper.findStudentByPhone(normalizedPhone);
    if (existingPhone) {
      return sendError(400, "A student account with this mobile number already exists.");
    }

    // Check duplicate email in database
    const existingEmail = await userHelper.findStudentByEmail(trimmedEmail);
    if (existingEmail) {
      return sendError(400, "A student account with this email address already exists.");
    }

    // Create student account
    const studentRecord = {
      name: trimmedName,
      email: trimmedEmail,
      password: trimmedPassword,
      class: studentClass,
      division: division,
      phone: normalizedPhone,
      phoneVerified: true,
      phoneVerifiedAt: new Date(),
      active: true,
      xp: 0,
      level: 1,
      createdAt: new Date(),
    };

    await userHelper.doSignup(studentRecord);

    // Clear temporary verification state
    delete req.session.pendingSignupVerification;

    if (isJson) {
      return res.json({ success: true, redirect: "/login" });
    }

    return res.redirect("/login");
  } catch (error) {
    console.error("Signup error:", error.message);
    return sendError(500, "An error occurred while creating your account. Please try again.");
  }
});
router.get("/about", (req, res) => {
  res.render("user/about-page");
});
router.get("/login", (req, res) => {
  res.render("user/user_auth/login_page");
});
router.post("/login", async (req, res) => {
  const response = await userHelper.doLogIn(req.body);

  if (response.status) {
    req.session.loggedIn = true;
    req.session.user = response.user;

    if (response.user.role === "admin") {
      return res.redirect("/admin");
    }

    if (response.user.role === "teacher") {
      return res.redirect("/teacher");
    }

    const today = new Date().toISOString().split("T")[0];

    if (response.user.lastLoginBonus !== today) {
      await xpHelper.addXP(response.user._id, xp.DAILY_LOGIN);

      await db
        .get()
        .collection(collections.STUDENT_COLLECTION)
        .updateOne(
          { _id: new ObjectId(response.user._id) },
          {
            $set: {
              lastLoginBonus: today,
            },
          },
        );
    }

    res.redirect("/doubts");
  } else {
    res.render("user/user_auth/login_page");
  }
});
router.get("/doubts", verify, async (req, res) => {
  const [userInfo, leaderboardItems] = await Promise.all([

    db.get()
      .collection(collections.STUDENT_COLLECTION)
      .findOne({
        _id: new ObjectId(req.session.user._id)
      }),

    db.get()
      .collection(collections.STUDENT_COLLECTION)
      .find({})
      .sort({ xp: -1 })
      .toArray()

  ]);
if (!userInfo) {
    req.session.destroy(() => {
        res.redirect("/login");
    });
    return;
}
  const topLeaderboard = leaderboardItems.slice(0, 10);

  const rank = leaderboardItems.findIndex(
    student => student._id.equals(userInfo._id)
  ) + 1;
const xpReward = req.session.xpReward?.amount || 0;
const upvoteReward = req.session.upvoteReward?.amount || 0;


  userHelper.showDoubt(req.session.user, req.query.subject).then((response) => {

    res.render("user/doubt-section", {
      response,
      userInfo,
      userName: userInfo.name,
      userXP: userInfo.xp,
      xpReward,
      userLevel: userInfo.level,
      topLeaderboard,
      rank
    });
delete req.session.xpReward;
delete req.session.upvoteReward;
  });

});
router.get("/logout", (req, res) => {
  req.session.loggedIn = false;
  req.session.user = null;
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/login");
    }
  });
});
router.post("/ask-doubt", verify, async (req, res) => {
  const studentId = req.session.user._id;

  const doubt = {
    studentId: new ObjectId(studentId),
    title: req.body.title.trim(),
    description: req.body.description.trim(),
    subject: req.body.subject,
    class: req.body.class,
    createdAt: new Date(),
  };
 const [result]= await Promise.all([
    userHelper.askDoubt(doubt),
    xpHelper.addXP(studentId, xp.ASK_DOUBT),
  ]);req.session.xpReward = {
    amount: xp.ASK_DOUBT
};
const savedDoubt = await db.get()
    .collection(collections.DOUBT_COLLECTION)
    .findOne({
        _id: result.insertedId
    });
    aiService.generateAIAnswerWithRetry(savedDoubt.title)
    .then(async (aiAnswer) => {

        await db.get()
            .collection(collections.ANSWER_COLLECTION)
            .insertOne({
                doubtId: savedDoubt._id,
                role: "ai",
                answer: aiAnswer,
                createdAt: new Date()
            });

        console.log("AI answer saved successfully 🤖");

    })
    .catch((error) => {
        console.error("AI generation failed:", error);
    });
  res.redirect("/doubts");
});
router.get("/terms-conditions", (req, res) => {
  res.render("user/terms-conditions");
});
router.post('/doubts/:id/like', verify, async (req, res) => {

  let doubtId = req.params.id;
  let studentId = req.session.user._id;

  let doubt = await db.get()
    .collection(collections.DOUBT_COLLECTION)
    .findOne({
      _id: new ObjectId(doubtId)
    });

  const alreadyLiked = doubt.likes
    ? doubt.likes.includes(studentId)
    : false;

  const alreadyRewarded = doubt.xpRewardedBy
    ? doubt.xpRewardedBy.includes(studentId)
    : false;

  if (alreadyLiked) {

    await db.get()
      .collection(collections.DOUBT_COLLECTION)
      .updateOne(
        { _id: new ObjectId(doubtId) },
        {
          $pull: {
            likes: studentId
          }
        }
      );

  } else {

    await db.get()
      .collection(collections.DOUBT_COLLECTION)
      .updateOne(
        { _id: new ObjectId(doubtId) },
        {
          $addToSet: {
            likes: studentId
          }
        }
      );

    if (!alreadyRewarded) {

      await Promise.all([
        xpHelper.addXP(doubt.studentId, 2),
        rewardHelper.rewardXp(doubt.studentId, 2)
      ]);

      await db.get()
        .collection(collections.DOUBT_COLLECTION)
        .updateOne(
          { _id: new ObjectId(doubtId) },
          {
            $addToSet: {
              xpRewardedBy: studentId
            }
          }
        );
    }
  }

  let updatedDoubt = await db.get()
    .collection(collections.DOUBT_COLLECTION)
    .findOne({
      _id: new ObjectId(doubtId)
    });

  return res.json({
    liked: !alreadyLiked,
    likeCount: updatedDoubt.likes.length
  });

});
router.get("/answer-doubt/:id", verify, async (req, res) => {
  const doubtId = new ObjectId(req.params.id);

  const userId = req.session.user._id;

  // Rating collection stores doubtId and userId as strings
  const ratingDoubtId = req.params.id;
  const ratingUserId = userId.toString();

  const [doubt, answers, ratingDoc] = await Promise.all([
    userHelper.getDoubt(doubtId),
    userHelper.getAnswers(doubtId),

    db
      .get()
      .collection(collections.RATING_COLLECTION)
      .findOne({
        doubtId: ratingDoubtId,
        userId: ratingUserId
      })
  ]);

  const userRating = ratingDoc ? ratingDoc.rating : null;

  console.log("Rating document:", ratingDoc);
  console.log("User rating:", userRating);

  await userHelper.attachAnswerRatings(answers, userId);

  res.render("user/answer-doubt", {
    doubt,
    answers,
    doubtId,
    userRating
  });
});
router.post("/answer-doubt", verify, async (req, res) => {
  const answer = {
    doubtId: new ObjectId(req.body.doubtId),
    studentId: new ObjectId(req.session.user._id),
    answer: req.body.answer,
    createdAt: new Date(),
    reviewStatus: "pending",
    verificationNotified:false
  };

  // Get the doubt
  const doubt = await db
    .get()
    .collection(collections.DOUBT_COLLECTION)
    .findOne({ _id: new ObjectId(req.body.doubtId) });

  // Save the answer
  await db.get().collection(collections.ANSWER_COLLECTION).insertOne(answer);
  // Award XP only if answering someone else's doubt
  if (doubt.studentId.toString() !== answer.studentId.toString()) {
    await xpHelper.addXP(answer.studentId, xp.ANSWER_DOUBT);
  }
  req.session.xpReward = {
    amount: xp.ANSWER_DOUBT
};
  res.redirect("/doubts");
});router.get("/verification-notification", verify, async (req, res) => {

  const notifications = await db
    .get()
    .collection(collections.ANSWER_COLLECTION)
    .find({
      studentId: new ObjectId(req.session.user._id),
      reviewStatus: "verified",
      verificationNotified: { $ne: true }
    })
    .toArray();

  if (notifications.length === 0) {
    return res.json({
      show: false
    });
  }

  await db
    .get()
    .collection(collections.ANSWER_COLLECTION)
    .updateMany(
      {
        _id: {
          $in: notifications.map(answer => answer._id)
        }
      },
      {
        $set: {
          verificationNotified: true
        }
      }
    );

  res.json({
    show: true,
    count: notifications.length,
    xp: xp.ACCEPTED_ANSWER
  });

});
router.post('/doubt/:doubtId/rating', verify, async (req, res) => {

    const doubtId = req.params.doubtId;
    const userId = req.session.user._id;
    const rating = Number(req.body.rating);

    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
            success: false,
            message: "The rating must be a number between 1 and 5"
        });
    }

    const result = await db.get()
        .collection(collections.RATING_COLLECTION)
        .findOne({
            doubtId: doubtId,
            userId: userId
        });

    if (result) {
        return res.status(400).json({
            success: false,
            message: "You have already rated this doubt"
        });
    }
    await db.get()
        .collection(collections.RATING_COLLECTION)
        .insertOne({
            doubtId: doubtId,
            userId: userId,
            rating: rating,
            createdAt: new Date()
        });
        console.log("saved",doubtId,userId,rating)
    return res.status(201).json({
        success: true,
        message: "Rating submitted successfully"
    });
});
router.post("/answer/:answerId/rating", verify, async (req, res) => {
  try {
    const result = await userHelper.submitAnswerRating({
      answerId: req.params.answerId,
      userId: req.session.user._id,
      rating: req.body.rating,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: result.message,
      averageRating: result.averageRating,
      ratingCount: result.ratingCount,
      userRating: result.userRating,
    });
  } catch (error) {
    console.error("Answer rating error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
});
module.exports = router;
