var EventEmitter = require('events').EventEmitter;
var http = require('http');
var url = require('url');
var util = require('util');
var oauth = require('oauth');
var xml2js = require('xml2js');
var storage = require('../storage').Storage;

Fitbit.PORT = 9040;
function Fitbit(data) {
  this.listenPort = data.listenPort || Fitbit.PORT;
  this.server = http.createServer(this.handleReq.bind(this)).listen(this.listenPort);
  this.users = data.users;
  this.oauth = new oauth.OAuth( '', '', data.token, data.secret, '1.0', null, 'HMAC-SHA1');
  this.debug = data.debug;
  this.storage = new storage("Fitbit");

  var lastcheck = new Date(this.storage.getItem("lastCheck"));
  lastcheck = new Date() - lastcheck;
  this.storage.setItem("lastCheck", new Date());

  if (lastcheck > 10 * 60 * 1000) {
    for (var user in this.users) {
      this.updateCollection(user, "activities");
      this.updateCollection(user, "body");
      this.updateCollection(user, "sleep");
      this.updateCollection(user, "heart");
      this.fetchSleepInfo(user);
    }
  }
}
util.inherits(Fitbit, EventEmitter);

Fitbit.prototype.handleReq = function(req, res) {
  console.log(req.url);
  var info = url.parse(req.url, true);
  if (req.method == 'POST') {
    var data = new Buffer('');
    req.on('data', function(chunk) { data = Buffer.concat([data, chunk]);});
    req.on('end', function() {
      var string = data.toString('utf-8');
      string = string.split("\r\n\r\n").pop();
      string = string.split("\r\n--").shift();
      var updates = JSON.parse(string);
      res.writeHead(204, {});
      res.end();
      this.handleUpdates(updates);
    }.bind(this));
  } else {
    res.writeHead(204, {});
    res.end();
  }
};

Fitbit.prototype.updateCollection = function(userId, type) {
  var date = new Date();
  date = [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-")
  var user = this.users[userId];
  var url = "http://api.fitbit.com/1/user/-/" + type + "/date/" + date + ".json";
  this.oauth.get(url, user.token, user.secret, function (err, data, response) {
     var state = {};
     try{
      state["fitbit." + userId + "." + type] = JSON.parse(data);
     } catch (e) {
       console.log("Could not parse fitbit", url, err, data, response.statusCode);
     }
     if (this.debug) console.log(JSON.stringify(state, null, '  '));
     this.emit("StateEvent", state);
  }.bind(this));
}


Fitbit.prototype.fetchSleepInfo = function(userId) {
  var user = this.users[userId];
  var url = "http://api.fitbit.com/1/user/-/sleep/minutesAsleep/date/today/1w.json";
  this.oauth.get(url, user.token, user.secret, function (err, data, response) {
     var state = {};
     try{
      state["fitbit." + userId + "." + "SleepInfo"] = JSON.parse(data);
     } catch (e) {
       console.log("Could not parse fitbit", url, err, data, response.statusCode);
     }
     if (this.debug) console.log(JSON.stringify(state, null, '  '));
     this.emit("StateEvent", state);
  }.bind(this));
}



Fitbit.prototype.handleUpdates = function(updates) {
  for (var i = 0; i < updates.length; i++) {
    var update = updates[i];
    var user = update.subscriptionId;
    var type = update.collectionType
    console.log("*  Fitbit updated", user, type);
    this.updateCollection(user, type);
  };
}


      



exports.Fitbit = Fitbit;
