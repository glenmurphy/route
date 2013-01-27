var EventEmitter = require('events').EventEmitter;
var util = require('util');

// Protocol documentation at:
// http://www.lutron.com/TechnicalDocumentLibrary/RS232ProtocolCommandSet.040196d.pdf

function Lutron(data) {
  this.host = data.host;
  this.login = data.login;
  this.commandQueue = [];
};
util.inherits(Lutron, EventEmitter);

Lutron.prototype.exec = function(command, data) {
  this.log(command);
};

Lutron.prototype.sendCommand = function(string) {
  var isFirstRequest = this.commandQueue.length == 0;
  this.commandQueue.push(string);
  if (isFirstRequest) setTimeout(this.sendNextString.bind(this),10);
};

Lutron.prototype.sendNextCommand = function() {
  if (!this.commandQueue.length) return;
  var string = this.commandQueue.shift();
  console.log("\tSending: " + string);
  string = new Buffer(string, "hex");
  this.client.write(string, "UTF8", function () {
    setTimeout(this.sendNextString.bind(this),1000);  
  }.bind(this));
}

Lutron.prototype.sendStatusRequests = function() {
 for (var unit in this.controlUnits) {
      this.sendCommand(":rzi " + this.controlUnits[unit]);
  }
  this.sendCommand(":G");
}

Lutron.prototype.selectScene = function(units, scene) {
  this.sendCommand(":A" + scene + units.join(""));
}

Lutron.prototype.zoneRaise = function(unit, zones) {
  this.sendCommand(":B" + unit + zones.join(""));
}

Lutron.prototype.zoneLower = function(unit, zones) {
  this.sendCommand(":D" + unit + zones.join(""));
}


Lutron.prototype.parseData = function(data) {
  var parsed = data.match(/~:([^ ]*)(.*)/);
  var command = parsed[1];
  var data = parsed[2];

  switch (command) {
    case ("zi"):
      console.log(data);
      break;
    case ("ss"):
      var scenes = {}
      for (var i = 0; i < 8; i++) {
        scenes[i] = parseInt(data.charAt(i), 16);
      };
      console.log("Scene status:" + scenes);
      break;
    case ("ERROR"):
      console.log(data);
      break;      
    default:
  }
  //~:zi [Control Unit] [Int1] [Int2] [Int3] [Int4] [Int5] [Int6] [Int7] [Int8]
  // (or M)
}





// Connection

Lutron.COM_PORT = 23;

Lutron.prototype.connect = function() {
  this.reconnecting_ = false;
  this.client = net.connect({
    host : this.host,
    port : Lutron.COM_PORT
  }, this.handleConnected.bind(this));
  this.client.on('data', this.handleData.bind(this));
  this.client.on('error', this.handleError.bind(this));
};

Lutron.prototype.reconnect = function() {
  if (this.reconnecting_) return;

  this.reconnecting_ = true;
  setTimeout(this.connect.bind(this), 1000);
}

Lutron.prototype.handleConnected = function() {
  this.emit("DeviceEvent", "Lutron.Connected");
};

Lutron.prototype.handleData = function(data) {
  data = new Buffer(data).toString("hex").toUpperCase();
  this.parseData(data);
}

Lutron.prototype.handleError = function(e) {
  this.emit("DeviceEvent", "Lutron.Error");
  console.log(e);
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