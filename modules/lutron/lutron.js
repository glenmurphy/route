var EventEmitter = require('events').EventEmitter;
var net = require('net');
var util = require('util');

// Protocol documentation at:
// http://www.lutron.com/TechnicalDocumentLibrary/RS232ProtocolCommandSet.040196d.pdf
// This may only apply to GRX systems, not QSX or others

function Lutron(data) {
  this.host = data.host;
  this.login = data.login || "nwk";
  this.controlUnits = data.controlUnits;
  this.keypads = data.keypads;
  this.commandQueue = [];
  this.connect();
};
util.inherits(Lutron, EventEmitter);

Lutron.prototype.exec = function(command, data) {
  console.log("*  Lutron Executing: " + command);

  if (command == "SetScene") {
    var scene = data.scene;
    var unit = data.zone || data.controlUnit;
    unit = this.controlUnits[unit];
    this.selectScene([unit], scene)
  } else if (command == "AllOff") {
    this.allOff();
  } else {
  }

};

Lutron.prototype.sendCommand = function(string) {
  var isFirstRequest = this.commandQueue.length == 0;
  this.commandQueue.push(string + "\r\n");
  //if (isFirstRequest) this.sendNextCommand();
  if (isFirstRequest) process.nextTick(this.sendNextCommand.bind(this));
};

Lutron.prototype.sendNextCommand = function() {
  if (!this.commandQueue.length) return;
  var string = this.commandQueue.shift();
  this.client.write(string, "UTF8", function () {
    setTimeout(this.sendNextCommand.bind(this),1000);  
  }.bind(this));
}

Lutron.prototype.sendStatusRequests = function() {
  this.sendCommand("G");
  // for (var unit in this.controlUnits) {
  //      this.sendCommand("rzi " + this.controlUnits[unit]);
  //  }
}

Lutron.prototype.allOff = function () {
  this.sendCommand("A01234");
}

Lutron.prototype.selectScene = function(units, scene) {
  this.unlockScenes(); // Do this every time to avoid scene lock, which happens randomly
  this.sendCommand("A" + scene + units.join(""));
}

Lutron.prototype.zoneRaise = function(unit, zones) {
  this.sendCommand("B" + unit + zones.join(""));
}

Lutron.prototype.zoneLower = function(unit, zones) {
  this.sendCommand("D" + unit + zones.join(""));
}

Lutron.prototype.unlockScenes = function() {
  this.sendCommand("SL");
}


Lutron.prototype.parseData = function(data) {
  var parsed = data.match(/~?:?([^ ]*) ?(.*)/);
  var command = parsed[1];
  var data = parsed[2];

  if (this.debug) console.log("Lutron", command, data);
  switch (command) {

    case ("zi"):
      var levels = data.split(" ");
      levels.pop();
      levels.pop();
      var unit = levels.shift();
      for (var i = 0; i < levels.length; i++) {
        levels[i] = parseInt(levels[i],16);
        if (i && levels[i] == i) levels[i] = null;
      };
      var state = {};
      state[("insteon.levels" + unit)] = levels;
      this.emit("StateEvent", state);
      break;
    case ("ss"):
      var scenes = {}
      for (var i = 0; i < 8; i++) {
        var value = parseInt(data.charAt(i), 16);
        if (value != null) scenes[i] = value;
      };
      this.emit("StateEvent", {"insteon.scenes" : scenes});

      if (this.debug) console.log("Scene status:" + JSON.stringify(scenes));
      break;
    case ("ERROR"):
      console.log(data);
      break;      
    default:
      if (command.length >=2 && command.length <= 3) {
        var code = command.charAt(0);
        var key = code.toLowerCase();
        var pressed = (code != key);
        var button = command.substring(1);
        var name = this.keypads[key];
        this.emit("DeviceEvent", name + "." + button + "." + (pressed ? "Press" : "Release"));
      } else {
        console.log("! Lutron unknown command:", command);
      }
      break;
  }
}

// Connection

Lutron.COM_PORT = 23;

Lutron.prototype.connect = function() {
  this.reconnecting_ = false;
  this.client = net.connect({
    host : this.host,
    port : Lutron.COM_PORT
  }, this.handleConnected.bind(this));
  this.client.setEncoding();
  this.client.on('data', this.handleData.bind(this));
  this.client.on('error', this.handleError.bind(this));
};

Lutron.prototype.reconnect = function() {
  if (this.reconnecting_) return;

  this.reconnecting_ = true;
  setTimeout(this.connect.bind(this), 10000);
}

Lutron.prototype.handleConnected = function() {
};

Lutron.prototype.handleData = function(data) {
  if (data == "login: ") {
    this.client.write(this.login + "\r\n", "UTF8");
  } else if (data == "connection established\r\n") {
    this.emit("DeviceEvent", "Connected");
    this.sendStatusRequests();
  } else {
    this.parseData(data.split("\r\n").shift());
  }
}

Lutron.prototype.handleError = function(e) {
  console.log("! Lutron\t" + e);
  this.reconnect();
};

Lutron.prototype.handleEnd = function() {
  this.emit("DeviceEvent", "Lutron.Disconnected");
  this.reconnect();
};

Lutron.prototype.log = function(data) {
  console.log("Lutron LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

exports.Lutron = Lutron;