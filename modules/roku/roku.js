var EventEmitter = require('events').EventEmitter;
var http = require('http');
var util = require('util');
var xml2js = require('xml2js');

Roku.PORT = 8060;
function Roku(data) {
  this.host = data.host;
  this.getChannels();
  this.eventQueue = [];
  this.name = data.name || "Roku";
}
util.inherits(Roku, EventEmitter);

Roku.prototype.exec = function(command, params) {
  if (command == "LaunchChannel") {
    console.log("*  Roku Executing: " + command + " : " + params.channel);
    this.launchChannel(params.channel);
  } else if (command == "SearchRoku") {
    console.log("*  Roku Search: " + command + " : " + params.forValue);
    this.searchRoku(params.forValue);
  } else if (command == "Navigate") {
    console.log("*  Roku Navigate: " + command + " : " + params.forValue);
    this.navigateRoku(params.instructions);
  } else if (command == "SendEvent") {
    this.sendEvent(params.rokuEvent);
  } else {
    this.sendEvent(command);
  }
};

Roku.prototype.log = function(data) {
  console.log("Roku LOG:" + data);
  this.emit("DeviceEvent", "Logged");
};

Roku.prototype.navigateRoku = function (directions) {
  var steps = directions.split(" ");
  var lastAction;
    console.log(steps);
  for (var i = 0; i < steps.length; i++) {
    var step = steps[i];
    var numberIndex = numbers.indexOf(step);
    if (step < 10) {
      for (var j = 0; j < parseInt(step); j++) {
        this.sendEvent(lastAction);
      };
    } else {
      this.sendEvent(step);
      lastAction = step;
    }
  };
}

Roku.prototype.searchRoku = function (query) {
// New logic for 5.0
  this.sendEvent("HOME");
  this.sendEvent("HOME");
  setTimeout(function(){
    // Navigate to search
    this.sendEvent("Down");
    this.sendEvent("Down");
    this.sendEvent("Right");
    // Send query
    this.sendText(query);
    setTimeout(function(){
      this.sendEvent("Fwd");
    }.bind(this), 3000);
    setTimeout(function(){
      this.sendEvent("Right");
      this.sendEvent("Right");
      this.sendEvent("Right");
    }.bind(this), 3500);
  }.bind(this), 10000);
};

Roku.prototype.launchChannel = function (channelID) {
  var request = http.request({
    port : Roku.PORT,
    host : this.host,
    path : "/launch/" + channelID,
    method: 'POST'
  }, function(res){
      console.log(res.statusCode);
      res.on('data', function (chunk) {
      }.bind(this));
      res.on('end', function () {
      }.bind(this));
    }.bind(this));
  request.on('error', function(e) {console.log("Error:" + e.message);});
  request.end();
};

Roku.prototype.sendText = function(text) {
  var characters = text.split('');
  for (var i = 0; i < characters.length; i++) {
    this.sendEvent(characters[i]);
  }
};

Roku.prototype.sendEvent = function(key) {
  try {
    if (key.length == 1) key = "Lit_" + escape(key);
    var isFirstRequest = this.eventQueue.length === 0;
    this.eventQueue.push(key);
    if (isFirstRequest) {
      setTimeout(this.sendNextEvent.bind(this),333);
    }
  } catch (e) {}
};

Roku.prototype.sendNextEvent = function() {
  if (!this.eventQueue.length) return;
  var key = this.eventQueue.shift();

  var request = http.request({
    port : Roku.PORT,
    host : this.host,
    path : "/keypress/" + key,
    method: 'POST'
    }, function(res){
      res.on('data', function (chunk) {
      }.bind(this));
      res.on('end', function () {
        this.sendNextEvent();
      }.bind(this));
  }.bind(this));
  console.log("URL: " + request.path);
  request.on('error', function(e) {console.log("Error:" + e.message);});
  request.end();
};

Roku.prototype.getChannels = function() {
  var request = http.request({
    port : Roku.PORT,
    host : this.host,
    path : "/query/apps",
    }, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
      var parser = new xml2js.Parser();
      parser.parseString(chunk, function (err, result) {
        var channels = [];
        result = result.apps.app;
        for (var i = 0; i < result.length; i++) {
          var channel = result[i].$;
          channel.name = result[i]._;
          channels.push(channel);
        }
        var state = {};
        state["roku." + this.name + ".channels"] = channels;
        state["roku." + this.name + ".ip"] = this.host;
        this.emit("StateEvent", state);
      }.bind(this));
    }.bind(this));
  }.bind(this));
  request.on('error', function(e) {console.error("!  " + this.name + "\t" + e);}.bind(this));
  request.end();
};

var dgram = require('dgram'); // dgram is UDP

// Listen for responses
function listen(port) {
  var server = dgram.createSocket("udp4");
  server.on("message", function (msg, rinfo) {
    console.log("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
  });

  server.bind(port); // Bind to the random port we were given when sending the message, not 1900

  // Give it a while for responses to come in
  setTimeout(function(){
    server.close();
  },2000);
}

exports.Roku = Roku;
