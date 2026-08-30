const { ObjectId } = require("mongodb");
const db = require("../config/connections");
const collections = require("../config/collections");
const xpHelper = require("./xpsystem-helper");
const xp = require("../config/xp-points");

const pendingStudentAnswerFilter = {
  role: { $ne: "ai" },
  studentId: { $exists: true, $ne: null },
  $or: [
    { reviewStatus: "pending" },
    { reviewStatus: { $exists: false } },
    { reviewStatus: null },
  ],
};

function answers() {
  return db.get().collection(collections.ANSWER_COLLECTION);
}

function isStudentAnswer(answer) {
  return Boolean(
    answer &&
      answer.role !== "ai" &&
      answer.studentId
  );
}

async function attachDoubtAndStudent(answer) {
  if (!answer) {
    return null;
  }

  const [student, doubt] = await Promise.all([
    db
      .get()
      .collection(collections.STUDENT_COLLECTION)
      .findOne({ _id: new ObjectId(answer.studentId) }),
    db
      .get()
      .collection(collections.DOUBT_COLLECTION)
      .findOne({ _id: new ObjectId(answer.doubtId) }),
  ]);

  answer.student = student || {};
  answer.doubt = doubt || {};
  return answer;
}

module.exports = {
  countPendingAnswers: async () => {
    return answers().countDocuments(pendingStudentAnswerFilter);
  },

  listRecentPending: async (limit = 8) => {
    const items = await answers()
      .aggregate([
        { $match: pendingStudentAnswerFilter },
        { $sort: { createdAt: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: collections.STUDENT_COLLECTION,
            localField: "studentId",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: collections.DOUBT_COLLECTION,
            localField: "doubtId",
            foreignField: "_id",
            as: "doubt",
          },
        },
        { $unwind: { path: "$doubt", preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    return items;
  },

  getNextPending: async () => {
    const answer = await answers().findOne(pendingStudentAnswerFilter, {
      sort: { createdAt: 1 },
    });
    return attachDoubtAndStudent(answer);
  },

  getPendingById: async (answerId) => {
    if (!ObjectId.isValid(answerId)) {
      return null;
    }

    const answer = await answers().findOne({
      _id: new ObjectId(answerId),
      ...pendingStudentAnswerFilter,
    });

    return attachDoubtAndStudent(answer);
  },

  verifyAnswer: async (answerId, teacherId) => {
    if (!ObjectId.isValid(answerId)) {
      return { ok: false };
    }

    const answer = await answers().findOne({ _id: new ObjectId(answerId) });
    if (!isStudentAnswer(answer)) {
      return { ok: false };
    }

    await answers().updateOne(
      { _id: answer._id },
      {
        $set: {
          reviewStatus: "verified",
          reviewedAt: new Date(),
          reviewedBy: new ObjectId(teacherId),
        },
      }
    );

    const xpLock = await answers().updateOne(
      { _id: answer._id, acceptedXpAwarded: { $ne: true } },
      { $set: { acceptedXpAwarded: true } }
    );

    if (xpLock.modifiedCount === 1) {
      await xpHelper.addXP(answer.studentId, xp.ACCEPTED_ANSWER);
    }

    return { ok: true };
  },

  rejectAnswer: async (answerId, teacherId) => {
    if (!ObjectId.isValid(answerId)) {
      return { ok: false };
    }

    const answer = await answers().findOne({ _id: new ObjectId(answerId) });
    if (!isStudentAnswer(answer)) {
      return { ok: false };
    }

    await answers().updateOne(
      { _id: answer._id },
      {
        $set: {
          reviewStatus: "rejected",
          reviewedAt: new Date(),
          reviewedBy: new ObjectId(teacherId),
        },
      }
    );

    return { ok: true };
  },
};
