var EventEmitter = require('events').EventEmitter;
var net = require('net');
var util = require('util');

function LutronRadioRA2(data) {
  this.host = data.host;
  this.port = data.port || 23;
  this.username = data.username || "lutron";
  this.password = data.password || "integration";

  // Map of device names to ids.
  this.devices = data.devices ? data.devices : {};
  
  // Create reverse devices map.
  this.deviceIds = {};
  for (var name in this.devices) {
    var id = this.devices[name];
    this.deviceIds[id] = name;
  }

  this.debug = false;
  this.commandQueue = [];
  this.connect();
};
util.inherits(LutronRadioRA2, EventEmitter);

LutronRadioRA2.prototype.send = function(string) {
  var isFirstRequest = (this.commandQueue.length == 0);
  this.commandQueue.push(string);
  if (isFirstRequest)
    process.nextTick(this.sendNextCommand.bind(this));
};

LutronRadioRA2.prototype.sendNextCommand = function() {
  if (!this.commandQueue.length) return;
  var string = this.commandQueue.shift();
  this.client.write(string + "\r\n", "UTF8", function () {
    setTimeout(this.sendNextCommand.bind(this), 300);  
  }.bind(this));
};

LutronRadioRA2.prototype.exec = function(command) {
  console.log("*  Lutron Executing: " + command);

  var segments = command.split(".");

  var deviceName = segments.shift();
  deviceId = (deviceName in this.devices) ? this.devices[deviceName] : deviceName;
  var componentId = segments.shift();
  var fields = segments;

  this.send("#OUTPUT," + [deviceId, componentId, fields.join(",")].join(","));
};

LutronRadioRA2.prototype.parseData = function(data) {
  if (this.debug) console.log("LutronRadioRA2", data);

  // Clean up and parse input string.
  if (data.indexOf("GNET>") != -1)
    data = data.substring(5);
  data = data.trim().split(",");
  if (data.length < 1) return;

  var command = data[0];
  data = data.slice(1);
  var deviceName = (data[0] in this.deviceIds) ? this.deviceIds[data[0]] : data[0];
  var componentId = data[1];
  var fields = data.slice(2);
  var eventString = [deviceName, componentId, fields.join(".")].join(".");

  switch (command) {
    case "~OUTPUT":
      var details = {};
      if (componentId == "1" && fields[0])
        details.brightness = fields[0];
      this.emit("DeviceEvent", eventString, details);
      break;
    case "~DEVICE":
      this.emit("DeviceEvent", eventString);
      break;
    case "#OUTPUT":
      break;
    case "#DEVICE":
      break;
    case "?OUTPUT":
      break;
  }
}

// Connection
LutronRadioRA2.prototype.connect = function() {
  this.reconnecting_ = false;
  this.client = net.connect({
    host : this.host,
    port : this.port
  });

  this.client.on('data', this.handleData.bind(this));
  this.client.on('error', this.handleError.bind(this));
  this.client.on('close', this.handleError.bind(this));
};

LutronRadioRA2.prototype.reconnect = function() {
  if (this.reconnecting_) return;

  this.reconnecting_ = true;
  setTimeout(this.connect.bind(this), 1000);
}

LutronRadioRA2.prototype.handleData = function(data) {
  data += "";
  switch (data.trim()) {
    case "login:":
      this.send(this.username);
      break;
    case "password:":
      this.send(this.password);
      break;
    default:
      this.parseData(data.split("\r\n").shift());
  }
}

LutronRadioRA2.prototype.handleError = function(e) {
  console.log("! LutronRadioRA2\t" + e);
  this.reconnect();
};

LutronRadioRA2.prototype.handleEnd = function() {
  this.emit("DeviceEvent", "LutronRadioRA2.Disconnected");
  this.reconnect();
};

LutronRadioRA2.prototype.log = function(data) {
  console.log("LutronRadioRA2 LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

exports.LutronRadioRA2 = LutronRadioRA2;
