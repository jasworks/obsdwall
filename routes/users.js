var express = require('express');
var path = require('path');
var fs = require('fs');
var router = express.Router();
var users = require(path.join(__dirname,'../lib/users.js'));
var debug = require('debug')('app:debug');


/* GET users listing. */
router.get('/', function(req, res, next) {
  users.list((userList)=>{
    res.render("users", {
     title: "User listing",
     users: userList
   });
  });
});

module.exports = router;
