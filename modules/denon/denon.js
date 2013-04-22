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
  setTimeout(this.getStatus.bind(this), 2000);
};
util.inherits(Denon, EventEmitter);

Denon.prototype.getStatus = function() {
  this.send("SI?");
  this.send("SV?");
  this.send("MV?");
};

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
      this.emit("DeviceEvent", "Switch." + sourceName);
    case "Volume":
      var vol = parseInt(fields.shift());
      if (!isNaN(vol)) {
        this.send("MV" + vol);
        this.emit("DeviceEvent", "Volume", {volume : vol});
      }
    default:
      break;
  }
};

Denon.prototype.parseData = function(data) {
  if (this.debug) console.log("Denon", data);
  switch (data.substring(0, 2)) {
    case "SI":
      var src = data.substring(2);
      if (src in this.sourceIds)
        this.emit("DeviceEvent", "Switch." + this.sourceIds[src]);
      break;
    case "MV":
      var vol = parseInt(data.substring(2,4));
      if (!isNaN(vol)) {
        this.emit("DeviceEvent", "Volume", {volume : vol});
      }
      break;
  }
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
  data = data.split(/\r|\n/);
  for (var i = 0; i < data.length; i++) {
    this.parseData(data[i]);
  }
};

Denon.prototype.handleError = function(e) {
  console.log("! Denon\t" + e);
  this.reconnect();
};

Denon.prototype.handleEnd = function() {
  this.emit("DeviceEvent", "Disconnected");
  this.reconnect();
};

Denon.prototype.log = function(data) {
  console.log("Denon LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

exports.Denon = Denon;
