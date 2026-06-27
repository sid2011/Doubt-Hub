const db=require('../config/connection')
const collection=require('../config/collections')
const bcrypt=require('bcrypt')
const { ObjectId } = require('mongodb')

module.exports={
doSignup:async(userData)=>{
userData.password=await bcrypt.hash(userData.password,10)
let response=await db.get().collection(collection.STUDENT_COLLECTION).insertOne(userData)
}



}