var Entity=require('./Entity.js');
var debug=require('debug')('api:user');
var crypto=require('crypto');

class User extends Entity{
  validate(body){
    debug("validate");
    if (!body.password) return false;
    if (!body.salt){
      var newHash=this.hash(body.password);
      body.password=newHash.password;
      body.salt=newHash.salt;
      return 2;
    }else{
      return 1;
    }
  }

  apply(body,callback){
    debug("apply(body,callback)"); 
    callback(null);
  }

  hash(password) {
    var salt=crypto.randomBytes(16).toString('hex');
    var pw=crypto.pbkdf2Sync("admin",salt,1000,64,'sha512').toString('hex');
    return {
      salt: salt,
      password: pw
    };
  }
}

module.exports = User
