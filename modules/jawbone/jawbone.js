var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var url = require('url');
var util = require('util');
// var oauth = require('oauth');
var xml2js = require('xml2js');
var storage = require('../storage').Storage;

Jawbone.PORT = 9041;
function Jawbone(data) {
  this.listenPort = data.listenPort || Jawbone.PORT;
  this.server = http.createServer(this.handleReq.bind(this)).listen(this.listenPort);
  this.users = data.users;
  this.debug = data.debug;
}
util.inherits(Jawbone, EventEmitter);

Jawbone.prototype.handleReq = function(req, res) {
  var info = url.parse(req.url, true);
  if (req.method == 'POST') {
    var data = new Buffer('');
    req.on('data', function(chunk) { data = Buffer.concat([data, chunk]);});
    req.on('end', function() {
      var string = data.toString('utf-8');
      console.log(string);
      var updates = JSON.parse(string).events;
      res.writeHead(200, {});
      res.end();
      this.handleUpdates(updates);
    }.bind(this));
  } else {
    res.writeHead(200, {});
    res.end();
  }
};

Jawbone.prototype.handleUpdates = function(updates) {
  for (var i = 0; i < updates.length; i++) {
    var update = updates[i];
    var user = this.userForId(update.user_xid);
    var action = update.action;
    console.log("*  Jawbone updated", user, action, update);

    switch(action) {
      case "creation":
      case "updation":
        this.getEvent(update);
        break;
      case "deletion":
        break;
      default:
      console.log("Got action:", action);
        break;
    }
  };
}

Jawbone.prototype.userForId = function(id) {
  for (var userid in this.users) {
    var info = this.users[userid];
    if (info.xid = id) return userid;
  }
}

Jawbone.prototype.tokenForUser = function(userid) {
  return this.users[userid].token;
}

Jawbone.prototype.getEvent = function(update) {
  var user = this.userForId(update.user_xid);
  var urlBase = "https://jawbone.com/nudge/api/v.1.0/" + update.type + "/" + update.event_xid;
  var options = url.parse(urlBase);
  options.headers = { 'Authorization': "Bearer " + this.tokenForUser(user) }
  console.log(options, user);

  https.get(options, function(res) {
    console.log("Open Sesame", res.statusCode);
    if (res.statusCode == 200) {
      res.data = "";
      res.on('data', function (d) {res.data += d;});
      res.on("end", function() {
          console.log(res.data);
      });
    }

  }).on('error', function(e) {
    console.log("Unable to open sesame");
  });
}

exports.Jawbone = Jawbone;
