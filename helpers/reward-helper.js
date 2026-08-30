const { ObjectId } = require("mongodb");
const db = require("../config/connections");
const collection = require("../config/collections");

module.exports.rewardXp=async(userId,amount)=>{
    await db.get()
    .collection(collection.STUDENT_COLLECTION)
    .updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { xpReward: amount } }
    );
}