var EventEmitter = require('events').EventEmitter;
var net = require('net');
var util = require('util');

/*
var n = new (require("./denon.js")).Denon({
  host : "10.0.1.20",
  sources : {
    "MacMini" : "GAME",
    "Sonos" : "DVR"
  }
});
*/

function Denon(data) {
  this.host = data.host;
  this.port = data.port || 23;

  // Map of source names to ids.
  this.sources = data.sources ? data.sources : {};
  
  // Create reverse sources map.
  this.sourceIds = {};
  for (var name in this.sources) {
    var id = this.sources[name];
    this.sourceIds[id] = name;
  }

  this.debug = false;
  this.commandQueue = [];
  this.connect();
};
util.inherits(Denon, EventEmitter);

Denon.prototype.send = function(string) {
  var isFirstRequest = (this.commandQueue.length == 0);
  this.commandQueue.push(string);
  if (isFirstRequest)
    process.nextTick(this.sendNextCommand.bind(this));
};

Denon.prototype.sendNextCommand = function() {
  if (!this.commandQueue.length) return;
  var string = this.commandQueue.shift();
  this.client.write(string + "\r", "UTF8", function () {
    setTimeout(this.sendNextCommand.bind(this), 300);  
  }.bind(this));
};

Denon.prototype.exec = function(command) {
  console.log("*  Denon Executing: " + command);

  var segments = command.split(".");

  var action = segments.shift();
  var fields = segments;
  switch (action) {
    case "Switch":
      var sourceName = fields.shift();
      sourceId = (sourceName in this.sources) ? this.sources[sourceName] : sourceName;
      this.send("SI" + sourceId);
    default:
      break;
  }
};

Denon.prototype.parseData = function(data) {
  if (this.debug) console.log("Denon", data);
}

// Connection
Denon.prototype.connect = function() {
  this.reconnecting_ = false;
  this.client = net.connect({
    host : this.host,
    port : this.port
  });

  this.client.on('data', this.handleData.bind(this));
  this.client.on('error', this.handleError.bind(this));
  this.client.on('close', this.handleError.bind(this));
};

Denon.prototype.reconnect = function() {
  if (this.reconnecting_) return;

  this.reconnecting_ = true;
  setTimeout(this.connect.bind(this), 1000);
};

Denon.prototype.handleData = function(data) {
  data = (data + "").trim();
  console.log(data);
  
  this.parseData(data.split("\r\n").shift());
};

Denon.prototype.handleError = function(e) {
  console.log("! Denon\t" + e);
  this.reconnect();
};

Denon.prototype.handleEnd = function() {
  this.emit("sourceEvent", "Denon.Disconnected");
  this.reconnect();
};

Denon.prototype.log = function(data) {
  console.log("Denon LOG:" + data);
  this.emit("sourceEvent", "Logged");
}

exports.Denon = Denon;
