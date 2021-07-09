var Entity=require('./Entity.js');
var debug=require('debug')('api:host');
var stream=require('stream');
var readline=require('readline');
var fsp=require('fs').promises;
var subnet=require('ip-subnet-calculator');

class Host extends Entity{
  validate(body){
    debug("validating",body.name);
    if (!subnet.isIp(body.IPv4))return 0;
    debug("IPv4 correct");

    var hostRegex=new RegExp("^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$");
    if (!hostRegex.test(body.name))return 0;
    debug("hostname correct");
    
    try{
      for (var alias of body.aliases){
        if (!hostRegex.test(alias))return 0;
      }
    }catch (err){
      debug(err);
      return 0;
    }

    /*
    var macRegex=new RegExp("^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$");
    if (!macRegex.test(body.mac))return 0;
    debug("mac correct");
    */
    debug("validated");
    return 1;
  }

  configFilename(name){
    return "hosts";
  }

  get applicabilityScope(){
    return Entity.APPLIES_TO_ALL;
  }

  async generate(name,entries,configFile){

    if (!entries)return false;
    debug("Writing to ",configFile);

    var buf="";
    for (var key in entries){
      var body=entries[key];
      buf=buf+body.IPv4+" "+name;
      for (var alias in body.aliases){
        buf=buf+" "+body.aliases[alias];
      }
      buf=buf+"\n";
    }

    await fsp.writeFile(configFile,buf);

  }

  async populate(){
  }

  async restartService(name){
    await Entity.rcctl("dnsmasq",Entity.RCCTL_STOP);
    await Entity.rcctl("dnsmasq",Entity.RCCTL_START);
    return;
  }
}

module.exports = Host
