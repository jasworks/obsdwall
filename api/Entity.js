var path = require('path');
var fs = require('fs');
var fsp = require('fs').promises;
var crypto = require('crypto');
var shell = require('child_process');
var saltRounds = 10;
var os=require('os');

//var express = require("express");
//var router = express.Router();
//var apikey = require("./apikey");
const configTmplPath='./tmpl';

var debug=require("debug")("api:entity");

const dataPrefixPath="./data/";
const apiPrefixPath="/api/";

class Entity {
  static get APPLIES_TO_APPLICABILITY() {return 20};
  static get APPLIES_TO_ALL(){return 30};
  static get APPLIES_TO_INDIVIDUAL() {return 40};
  static get RCCTL_START() {return "start"};
  static get RCCTL_STOP() {return "stop"};
  static get RCCTL_SET() {return "set"};
  static get RCCTL_ENABLE(){return "enable"};
  static get RCCTL_DISABLE(){return "disable"};

  constructor(nameOfEntity){
    try{
      this.name=nameOfEntity;
      var data=fs.readFileSync(this.filepath);
      this.entries=JSON.parse(data);
      var modified=0;
      for (var key in this.entries){
        switch (this.validate(this.entries[key])){
        case 0:
          debug("Serious issue, this shouldn't happen unless you mess with the JSON data files !!!");
          break;
        case 1:
          break;
        case 2:
          modified++;
          break;
        }
      }
      if (modified){
        debug("data file modified after validation, saving again");
        let data=JSON.stringify(this.entries,null,4);
        fs.writeFileSync(this.filepath,data);
      }
      this.requirePopulation=false;
    }catch(e){
      debug("File read error: ",e);
      this.entries={};
      this.requirePopulate=true;
    }
  }

  get applicabilityScope() {
    debug('Inherit getter applicabilityScope() to identify the scope of applicability: ',Entity.APPLIES_TO_ALL);
    return Entity.APPLIES_TO_ALL;
  }

  get router(){
    if (this.__router){
      return this.__router;
    }
    var express = require("express");
    this.__router=express.Router();
    this.__router.get("",(req,res,next)=>this.getList(req,res,next));
    this.__router.get("/*",(req,res,next)=>this.getEntity(req,res,next));
    this.__router.post("",(req,res,next)=>this.post(req,res,next));
    this.__router.patch("",(req,res,next)=>this.patchAll(req,res,next));
    this.__router.patch("/*",(req,res,next)=>this.patch(req,res,next));
    this.__router.put("/*",(req,res,next)=>this.put(req,res,next));
    this.__router.delete("/*",(req,res,next)=>this.delete(req,res,next));
    return this.__router;
  }

  getList(req,res,next){
    res.send(this.entries);
  }

  getEntity(req,res,next){
    debug("get/",req.url.toString());
    var entityName=path.basename(req.url.toString());
    if (!this.entries[entityName]){
        res.sendStatus(404);
    }else{
      res.send(this.entries[entityName]);
    }
  }

  post(req,res,next){
    debug("post()");
    var body=req.body;
    if (!(body && body.name)){
      res.sendStatus(400);
      return;
    }else{
      if (this.entries[body.name]){
      // Send 409 if an entry of same name already exist.
        res.sendStatus(409);
        return;
      }
      if (!this.validate(body)){
        res.sendStatus(400);
        return;
      }
      this.postEntry(body,(err)=>{
        if (err){
          res.sendStatus(500);
          return;
        }
        res.setHeader("Location",path.join(apiPrefixPath,this.name,body.name));
        res.sendStatus(201);
      });
    }
  }

  put(req,res,next){
    var body=req.body;
    var entityName=path.basename(req.url.toString());
    debug("put/",req.url.toString());
    if (body && body.name && this.validate(body)){
      if (entityName!=body.name){
        res.sendStatus(404);
        return;
      }
      if (!this.entries[entityName]){
        res.sendStatus(404);
        return; 
      }
      this.postEntry(body,(err)=>{
        if (err){
          res.sendStatus(500);
        }else{
          res.setHeader("Location",path.join(apiPrefixPath,this.name,entityName));
          res.sendStatus(201);
        }
      });
    }
  }

