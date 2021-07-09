var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var debug = require("debug")("api:api.js");

var apikeyRouter = require('./api/apikey');
var DNSEntity = require('./api/dns');
var dns = new DNSEntity("dns");
var UserEntity = require('./api/user');
var user = new UserEntity("user");
var IFaceEntity = require('./api/iface');
var iface = new IFaceEntity('iface');
var HostEntity = require("./api/host");
var host = new HostEntity('host');
var MACEntity = require("./api/mac");
var mac = new MACEntity('mac');

var app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(logger('dev'));
app.use(express.json());
app.use('/api', apikeyRouter);


populateAll();

async function populateAll() {
  await populate('/api/dns',dns);
  await populate('/api/users',user);
  await populate('/api/iface',iface);
  await populate('/api/host',host);
  await populate('/api/mac',mac);

  app.use('/api', apikeyRouter);

// catch 404 and forward to error handler
  app.use(function(req, res, next) {
    next(createError(404));
  });

// error handler
  app.use(function(err, req, res, next) {
// set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

// render the error page
  res.status(err.status || 500).send(err.message);
//    res.sendStatus(err.message);
});
}

async function populate(path,object){
  debug("Populating",path);
  await object.initiate();
  app.use(path,object.router);
  debug("Populated",path);
  return;
}

module.exports = app;
