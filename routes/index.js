var express = require('express');
var router = express.Router();
const userHelper = require('../helpers/user-helper');
const collections = require('../config/collections');
const { ObjectId } = require('mongodb');
const db=require('../config/connections')
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
const xpHelper=require('../helpers/xpsystem-helper');
dayjs.extend(relativeTime);
const xp=require('../config/xp-points')
/* GET home page. */
const verify = (req, res, next) => {
  if (req.session && req.session.user) {
    next()
  } else {
    res.redirect('/login')
  }
}

router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});
router.get('/signup',(req,res)=>{
  res.render('user/user_auth/signup_page')
})
router.post('/signup',(req,res)=>{
  userHelper.doSignup(req.body).then((response)=>{
    res.redirect('/login')
  })
})

router.get('/login',(req,res)=>{
  res.render('user/user_auth/login_page')
})
router.post('/login', async (req, res) => {

    const response = await userHelper.doLogIn(req.body);

    if (response.status) {

        req.session.loggedIn = true;
        req.session.user = response.user;

        const today = new Date().toISOString().split('T')[0];

        if (response.user.lastLoginBonus !== today) {

            await xpHelper.addXP(response.user._id,xp.DAILY_LOGIN);

            await db.get()
                .collection(collections.STUDENT_COLLECTION)
                .updateOne(
                    { _id: new ObjectId(response.user._id) },
                    {
                        $set: {
                            lastLoginBonus: today
                        }
                    }
                );
        }

        res.redirect('/doubts');

    } else {
        res.render('user/user_auth/login_page');
    }

});
router.get('/doubts',verify,async(req,res)=>{
let userInfo=await db.get().collection(collections.STUDENT_COLLECTION).findOne({_id:new ObjectId(req.session.user._id)})
  userHelper.showDoubt(req.session.user,req.query.subject).then((response)=>{
    res.render('user/doubt-section', { response,userInfo,userName:userInfo.name,userXP:userInfo.xp });
  })
})

router.get('/logout',(req,res)=>{
  req.session.loggedIn = false
  req.session.user=null
  req.session.destroy((err)=>{
    if(err){
      console.log(err)
    }else{
res.redirect('/login')
    }
  })
})
router.post('/ask-doubt', verify, async (req, res) => {

    const studentId = req.session.user._id;

    const doubt = {
        studentId: new ObjectId(studentId),
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        subject: req.body.subject,
        class: req.body.class,
        createdAt: new Date()
    };

    await userHelper.askDoubt(doubt);

    // Award XP only if description has at least 40 characters
    if (doubt.description.length >= 40) {
        await xpHelper.addXP(studentId, xp.ASK_DOUBT);
    }

    res.redirect('/doubts');
});
router.get('/terms-conditions',(req,res)=>{
  res.render('user/terms-conditions')
})
router.get('/answer-doubt/:id',verify, async (req, res) => {
    const doubtId = new ObjectId(req.params.id);
    const [doubt, answers] = await Promise.all([
        userHelper.getDoubt(doubtId),
        userHelper.getAnswers(doubtId)
    ]);
console.log("this is doubt",doubt)
    res.render('user/answer-doubt', { doubt, answers ,doubtId});
});
router.post('/answer-doubt', verify, async (req, res) => {

    const answer = {
        doubtId: new ObjectId(req.body.doubtId),
        studentId: new ObjectId(req.session.user._id),
        answer: req.body.answer,
        createdAt: new Date()
    };

    // Get the doubt
    const doubt = await db.get()
        .collection(collections.DOUBT_COLLECTION)
        .findOne({ _id: new ObjectId(req.body.doubtId) });

    // Save the answer
    await db.get()
        .collection(collections.ANSWER_COLLECTION)
        .insertOne(answer);
console.log(doubt.studentId);
console.log(typeof doubt.studentId);
console.log(answer.studentId);
console.log(typeof answer.studentId);
    // Award XP only if answering someone else's doubt
    if (doubt.studentId.toString() !== answer.studentId.toString()) {
    await xpHelper.addXP(answer.studentId,xp.ANSWER_DOUBT);
}

    res.redirect('/doubts');
});
module.exports = router;