  patch(req,res,next){
    var body;
    var name;
    var entityName=path.basename(req.url.toString());
    debug("patch() /",entityName);
    switch (this.applicabilityScope){
    case Entity.APPLIES_TO_INDIVIDUAL:
      debug("Applying to individual");
      body=this.entries[entityName];
      name=entityName;
    break;
    case Entity.APPLIES_TO_APPLICABILITY:
      debug("Applying to applicability");
      if (this.entries[entityName]){
        name=this.entries[entityName].appliesto;
        body=this.__allEntriesApplicable(name);
      }
    break;
    case Entity.APPLIES_TO_ALL:
      debug("Applying to all");
      body=null;
    break;
    }
    if (!body){
      res.sendStatus(404);
      return;
    }
    debug("calling apply");
    this.apply(name,body,(err)=>{
      if (err){
        debug("apply callback error");
        res.status(err.code).send(err.message);
        debug("apply callback completed");
        return;
      }
      fs.copyFile(this.filepath, this.filepath+".lock", fs.COPYFILE_FICLONE, (err)=>{
        if (err){
          res.sendStatus(401);
          debug("copy file error: ",err);
        }else{
          res.setHeader("Location",path.join(apiPrefixPath,this.name,entityName));
          res.sendStatus(201);
          debug("apply callback completed");
        }
      });
    });

    debug("apply() returned");
  }

  patchAll(req,res,next){
    debug("patch()");
    this.applyAll((err)=>{
      if (err){
        res.status(err.code).send(err.message);
        return;
      }
      fs.copyFile(this.filepath, this.filepath+".lock", fs.COPYFILE_FICLONE, (err)=>{
        if (err){
          res.sendStatus(401);
          debug("copy file error: ",err);
        }else{
          res.sendStatus(200);
        }
      });
    });
  }

  delete(req,res,next){
    debug("delete()");
    var entityName=path.basename(req.url.toString());
    if (this.entries[entityName]){
      delete this.entries[entityName];
      let data=JSON.stringify(this.entries,null,4);
      fs.writeFile(this.filepath,data,(err)=>{
        if (err){
          res.sendStatus(500);
        }else{
          res.sendStatus(200);
        }
      });
    }else{
      res.sendStatus(404);
    }
  }

  get filepath(){
    return path.join('./data/',(this.name+'.json'));
  }

  postEntry(newentry, callback){
    debug("postEntry()");
    newentry.lastModified=Date.now();
    this.entries[newentry.name]=newentry;
    let data=JSON.stringify(this.entries, null, 4);
    fs.writeFile(this.filepath,data,(err)=>{
      callback(err);
    });
  }

  validate(body){
    debug("validate - you must inherit and define function validate(body)");
    return 0;
  }

  async initiate(){
    debug("initiate()");
    if (this.requirePopulate){
      await this.populate();
      debug("populated");
      return new Promise(resolve=>{
        let data=JSON.stringify(this.entries,null,4);
        fs.writeFile(this.filepath,data,(err)=>{
          if(err){
            debug("Write file rror");
          }
          resolve(null);
        });
      });
    }else return null;
  }

  async populate(){
    debug("Inherit this function to pre-populate information when there is no entry");
    return this;
  }

  __allEntriesApplicable(applicability){
    var subEntries={};
    for (var key in this.entries){
      if (this.entries[key].appliesto===applicability){
        subEntries[key]=this.entries[key];
      }
    }
    debug("__allEntriesApplicable:",subEntries);
    return subEntries;
  }

  __allApplicableEntries(){
    var applicableKeys=new Set();
    for (var key in this.entries){
      debug("__allApplicableEntries:",this.entries[key].appliesto);
      applicableKeys.add(this.entries[key].appliesto);
    }
    debug("ApplicableKeys:",applicableKeys);
    return applicableKeys;
  }

