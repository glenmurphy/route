var EventEmitter = require('events').EventEmitter;
var util = require('util');
var url = require('url');
var http = require('http');
var https = require('https');
var http = require('follow-redirects').http
var zlib = require('zlib');

function Ecobee(data) {

};
util.inherits(Ecobee, EventEmitter);

// get access token from https://www.ecobee.com/home/developer/api/examples/ex1.shtml

Ecobee.prototype.exec = function(command, params) {
  console.log("*  Ecobee Executing: [" + command + "] : " + JSON.stringify(params));

  if (command == "Stop") {
    this.stopCarUpdateLoop();
  } else if (command == "Start") { 
    this.startCarUpdateLoop(parseInt(params.intervalTime,10));
  } else if (command == "Honk") {
    // TODO
  } else if (command == "Lock") {
    this.sendAction("DOOR_LOCK")
    // TODO
  } else if (command == "Precondition") {
    
  }
};

Ecobee.prototype.startVehicleCheck = function() {
  if (this.isAuthCurrent()) {
    if(this.debug) console.log("*  Auth Token still valid");
    this.updateStatus();
  } else if (this.refreshToken) {
    if(this.debug) console.log("*  Logging in with Refresh Token");
    var post_data = "grant_type=refresh_token&refresh_token="+this.refreshToken;
    this.login(post_data);
  } else {
    if(this.debug) console.log("*  Logging in with User Credentials");
    var post_data = "grant_type=password" +
                    "&username="+this.username +
                    "&password="+this.password +
                    "&scope=remote_services+vehicle_data";
    this.login(post_data);
  }
};

Ecobee.prototype.isAuthCurrent = function() {
  // Auth tokens expire after 8 hours
  var currentTime = new Date();
  currentTime.setMinutes(currentTime.getMinutes() + 5);
  if (!this.accessToken || this.accessTokenExpirationDate <= currentTime) {
    return false;
  } else {
    return true;
  }
};

Ecobee.prototype.saveCredentials = function(data) {
  var currentTime = new Date();
  currentTime.setHours(currentTime.getHours() + 8);

  this.accessToken = data.access_token;
  this.accessTokenExpirationDate = currentTime;
  this.refreshToken = data.refresh_token;

  this.emit("DeviceEvent", "Connected");

  if(this.debug) console.log("*  Connected to BMW: Access Token - " + this.accessToken);
  if(this.debug) console.log("*  Connected to BMW: Access Token Time - " + this.accessTokenExpirationDate);
  if(this.debug) console.log("*  Connected to BMW: Refresh Token - " + this.refreshToken);
}

Ecobee.prototype.gunzipJSON = function(response, callback) {
  var gunzip = zlib.createGunzip();
  var json = "";

  gunzip.on('data', function(data){
      json += data.toString();
  });
      
  gunzip.on('end', function(){
      var data = JSON.parse(json);
      callback(data);
  }.bind(this));

  response.pipe(gunzip);
};

Ecobee.prototype.login = function(post_data) {
  var headers = {
    'Host': 'b2vapi.bmwgroup.us',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': this.bmwBase64Auth,
    'Accept-Encoding': 'gzip',
    'Content-Length': post_data.length,
    'Referer': this.bmwServerAuthURL.protocol + '//' + this.bmwServerAuthURL.hostname,
    'User-Agent': this.apiAgent
  };
  var post_options = {
    host: this.bmwServerAuthURL.hostname,
    path: this.bmwServerAuthURL.path,
    rejectUnauthorized: false,
    method: 'POST',
    maxRedirects: 3,
    headers: headers
  };

  // console.log(headers);
  // console.log(post_options);

  var req = https.request(post_options, function(response) {
    // console.log(response.statusCode);
    this.gunzipJSON(response, function(data) {
      this.saveCredentials(data);
      this.updateStatus();
    }.bind(this));
  }.bind(this));

  req.write(post_data);
  req.on('error', function(e) {console.log("!  Could not connect to BMW to log in (" + e + ")")});
  req.end();
};

// Ecobee.prototype.sendAction = function(action) {
// console.log("*  BMW Action:", action)
//   var statusString = this.bmwServerCmdString + action;
//   var statusURL = url.parse(statusString);

// var post_data = "serviceType=" + action
//   var headers = {
//     'Host': 'b2vapi.bmwgroup.us',
//     'Content-Type': 'application/json;charset=UTF-8',
//     'Authorization': 'Bearer '+this.accessToken,
//     'Accept-Encoding': 'gzip',
//     'Content-Length': post_data.length,
//     'Referer': statusURL.protocol + '//' + statusURL.hostname,
//     'User-Agent': this.apiAgent
//   };

//   var get_options = {
//     host: statusURL.hostname,
//     path: statusURL.path,
//     rejectUnauthorized: false,
//     method: 'POST',
//     maxRedirects: 3,
//     headers: headers
//   };

//   var req = https.request(get_options, function(response) {
//   	  this.gunzipJSON(response, function(data) {
// 	    console.log("*  Ecobee: Received response VIN: " + JSON.stringify(data));

// 	  }.bind(this));
//     // this.saveState(response);
//   }.bind(this))


//   req.write(post_data);
//   req.on('error', function(e) {console.log("!  Could not connect to BMW to set status (" + e + ")")});
//   req.end();
// }

module.exports = Ecobee;
