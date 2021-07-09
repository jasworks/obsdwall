var Entity=require('./Entity.js');
var debug=require('debug')('api:dns');
//var fs=require('fs');
var fsp=require('fs').promises;
var path=require('path');

class DNS extends Entity{
  validate(body){
    if (!body.appliesto){
      body.appliesto='unbound';
      return 2;
    }else return 1;
  }

  configFilename(name){
    return "unbound-"+name+".conf";
  }

  get applicabilityScope(){
    return Entity.APPLIES_TO_APPLICABILITY;
  }

  generate(name,entries,configFile){
    debug("Generating configuration file:",configFile);
    var buf="";
    var tls=false;
    for (var key in entries){
      if (entries[key].tlsname)tls=true;
    }
    if (tls){
      buf=buf+"        forward-tls-upstream: yes\n";
    }
    for (var key in entries){
      var body=entries[key];
      buf=buf+"        forward:addr: "+key;
      if (body.port){
        buf=buf+"@"+body.port;
      }
      if (body.tlsname){
        buf=buf+"#"+body.tlsname;
      }
      buf=buf+"\n";
    }
    fsp.appendFile(configFile,buf);
  }

  async restartService(name,body,configFile){
    var serviceName=await Entity.rclink("unbound",name);
    await Entity.rcctl(serviceName,Entity.RCCTL_ENABLE);

  }
}

module.exports = DNS;
