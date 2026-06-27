var express = require('express');
var router = express.Router();
const userHelper = require('../helpers/user-helper');
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});
router.get('/signup',(req,res)=>{
  res.render('signup_page')
})
router.post('/signup',(req,res)=>{
   console.log("this is req body",req.body)
  userHelper.doSignup(req.body).then((response)=>{
    res.redirect('/login')
  })
})

router.get('/login',(req,res)=>{
  res.render('login_page')
})
router.get('/doubts',(req,res)=>{
res.render('user/doubt-section');
})

module.exports = router;
