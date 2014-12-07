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
    var id = this.devices[name].id;
    this.deviceIds[id] = name;
  }

  this.debug = false;
  this.commandQueue = [];
  this.connect();
};
util.inherits(LutronRadioRA2, EventEmitter);

LutronRadioRA2.TYPE_LIGHT = 1;
LutronRadioRA2.TYPE_KEYPAD = 2;
LutronRadioRA2.TYPE_MOTION = 4;

LutronRadioRA2.StateText = function(state) {
  switch (state) {
    case "3":
      return "On"
    case "4":
      return "Off"
    default:
      return state
  }
}

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
  var deviceType = this.devices[deviceName].type;
  deviceId = (deviceName in this.devices) ? this.devices[deviceName].id : deviceName;

  if (deviceType == LutronRadioRA2.TYPE_LIGHT) {
    var action = segments.shift().toLowerCase();
    var level = (action == "on") ? 100 : (action == "off") ? 0 : level;
    if (!isNaN(level))
      this.send("#OUTPUT," + [deviceId, 1, level].join(","));
  }
  //var componentId = segments.shift();
  //var fields = segments;
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
  if (!deviceName) return;
  if (!this.devices[deviceName]) return;
  var device = this.devices[deviceName];
  var deviceType = device.type;
  var componentId = data[1];
  var fields = data.slice(2);
  var eventString = [deviceName, componentId, fields.join(".")].join(".");

  switch (command) {
    case "~OUTPUT":
      var details = {};
      if (deviceType == LutronRadioRA2.TYPE_LIGHT && componentId == "1" && fields[0])
        details.brightness = fields[0];
      this.emit("DeviceEvent", deviceName, details);
      break;
    case "~DEVICE":
      if (deviceType == LutronRadioRA2.TYPE_MOTION && fields[0]) {
        this.emit("DeviceEvent", deviceName + "." + LutronRadioRA2.StateText(fields[0]));  
      } else if (deviceType == LutronRadioRA2.TYPE_KEYPAD && device.buttons) {
        var buttonText = (componentId in device.buttons) ? device.buttons[componentId] : componentId;
        var state = LutronRadioRA2.StateText(fields[0]);
        this.emit("DeviceEvent", [deviceName, buttonText, state].join("."));
      } else {
        this.emit("DeviceEvent", eventString);
      }
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
};

LutronRadioRA2.prototype.handleConnected = function() {
  console.log("Lutron RadioRA2 Connected");

  // Get the status of all the devices we know about.
  for (var name in this.devices) {
    var id = this.devices[name].id;
    this.send("?OUTPUT," + id);
  }
};

LutronRadioRA2.prototype.handleData = function(data) {
  data += "";
  switch (data.trim()) {
    case "login:":
      this.send(this.username);
      break;
    case "password:":
      this.send(this.password);
      this.handleConnected();
      break;
    default:
      this.parseData(data.split("\r\n").shift());
  }
}

LutronRadioRA2.prototype.handleError = function(e) {
  console.log("!  LutronRadioRA2\t" + e);
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

module.exports = LutronRadioRA2;
