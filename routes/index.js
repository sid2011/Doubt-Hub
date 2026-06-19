var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});
router.get('/signup',(req,res)=>{
  res.render('signup_page')
})
router.get('/login',(req,res)=>{
  res.render('login_page')
})
router.get('/doubt',(req,res)=>{
  res.render('partials/navbar')
})

module.exports = router;
