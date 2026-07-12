const db=require('../config/connections')
const collection=require('../config/collections')
const bcrypt=require('bcrypt')
const { ObjectId } = require('mongodb')
const collections = require('../config/collections')
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");

dayjs.extend(relativeTime);

module.exports={
doSignup:async(userData)=>{
    const avatar = `https://api.dicebear.com/10.x/fun-emoji/svg?seed=${userData.name}`;
    userData.avatar=avatar
userData.password=await bcrypt.hash(userData.password,10)
let response=await db.get().collection(collection.STUDENT_COLLECTION).insertOne(userData)
},doLogIn:async(userData)=>{
    let response={}
let user=await db.get().collection(collection.STUDENT_COLLECTION).findOne({email:userData.email})
if(!user){
    return {status:false};
}let status=await bcrypt.compare(userData.password,user.password)
if(status){
response.user=user
response.status=true
 return response
}else {
        return { status: false }
    }
},askDoubt:async(doubt)=>{
await db.get().collection(collection.DOUBT_COLLECTION).insertOne(doubt)
},showDoubt:async(userData,subject)=>{
     let query = {
        class: userData.class
    };

    if (subject) {
        query.subject = subject;
    }

    let doubts = await db.get()
        .collection(collection.DOUBT_COLLECTION)
        .find(query)
        .toArray();
 doubts.forEach(doubt => {
        doubt.timeAgo = dayjs(doubt.createdAt).fromNow();
    });
    return doubts;
},getDoubt: async (doubtId) => {
    let doubts=await db.get()
        .collection(collections.DOUBT_COLLECTION)
        .findOne({ _id: doubtId });
        doubts.forEach(doubt => {
        doubt.timeAgo = dayjs(doubt.createdAt).fromNow();
        return doubts;
},
getAnswers:async(doubtId)=>{
    return db.get().collection(collections.ANSWER_COLLECTION)
        .aggregate([
            {
                $match: {
                    doubtId: doubtId
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
            }
        ])
        .toArray();
}
}
}