  get configTemplatePath(){
    return path.join(configTmplPath,(this.name+".tmpl"));
  }

  configFilename(name){
    debug('You must implement configFilename(name) to indicate the name of the file.');
    return null;
  }

  get configPath(){
    debug('You must implement configFolder() to indicate where the configuration file is.');
    return "/tmp/";
  }

  get configPermission(){
    debug('If you omit this, default permission of configuration will be set to 600');
    return {
      "permission": 600,
      "group": "wheel",
      "owner": "root"
    };
  }

  generate(name,body, configFile){
    debug('You must implement generate(name, body, configFile) to generate the content of the file, or use replace functions to replace contents of the file');
    return;
  }

  restartService(name,body,configFile){
    debug('Inherit restartService(',name,') to restart the service, if name is null, then the overall service should be restarted');
  }

  static async rcctl(serviceName, command, flags){
    var cmd="/usr/sbin/rcctl ";
    switch(command){
      case Entity.RCCTL_START:
        cmd=cmd+command+" "+serviceName;
      break;
      case Entity.RCCTL_STOP:
        cmd=cmd+command+" "+serviceName;
      break;
      case Entity.RCCTL_SET:
        cmd=cmd+command+" "+serviceName+" "+flags;
      break;
      case Entity.RCCTL_DISABLE:
        cmd=cmd+command+" "+serviceName;
      break;
      case Entity.RCCTL_ENABLE:
        cmd=cmd+command+" "+serviceName;
      break;
    }
    await Entity.shell(cmd,true);
  }

  static async rclink(serviceName, suffix){
    var rcPath="/etc/rc.d";
    var newServiceName=serviceName+"_"+suffix;

    var oldServicePath=path.resolve(path.join(rcPath,serviceName));
    var newServicePath=path.resolve(path.join(rcPath,newServiceName));

    var lstat;
    try {
      lstat=await fsp.lstat(newServicePath);
    }catch(err){
      debug (err);
      lstat=null;
    }
    if (lstat){
      debug("checking if file is a symbolic link");
      if (lstat.isSymbolicLink()){
        var linkName=await fsp.readlink(newServicePath);
        debug("readlink() returned",linkName);
        if (!(path.basename(linkName)===serviceName)){
          var err=new Error("/etc/rc.d/"+newServiceName+" is not a right symbolic name to service "+serviceName);
          err.status=500;
          throw err;
          return null;
        }else{
          return newServiceName;
        }
      }else{
        var err=new Error(newServicePath+" is not a Symbolic Link!!!");
        err.status=500;
        throw err;
      }
    }else{
      var cmd="/bin/ln -s "+oldServicePath+" "+newServicePath;
      await Entity.shell(cmd,true);
      return newServiceName;
    }
  }

  async apply(name,body,callback){
    try{
      debug("Applying configuration for ",name);
      var dir=await this.createTmpPath(name);
      var configFile=path.resolve(path.join(dir,this.configFilename(name)));
      await this.__applyPrivate(name,body, configFile);
      callback(null);
    }catch (err){
      debug(err);
      err.code=500
      callback(err);
    }
    try{
      await this.removePath(dir);
    }catch(err){
      debug(err);
    }
  }

  async __applyPrivate(name,body,configFile){
      debug("__applyPrivate()");
      debug("copying",this.configTemplatePath,configFile);
      try{
        await this.copyFile(this.configTemplatePath,configFile);
      }catch (err){
        debug("No config file template, skipping");
      }
      debug("generating configuration for",name,configFile);
      await this.generate(name,body,configFile);
      debug("copy configuration for",name,configFile);
      await this.copyToConfigPath(configFile);
      await this.changeOwnerAndPermission(configFile);
      debug("restarting service");
      await this.restartService(name,body,configFile);
      debug("__applyPrivate() completed");
  }

