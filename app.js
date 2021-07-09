var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require("express-session");
var debug = require("debug")("app:app.js");
//var users = require('./lib/users');

var indexRouter = require('./routes/index');
//var usersRouter = require('./routes/users');
var aboutRouter = require('./routes/about');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

//app.use(logger('tiny'));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// include bootstrap css
app.use("/css", express.static(__dirname + "/node_modules/bootstrap/dist/css"));

// set up the session
app.use(
  session({
    secret: "app",
    name: "app",
    resave: true,
    rolling: true,
    saveUninitialized: true,
    cookie: { expires: 60*1000 }
  })
);

var logout = function(req, res, next) {
  req.session.loggedIn = false;
  res.redirect("/");
 };

var login = function(req, res, next) {
  var { username, password } = req.body;
  if (!username || !password || username.trim().length==0)
  {
      res.render("login", { title: "Login Here" });
  }else
  {
    users.verify(username,password,(success)=>{
      if (success){
        req.session.loggedIn = true;
        res.redirect("/");
      } else {
        debug("login()","Wrong credentials");
        res.render("login", { title: "Login Here", error: "Wrong credentials" });
      }
    });
  };
};

var checkUser = function(username, password) {
  debug("checkUser",username,password);
  if (username === "admin" && password ==="admin") return true;
  return false;
};

var checkLoggedIn = function(req, res, next) {
  debug("checkLoggedIn()");
  if (req.session.loggedIn) {
    next();
  } else {
    res.render("login", { title: "Login Here" });
  }
};

app.use('/users', checkLoggedIn, usersRouter);
app.use('/logout', logout, indexRouter);
app.use('/login', login, indexRouter);
app.use('/about', aboutRouter);
app.use('/', checkLoggedIn, indexRouter);

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
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
