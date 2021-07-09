var express = require('express');
var os = require('os');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
    hostname: os.hostname(),
    release: os.release(),
    interfaces: os.networkInterfaces()
  });
});

module.exports = router;
