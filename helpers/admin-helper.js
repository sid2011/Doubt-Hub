const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const dayjs = require("dayjs");
const db = require("../config/connections");
const collections = require("../config/collections");
const SUBJECTS = require("../config/subjects");

function students() {
  return db.get().collection(collections.STUDENT_COLLECTION);
}

function teachers() {
  return db.get().collection(collections.TEACHER_COLLECTION);
}

function admins() {
  return db.get().collection(collections.ADMIN_COLLECTION);
}

function doubts() {
  return db.get().collection(collections.DOUBT_COLLECTION);
}

function answers() {
  return db.get().collection(collections.ANSWER_COLLECTION);
}

function isActive(doc) {
  return !doc || doc.active !== false;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }
  return dayjs(value).format("DD MMM YYYY");
}

function safeId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

async function emailTaken(email) {
  const query = { email };
  const [teacher, student, admin] = await Promise.all([
    teachers().findOne(query, { projection: { _id: 1 } }),
    students().findOne(query, { projection: { _id: 1 } }),
    admins().findOne(query, { projection: { _id: 1 } }),
  ]);
  return Boolean(teacher || student || admin);
}

module.exports = {
  getCounts: async () => {
    const [studentCount, teacherCount, doubtCount, answerCount] =
      await Promise.all([
        students().countDocuments({}),
        teachers().countDocuments({}),
        doubts().countDocuments({}),
        answers().countDocuments({}),
      ]);

    return { studentCount, teacherCount, doubtCount, answerCount };
  },

  listTeachers: async () => {
    const items = await teachers()
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    return items.map((teacher) => ({
      ...teacher,
      createdAtLabel: formatDate(teacher.createdAt),
      isActive: isActive(teacher),
      statusLabel: isActive(teacher) ? "Active" : "Inactive",
    }));
  },

  createTeacher: async ({ name, email, password, subject }) => {
    const trimmedName = (name || "").trim();
    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedPassword = password || "";
    const trimmedSubject = (subject || "").trim();

    if (!trimmedName || !trimmedEmail || !trimmedPassword || !trimmedSubject) {
      return {
        ok: false,
        error: "Name, email, password, and subject are required.",
      };
    }

    if (!trimmedEmail.includes("@")) {
      return { ok: false, error: "Enter a valid email address." };
    }

    if (trimmedPassword.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }

    if (!SUBJECTS.includes(trimmedSubject)) {
      return { ok: false, error: "Choose a valid subject." };
    }

    if (await emailTaken(trimmedEmail)) {
      return { ok: false, error: "That email is already in use." };
    }

    const hashed = await bcrypt.hash(trimmedPassword, 10);

    await teachers().insertOne({
      name: trimmedName,
      email: trimmedEmail,
      password: hashed,
      role: "teacher",
      subject: trimmedSubject,
      active: true,
      createdAt: new Date(),
    });

    return { ok: true };
  },

  setTeacherActive: async (teacherId, active) => {
    const id = safeId(teacherId);
    if (!id) {
      return { ok: false, error: "Invalid teacher." };
    }

    const result = await teachers().updateOne(
      { _id: id },
      { $set: { active: Boolean(active) } }
    );

    if (!result.matchedCount) {
      return { ok: false, error: "Teacher not found." };
    }

    return { ok: true };
  },

  listStudents: async () => {
    const items = await students()
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    return items.map((student) => ({
      ...student,
      isActive: isActive(student),
      statusLabel: isActive(student) ? "Active" : "Inactive",
      xp: student.xp || 0,
      level: student.level || 1,
      classLabel: student.class || "—",
    }));
  },

  setStudentActive: async (studentId, active) => {
    const id = safeId(studentId);
    if (!id) {
      return { ok: false, error: "Invalid student." };
    }

    const result = await students().updateOne(
      { _id: id },
      { $set: { active: Boolean(active) } }
    );

    if (!result.matchedCount) {
      return { ok: false, error: "Student not found." };
    }

    return { ok: true };
  },

  listDoubts: async () => {
    const items = await doubts()
      .aggregate([
        { $sort: { createdAt: -1 } },
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

    return items.map((doubt) => ({
      _id: doubt._id,
      title: doubt.title || "Untitled",
      subject: doubt.subject || "—",
      studentName: (doubt.student && doubt.student.name) || "Unknown",
      createdAtLabel: formatDate(doubt.createdAt),
    }));
  },

  listAnswers: async () => {
    const items = await answers()
      .aggregate([
        { $sort: { createdAt: -1 } },
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

    return items.map((answer) => {
      const isAi = answer.role === "ai";
      const text = answer.answer || "";
      const preview =
        text.length > 160 ? text.slice(0, 160).trim() + "…" : text;

      return {
        _id: answer._id,
        authorName: isAi
          ? "DoubtHub AI"
          : (answer.student && answer.student.name) || "Unknown",
        preview,
        reviewStatus: isAi ? "—" : answer.reviewStatus || "pending",
        createdAtLabel: formatDate(answer.createdAt),
      };
    });
  },

  deleteDoubt: async (doubtId) => {
    const id = safeId(doubtId);
    if (!id) {
      return { ok: false, error: "Invalid doubt." };
    }

    const doubt = await doubts().findOne({ _id: id });
    if (!doubt) {
      return { ok: false, error: "Doubt not found." };
    }

    await answers().deleteMany({ doubtId: id });
    await doubts().deleteOne({ _id: id });

    return { ok: true };
  },

  deleteAnswer: async (answerId) => {
    const id = safeId(answerId);
    if (!id) {
      return { ok: false, error: "Invalid answer." };
    }

    const result = await answers().deleteOne({ _id: id });
    if (!result.deletedCount) {
      return { ok: false, error: "Answer not found." };
    }

    return { ok: true };
  },
};
