var Entity=require('./Entity.js');
var debug=require('debug')('api:iface');
var stream=require('stream');
var readline=require('readline');
var fsp=require('fs').promises;
var subnet=require('ip-subnet-calculator');

class IFace extends Entity{
  validate(body){
    debug("validating",body.name);
    if (body.dhcp===true){
      if ((body.IPv4) || (body.netmask4)) return 0;
    }
    if (body.IPv4){
      if (!subnet.isIp(body.IPv4))return 0;
      if (body.netmask4){
        if (!subnet.isIp(body.netmask4))return 0;
      }else return 0;
    }
    debug("validated");
    return 1;
  }

  configFilename(name){
    if (!name){
      return null;
    }
    return "hostname."+name;
  }

  get applicabilityScope(){
    return Entity.APPLIES_TO_INDIVIDUAL;
  }

  generate(name,body,configFile){
    if (!body)return false;
    var buf="";
    if (name.startsWith("bridge")){
      for (var key in this.entries){
        if(this.entries[key].bridge){
          if (this.entries[key].bridge===name){
            buf=buf+"add "+this.entries[key].name+"\n";
          }
        }
      }
    }
    if (body.dhcp){
      buf=buf+"dhcp\n";
    }else{
      if (body.IPv4 && body.netmask4){
        buf=buf+"inet "+body.IPv4+" netmask "+body.netmask4+"\n";
      }
    }
    buf=buf+"up\n";
    fsp.writeFile(configFile,buf);
    /*
    return new Promise((resolve,reject)=>{
      fs.writeFile(configFile,buf,(err)=>{
        if (err){
          reject(err);
        }else{
          resolve(true);
        }
      });
    });
    */
  }

  async populate(){
    var buf=await Entity.shell("ifconfig | grep \': flags\'");

    var bstream=new stream.PassThrough();
    bstream.end(buf);

    var rl=readline.createInterface({
      input: bstream
    });
  
    return new Promise(resolve=>{
      rl.on('line',(line)=>{
        var ifce=line.split(":")[0];
        debug(ifce);
        if (ifce){
          if (!(ifce.startsWith("vether") ||
              ifce.startsWith("enc") ||
              ifce.startsWith("tun") ||
              ifce.startsWith("pflog") ||
              ifce.startsWith("bridge") ||
              ifce.startsWith("lo") )) {
            var value={
              "name":ifce,
              "IPv4":"",
              "netmask4":"",
              "IPv6":"",
              "dhcp":false,
              "egress":false
            }
            this.entries[ifce]=value;
          }
        }
      });

      rl.on('pause',(line)=>{
        rl.close();
        resolve(null);
      });
    });
  }

  restartService(name){
    if (!name) return;
    debug ('sh /etc/netstart.sh',name);
  }
}

module.exports = IFace
