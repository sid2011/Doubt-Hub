var express = require('express');
var router = express.Router();
const userHelper = require('../helpers/user-helper');
const collections = require('../config/collections');
const { ObjectId } = require('mongodb');
const db=require('../config/connections')
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
router.post('/login',async(req,res)=>{
await userHelper.doLogIn(req.body).then((response)=>{
  if(response.status){
    req.session.loggedIn=true
    req.session.user=response.user
    res.redirect('/doubts')
  }else{
    res.render('user/user_auth/login_page')
  }
})
})
router.get('/doubts',verify,async(req,res)=>{
let userInfo=await db.get().collection(collections.STUDENT_COLLECTION).findOne({_id:new ObjectId(req.session.user._id)})
  userHelper.showDoubt(req.session.user,req.query.subject).then((response)=>{
    console.log(response);
    res.render('user/doubt-section', { response,userInfo });
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
router.post('/ask-doubt',verify,async(req,res)=>{
  const studentId = req.session.user._id;

    const doubt = {
        studentId: studentId,
        title: req.body.title,
        description: req.body.description,
        subject: req.body.subject,
        class: req.body.class,
        createdAt: new Date()
    };
await userHelper.askDoubt(doubt)
res.redirect('/doubts')
})
router.get('/terms-conditions',(req,res)=>{
  res.render('user/terms-conditions')
})
module.exports = router;
