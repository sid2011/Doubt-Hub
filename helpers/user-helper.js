const db = require("../config/connections");
const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const collections = require("../config/collections");
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");

dayjs.extend(relativeTime);

let answerRatingIndexPromise;

function ensureAnswerRatingIndex(ratingCollection) {
  if (!answerRatingIndexPromise) {
    answerRatingIndexPromise = ratingCollection
      .createIndex({ answerId: 1, userId: 1 }, { unique: true })
      .catch((error) => {
        answerRatingIndexPromise = null;
        throw error;
      });
  }
  return answerRatingIndexPromise;
}

module.exports = {
  doSignup: async (userData) => {
    userData.password = await bcrypt.hash(userData.password, 10);
    let response = await db
      .get()
      .collection(collections.STUDENT_COLLECTION)
      .insertOne(userData);
  },
  doLogIn: async (userData) => {
    const hash = await bcrypt.hash("123", 10);


    let response = {};

    const isActiveAccount = (doc) => doc && doc.active !== false;

    const admin = await db
      .get()
      .collection(collections.ADMIN_COLLECTION)
      .findOne({ email: userData.email });

    if (admin) {
      if (!isActiveAccount(admin)) {
        return { status: false };
      }
      const adminOk = await bcrypt.compare(userData.password, admin.password);
      if (adminOk) {
        admin.role = "admin";
        response.user = admin;
        response.status = true;
        return response;
      }
      return { status: false };
    }

    const teacher = await db
      .get()
      .collection(collections.TEACHER_COLLECTION)
      .findOne({ email: userData.email });

    if (teacher) {
    
      const teacherOk = await bcrypt.compare(userData.password, teacher.password);
      if (teacherOk) {
        if (!isActiveAccount(teacher)) {
          return { status: false };
        }
       
        teacher.role = "teacher";
        response.user = teacher;
        response.status = true;
        return response;
      }
      return { status: false };
    }

    let user = await db
      .get()
      .collection(collections.STUDENT_COLLECTION)
      .findOne({ email: userData.email });
    if (!user) {
      return { status: false };
    }
    let status = await bcrypt.compare(userData.password, user.password);
    if (status) {
      if (!isActiveAccount(user)) {
        return { status: false };
      }
      response.user = user;
      response.user.role = "student";
      response.status = true;
      return response;
    } else {
      return { status: false };
    }
  },
  askDoubt: async (doubt) => {
    return await db.get().collection(collections.DOUBT_COLLECTION).insertOne(doubt);
  },
  showDoubt: async (userData, subject) => {
    let query = {
        class: userData.class,
    };

    if (subject) {
        query.subject = subject;
    }

    let doubts = await db.get()
        .collection(collections.DOUBT_COLLECTION)
        .aggregate([
            {
                $match: query
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $lookup: {
                    from: collections.STUDENT_COLLECTION,
                    localField: "studentId",
                    foreignField: "_id",
                    as: "student"
                }
            },
            {
                $unwind: "$student"
            },

            // Get ratings for this doubt
            {
                $lookup: {
                    from: collections.RATING_COLLECTION,
                    let: {
                        doubtIdString: {
                            $toString: "$_id"
                        }
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$doubtId", "$$doubtIdString"]
                                }
                            }
                        }
                    ],
                    as: "ratings"
                }
            },

            // Calculate average and count
            {
                $addFields: {
                    averageRating: {
                        $cond: [
                            { $gt: [{ $size: "$ratings" }, 0] },
                            { $round: [{ $avg: "$ratings.rating" }, 1] },
                            null
                        ]
                    },

                    ratingCount: {
                        $size: "$ratings"
                    }
                }
            },

            // Don't send all individual ratings to the frontend
            {
                $project: {
                    ratings: 0
                }
            }
        ])
        .toArray();

    const studentId = userData._id;

    doubts.forEach(doubt => {
        doubt.isLiked = doubt.likes
            ? doubt.likes.includes(studentId)
            : false;
    });

    doubts.forEach(doubt => {
        doubt.timeAgo = dayjs(doubt.createdAt).fromNow();
    });

    doubts.forEach(doubt => {
        doubt.isOwner =
            doubt.studentId.toString() === userData._id.toString();
    });

    return doubts;
},
  getDoubt: async (doubtId) => {
    let doubt = await db
      .get()
      .collection(collections.DOUBT_COLLECTION)
      .findOne({ _id: doubtId });

    if (doubt) {
      doubt.timeAgo = dayjs(doubt.createdAt).fromNow();
    }

    return doubt;
  },
  getAnswers: async (doubtId) => {
    return db
      .get()
      .collection(collections.ANSWER_COLLECTION)
      .aggregate([
        {
          $match: {
            doubtId: doubtId,
          },
        },
        {
          $lookup: {
            from: collections.STUDENT_COLLECTION,
            localField: "studentId",
            foreignField: "_id",
            as: "student",
          },
        },
        {
          $unwind: {
        path: "$student",
        preserveNullAndEmptyArrays: true
    }
        },
      ])
      .toArray();
  },
  attachAnswerRatings: async (answers, userId) => {
    if (!answers || answers.length === 0) {
      return answers;
    }

    const answerIds = answers.map((answer) => answer._id.toString());
    const userIdStr = userId.toString();

    const ratings = await db
      .get()
      .collection(collections.ANSWER_RATING_COLLECTION)
      .find({
        answerId: { $in: answerIds },
      })
      .toArray();

    const ratingsByAnswer = {};
    ratings.forEach((ratingDoc) => {
      const key = ratingDoc.answerId.toString();
      if (!ratingsByAnswer[key]) {
        ratingsByAnswer[key] = [];
      }
      ratingsByAnswer[key].push(ratingDoc);
    });

    answers.forEach((answer) => {
      const list = ratingsByAnswer[answer._id.toString()] || [];
      const ratingCount = list.length;

      if (ratingCount === 0) {
        answer.averageRating = null;
        answer.ratingCount = 0;
        answer.userRating = null;
        return;
      }

      const sum = list.reduce((total, doc) => total + Number(doc.rating), 0);
      answer.averageRating = Math.round((sum / ratingCount) * 10) / 10;
      answer.ratingCount = ratingCount;

      const mine = list.find(
        (doc) => doc.userId && doc.userId.toString() === userIdStr
      );
      answer.userRating = mine ? mine.rating : null;
    });

    return answers;
  },
  submitAnswerRating: async ({ answerId, userId, rating }) => {
    const ratingValue = Number(rating);

    if (
      !Number.isInteger(ratingValue) ||
      ratingValue < 1 ||
      ratingValue > 5
    ) {
      return {
        ok: false,
        status: 400,
        message: "Rating must be between 1 and 5.",
      };
    }

    if (!ObjectId.isValid(answerId)) {
      return {
        ok: false,
        status: 404,
        message: "Answer not found.",
      };
    }

    const answer = await db
      .get()
      .collection(collections.ANSWER_COLLECTION)
      .findOne({ _id: new ObjectId(answerId) });

    if (!answer) {
      return {
        ok: false,
        status: 404,
        message: "Answer not found.",
      };
    }

    const answerIdStr = answer._id.toString();
    const userIdStr = userId.toString();
    const ratingCollection = db
      .get()
      .collection(collections.ANSWER_RATING_COLLECTION);

    await ensureAnswerRatingIndex(ratingCollection);

    const existing = await ratingCollection.findOne({
      answerId: answerIdStr,
      userId: userIdStr,
    });

    if (existing) {
      return {
        ok: false,
        status: 400,
        message: "You have already rated this answer.",
      };
    }

    try {
      await ratingCollection.insertOne({
        answerId: answerIdStr,
        doubtId: answer.doubtId.toString(),
        userId: userIdStr,
        rating: ratingValue,
        createdAt: new Date(),
      });
    } catch (error) {
      if (error && error.code === 11000) {
        return {
          ok: false,
          status: 400,
          message: "You have already rated this answer.",
        };
      }
      throw error;
    }

    const stats = await ratingCollection
      .aggregate([
        { $match: { answerId: answerIdStr } },
        {
          $group: {
            _id: null,
            averageRating: { $avg: "$rating" },
            ratingCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const summary = stats[0] || { averageRating: null, ratingCount: 0 };

    return {
      ok: true,
      status: 201,
      message: "Rating submitted successfully",
      averageRating:
        summary.averageRating == null
          ? null
          : Math.round(summary.averageRating * 10) / 10,
      ratingCount: summary.ratingCount || 0,
      userRating: ratingValue,
    };
  },
};
