var express = require("express");
var router = express.Router();
const userHelper = require("../helpers/user-helper");
const collections = require("../config/collections");
const { ObjectId } = require("mongodb");
const db = require("../config/connections");
const dayjs = require("dayjs");
const relativeTime = require("dayjs/plugin/relativeTime");
const xpHelper = require("../helpers/xpsystem-helper");
dayjs.extend(relativeTime);
const xp = require("../config/xp-points");
const aiService = require("../services/aiService");
/* GET home page. */
const verify = (req, res, next) => {
  if (req.session && req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
};

router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});
router.get("/signup", (req, res) => {
  res.render("user/user_auth/signup_page");
});
router.post("/signup", (req, res) => {
  userHelper.doSignup(req.body).then((response) => {
    res.redirect("/login");
  });
});

router.get("/login", (req, res) => {
  res.render("user/user_auth/login_page");
});
router.post("/login", async (req, res) => {
  const response = await userHelper.doLogIn(req.body);

  if (response.status) {
    req.session.loggedIn = true;
    req.session.user = response.user;

    const today = new Date().toISOString().split("T")[0];

    if (response.user.lastLoginBonus !== today) {
      await xpHelper.addXP(response.user._id, xp.DAILY_LOGIN);

      await db
        .get()
        .collection(collections.STUDENT_COLLECTION)
        .updateOne(
          { _id: new ObjectId(response.user._id) },
          {
            $set: {
              lastLoginBonus: today,
            },
          },
        );
    }

    res.redirect("/doubts");
  } else {
    res.render("user/user_auth/login_page");
  }
});
router.get("/doubts", verify, async (req, res) => {
  const [userInfo,leaderboardItems] = await Promise.all([
  db.get().collection(collections.STUDENT_COLLECTION).findOne({ _id: new ObjectId(req.session.user._id) }),
  db.get().collection(collections.STUDENT_COLLECTION).find({}).sort({ xp: -1 }).toArray()
]);
const topLeaderboard = leaderboardItems.slice(0, 10);
  const rank = leaderboardItems.findIndex(
    student => student._id.equals(userInfo._id)
) + 1;
let xpReward = req.session.xpReward;
req.session.xpReward = null;
  userHelper.showDoubt(req.session.user, req.query.subject).then((response) => {
    res.render("user/doubt-section", {
      response,
      userInfo,
      userName: userInfo.name,
      userXP: userInfo.xp,xpReward,userLevel:userInfo.level,
      topLeaderboard,
      rank
    });
  });
});

router.get("/logout", (req, res) => {
  req.session.loggedIn = false;
  req.session.user = null;
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/login");
    }
  });
});
router.post("/ask-doubt", verify, async (req, res) => {
  const studentId = req.session.user._id;

  const doubt = {
    studentId: new ObjectId(studentId),
    title: req.body.title.trim(),
    description: req.body.description.trim(),
    subject: req.body.subject,
    class: req.body.class,
    createdAt: new Date(),
  };
 const [result]= await Promise.all([
    userHelper.askDoubt(doubt),
    xpHelper.addXP(studentId, xp.ASK_DOUBT),
  ]);req.session.xpReward = {
    amount: xp.ASK_DOUBT
};
console.log(result.insertedId)
const savedDoubt = await db.get()
    .collection(collections.DOUBT_COLLECTION)
    .findOne({
        _id: result.insertedId
    });
    aiService.generateAIAnswer(savedDoubt.title)
    .then(async (aiAnswer) => {

        await db.get()
            .collection(collections.ANSWER_COLLECTION)
            .insertOne({
                doubtId: savedDoubt._id,
                role: "ai",
                answer: aiAnswer,
                createdAt: new Date()
            });

        console.log("AI answer saved successfully 🤖");

    })
    .catch((error) => {
        console.error("AI generation failed:", error);
    });
console.log(savedDoubt);
  res.redirect("/doubts");
});
router.get("/terms-conditions", (req, res) => {
  res.render("user/terms-conditions");
});
router.post('/doubts/:id/like',verify,async(req,res)=>{
  let doubtId=req.params.id
  let studentId=req.session.user._id
  let doubt=await db.get().collection(collections.DOUBT_COLLECTION).findOne({_id:new ObjectId(doubtId)})
  const alreadyLiked = doubt.likes
    ? doubt.likes.includes(studentId)
    : false;
  if(alreadyLiked){
await db.get()
    .collection(collections.DOUBT_COLLECTION)
    .updateOne(
        { _id: new ObjectId(doubtId) },
        {
            $pull: {
                likes: studentId
            }
        }
    );
  }else{
await db.get().collection(collections.DOUBT_COLLECTION).updateOne({_id:new ObjectId(doubtId)},{$addToSet:{likes:studentId}});
  }
  console.log("RECIVED",doubtId)
  console.log("StudentId:",studentId)
  let updatedDoubt= await db.get().collection(collections.DOUBT_COLLECTION).findOne({_id:new ObjectId(doubtId)})
  return res.json({
    liked: !alreadyLiked,
    likeCount:updatedDoubt.likes.length
});
})
router.get("/answer-doubt/:id", verify, async (req, res) => {
  const doubtId = new ObjectId(req.params.id);
  const [doubt, answers] = await Promise.all([
    userHelper.getDoubt(doubtId),
    userHelper.getAnswers(doubtId),
  ]);

  res.render("user/answer-doubt", { doubt, answers, doubtId });
});
router.post("/answer-doubt", verify, async (req, res) => {
  const answer = {
    doubtId: new ObjectId(req.body.doubtId),
    studentId: new ObjectId(req.session.user._id),
    answer: req.body.answer,
    createdAt: new Date(),
  };

  // Get the doubt
  const doubt = await db
    .get()
    .collection(collections.DOUBT_COLLECTION)
    .findOne({ _id: new ObjectId(req.body.doubtId) });

  // Save the answer
  await db.get().collection(collections.ANSWER_COLLECTION).insertOne(answer);
  // Award XP only if answering someone else's doubt
  if (doubt.studentId.toString() !== answer.studentId.toString()) {
    await xpHelper.addXP(answer.studentId, xp.ANSWER_DOUBT);
  }
  req.session.xpReward = {
    amount: xp.ANSWER_DOUBT
};
  res.redirect("/doubts");
});
module.exports = router;
