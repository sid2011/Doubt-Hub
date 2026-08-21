const db = require("../config/connections");
const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const collections = require("../config/collections");
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");

dayjs.extend(relativeTime);

module.exports = {
  doSignup: async (userData) => {
    const avatar = `https://api.dicebear.com/10.x/fun-emoji/svg?seed=${userData.name}`;
    userData.avatar = avatar;
    userData.password = await bcrypt.hash(userData.password, 10);
    let response = await db
      .get()
      .collection(collections.STUDENT_COLLECTION)
      .insertOne(userData);
  },
  doLogIn: async (userData) => {
    let response = {};
    let user = await db
      .get()
      .collection(collections.STUDENT_COLLECTION)
      .findOne({ email: userData.email });
    if (!user) {
      return { status: false };
    }
    let status = await bcrypt.compare(userData.password, user.password);
    if (status) {
      response.user = user;
      response.status = true;
      return response;
    } else {
      return { status: false };
    }
  },
  askDoubt: async (doubt) => {
    await db.get().collection(collections.DOUBT_COLLECTION).insertOne(doubt);
  },
  showDoubt: async (userData, subject) => {
    let query = {
      class: userData.class,
    };

    if (subject) {
      query.subject = subject;
    }

   let doubts = await db.get().collection(collections.DOUBT_COLLECTION)
.aggregate([
    {
        $match: query
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
    }
]).toArray();
const studentId = userData._id;

doubts.forEach(doubt => {
    doubt.isLiked = doubt.likes
        ? doubt.likes.includes(studentId)
        : false;

});
    doubts.forEach((doubt) => {
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
          $unwind: "$student",
        },
      ])
      .toArray();
  },
};
