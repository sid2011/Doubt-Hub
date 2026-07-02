const db=require('../config/connections')
const collection=require('../config/collections')
const bcrypt=require('bcrypt')
const { ObjectId } = require('mongodb')

module.exports={
doSignup:async(userData)=>{
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

    return doubts;
}
}