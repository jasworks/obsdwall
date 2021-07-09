var debug = require('debug')('api:apikey')
var express = require("express");
var router = express.Router();

router.get("*",function(req,res,next){
  debug("get()", req.url);
  if (check(req)){
    next();
  }else{
    res.sendStatus(403);
  }
});

router.post("*",function(req,res,next){
  debug("get()", req.url);
  if (check(req)){
    next();
  }else{
    res.sendStatus(403);
  }
});

router.put("*",function(req,res,next){
  debug("get()", req.url);
  if (check(req)){
    next();
  }else{
    res.sendStatus(403);
  }
});

router.patch("*",function(req,res,next){
  debug("get()", req.url);
  if (check(req)){
    next();
  }else{
    res.sendStatus(403);
  }
});

router.delete("*",function(req,res,next){
  debug("get()", req.url);
  if (check(req)){
    next();
  }else{
    res.sendStatus(403);
  }
});

function check(req){
  debug("check() ", req.headers);
  if (!req.headers.apikey){
    debug("Does not have API key");
    return false;
  }else{
    debug("Have API key");
    return true;
  }
}

module.exports = router;
