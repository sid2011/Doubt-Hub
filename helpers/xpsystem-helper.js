const { ObjectId } = require("mongodb");
const db = require("../config/connections");
const collection = require("../config/collections");

module.exports.addXP = async (userId, amount) => {
  // Increase XP
  await db
    .get()
    .collection(collection.STUDENT_COLLECTION)
    .updateOne(
      { _id: new ObjectId(userId) },
      {
        $inc: {
          xp: amount,
        },
      },
    );

  // Get updated user
  const user = await db
    .get()
    .collection(collection.STUDENT_COLLECTION)
    .findOne({
      _id: new ObjectId(userId),
    });

  // XP should never be negative
  if (user.xp < 0) {
    await db
      .get()
      .collection(collection.STUDENT_COLLECTION)
      .updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            xp: 0,
          },
        },
      );

    user.xp = 0;
  }

  // Calculate level
  const level = Math.floor(Math.sqrt(user.xp / 100)) + 1;

  // Save level
  await db
    .get()
    .collection(collection.STUDENT_COLLECTION)
    .updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          level: level,
        },
      },
    );
};
