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

function teachers() {
  return db.get().collection(collections.TEACHER_COLLECTION);
}

function isStudentAnswer(answer) {
  return Boolean(answer && answer.role !== "ai" && answer.studentId);
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

function pendingForSubjectPipeline(subject) {
  return [
    { $match: pendingStudentAnswerFilter },
    {
      $lookup: {
        from: collections.DOUBT_COLLECTION,
        localField: "doubtId",
        foreignField: "_id",
        as: "doubt",
      },
    },
    { $unwind: "$doubt" },
    { $match: { "doubt.subject": subject } },
  ];
}

async function doubtMatchesSubject(answer, subject) {
  if (!isStudentAnswer(answer) || !subject) {
    return false;
  }

  const doubt = await db
    .get()
    .collection(collections.DOUBT_COLLECTION)
    .findOne({ _id: new ObjectId(answer.doubtId) });

  return Boolean(doubt && doubt.subject === subject);
}

module.exports = {
  getTeacherById: async (teacherId) => {
    if (!ObjectId.isValid(teacherId)) {
      return null;
    }

    return teachers().findOne(
      { _id: new ObjectId(teacherId) },
      { projection: { password: 0 } }
    );
  },

  countPendingAnswers: async (subject) => {
    if (!subject) {
      return 0;
    }

    const result = await answers()
      .aggregate([...pendingForSubjectPipeline(subject), { $count: "n" }])
      .toArray();

    return result[0] ? result[0].n : 0;
  },

  listRecentPending: async (subject, limit = 8) => {
    if (!subject) {
      return [];
    }

    return answers()
      .aggregate([
        ...pendingForSubjectPipeline(subject),
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
      ])
      .toArray();
  },

  getNextPending: async (subject) => {
    if (!subject) {
      return null;
    }

    const items = await answers()
      .aggregate([
        ...pendingForSubjectPipeline(subject),
        { $sort: { createdAt: 1 } },
        { $limit: 1 },
        {
          $lookup: {
            from: collections.STUDENT_COLLECTION,
            localField: "studentId",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      ])
      .toArray();

    return items[0] || null;
  },

  getPendingById: async (answerId, subject) => {
    if (!ObjectId.isValid(answerId) || !subject) {
      return null;
    }

    const answer = await answers().findOne({
      _id: new ObjectId(answerId),
      ...pendingStudentAnswerFilter,
    });

    const item = await attachDoubtAndStudent(answer);
    if (!item || !item.doubt || item.doubt.subject !== subject) {
      return null;
    }

    return item;
  },

  verifyAnswer: async (answerId, teacherId, subject) => {
    if (!ObjectId.isValid(answerId)) {
      return { ok: false };
    }

    const answer = await answers().findOne({ _id: new ObjectId(answerId) });
    if (!(await doubtMatchesSubject(answer, subject))) {
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

  rejectAnswer: async (answerId, teacherId, subject) => {
    if (!ObjectId.isValid(answerId)) {
      return { ok: false };
    }

    const answer = await answers().findOne({ _id: new ObjectId(answerId) });
    if (!(await doubtMatchesSubject(answer, subject))) {
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
