var express = require('express');
var router = express.Router();
const userHelper = require('../helpers/user-helper');
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
   console.log("this is req body",req.body)
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
router.get('/doubts',(req,res)=>{
res.render('user/doubt-section');
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
router.get('/terms-conditions',(req,res)=>{
  res.render('user/terms-conditions')
})
module.exports = router;
