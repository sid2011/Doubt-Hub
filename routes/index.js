var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});
router.get('/signup',(req,res)=>{
  res.render('signup_page', {
    css: "signup.css"
})
})
router.get('/login',(req,res)=>{
  res.render('login_page',{
    css: "login.css"
})
})
router.get('/doubts',(req,res)=>{
res.render('user/doubt-section');
})

module.exports = router;