  async applyAll(callback){
    debug("applyAll()",this.applicabilityScope);
    try{
      var dir=await this.createTmpPath('');
    }catch (err){
      callback(err);
    }
    switch (this.applicabilityScope){
    case Entity.APPLIES_TO_INDIVIDUAL:
      debug("Apply to individual");
      try{
        for (var key in this.entries){ 
          var body=this.entries[key];
          var configFile=path.resolve(path.join(dir,this.configFilename(key)));
          await this.__applyPrivate(key,body,configFile);
          await this.restartService(key,body,configFile);
        }
        callback(null);
      }catch(err){
        debug(err);
        err.code=500;
        callback(err);
      }
    break;
    case Entity.APPLIES_TO_ALL:
      debug("Applying to all");
      try{
        var configFile=path.resolve(path.join(dir,this.configFilename(null)));
        await this.__applyPrivate(this.name,this.entries,configFile);
        await this.restartService(this.name,this.entries,configFile);
        callback(null);
      }catch(err){
        debug(err);
        err.code=500;
        callback(err);
      }
    break;
    case Entity.APPLIES_TO_APPLICABILITY:
      debug("Applying to applicability");
      try{
        var keys=this.__allApplicableEntries();
        for (var key of keys){ 
          debug ("Applying on:",key);
          var bodies=this.__allEntriesApplicable(key);
          var configFile=path.resolve(path.join(dir,this.configFilename(key)));
          await this.__applyPrivate(key,bodies,configFile);
          await this.restartService(key,bodies,configFile);
        }
        callback(null);
      }catch(err){
        debug(err);
        err.code=500;
        callback(err);
      }
    break;
    }
    try{
      await this.removePath(dir);
    }catch(err){
      debug(err);
    }
  }

  copyFile(dirFrom, dirTo){
    return new Promise((resolve,reject)=>{
      dirFrom=path.resolve(dirFrom);
      dirTo=path.resolve(dirTo);
      debug('Copying from:',dirFrom,'to',dirTo);
      fs.copyFile(dirFrom, dirTo, (err)=>{
        if (err) reject(err);
        else{
          debug("Config file copied from",dirFrom,"to",dirTo);
          resolve(dirTo);
        }
      });
    });
  }

  createTmpPath(dir){
    return new Promise((resolve,reject)=>{
      fs.mkdtemp(path.join(os.tmpdir(),('obsdwall-'+dir+"-")), (err, dir)=> {
        if (err) reject(err);
        else {
          debug("Temp directory created to hold config file:",dir);
          resolve(dir);
        }
      });
    });
  }

  removePath(dir){
    return new Promise((resolve,reject)=>{
      dir=path.resolve(dir);
      fs.rmdir(dir, {recursive:true}, (err)=> {
        if (err) reject(err);
        else {
          debug("Temp folder removed:",dir);
          resolve();
        }
      });
    });
  }

  async copyToConfigPath(configFile){
    var targetFile=path.resolve(this.configPath,path.basename(configFile));
      configFile=path.resolve(configFile);
    var cmd="/bin/cp "+configFile+" "+targetFile;
    await Entity.shell(cmd,true);
  }

  async changeOwnerAndPermission(configFile){
    var targetFile=path.resolve(this.configPath,path.basename(configFile));
    var cmd="/sbin/chown "+this.configPermission.owner+":"+this.configPermission.group+" "+targetFile;
    await Entity.shell(cmd,true);
    cmd="/bin/chmod "+this.configPermission.permission+" "+targetFile;
    await Entity.shell(cmd,true);
  }

  static shell(cmd, doas){
    if (doas){
      cmd="/usr/bin/doas -n "+cmd
    }
    debug("shell:",cmd);
    return new Promise((resolve, reject)=>{
      shell.exec(cmd, (err,stdout,stderr)=>{
        if (err){
          reject(err);
          return;
        }else resolve(stdout);
      });      
    });
  }
}

module.exports = Entity;
