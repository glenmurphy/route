var EventEmitter = require('events').EventEmitter;
var util = require('util');
var net = require('net');
var wol = require('wake_on_lan');

function Russound(data) {
  this.host = data.host;
  this.zoneNames = data.zoneNames;
  this.connect();
  this.callbackStack = [];
  this.status = {};
  this.debug = data.debug;
};
util.inherits(Russound, EventEmitter);

Russound.prototype.exec = function(command, params) {
  var event = command;
  var controller = params.controller || "1"
  var zone = params.zone || this.zoneNames[params.zoneName];

  var eventText = "EVENT C[" + controller + "].Z[" + zone + "]!" + event + " " + params.data1 + " " + (params.data2 || "")
  console.log("*  Russound Executing: " + eventText);
  this.sendEvent(null, zone, event, params.data1, params.data2);
};

Russound.prototype.getVolume = function(controller, zone) {
  return this.status["C["+ (controller || 1) +"].Z["+zone+"].volume"];
}

Russound.prototype.setVolume = function(controller, zone, value) {
  this.sendEvent(controller, zone, "KeyPress", "Volume", value);
}

Russound.prototype.log = function(data) {
  console.log("Russound LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

Russound.prototype.wake = function(event) {
  wol.wake(this.mac_addr, function(error) {
    if (error) {
      // handle error
    } else {
      // done sending packets
    }
  });
}

Russound.prototype.sendCommand = function(command, callback) {
  if (this.debug) console.log("Russound >", command);
  this.client.write(command + "\r");
  this.callbackStack.push(callback);
}

// Russound.prototype.reconnect = function() {
//   if (this.reconnecting_) return;
//   this.reconnecting_ = true;
//   setTimeout(this.connect.bind(this), 1000);
// }


Russound.prototype.get = function (keys) {
//GET C[1].Z[4].bass, C[1].Z[4].treble

}


Russound.prototype.selectSource = function(zone, source) {
  this.sendEvent(null, zone, "SelectSource", source);
}

Russound.prototype.allOff = function() {
  this.sendEvent(null, 1, "AllOff");
}

Russound.prototype.setDND = function(zone, state) {
  this.sendEvent(null, zone, "DoNotDisturb", state ? "ON" : "OFF");
}

Russound.prototype.setPageTarget = function(zone) {
  for (var i = 1; i < 9; i++) {
    this.setDND(i, i != zone);
  }

}


Russound.prototype.sendEvent = function(controller, zone, event, data1, data2) {
  var command = "EVENT C[" + (controller || 1) + "].Z[" + zone + "]!" + event;
  if (data1) command += " " + data1;
  if (data2) command += " " + data2;
  this.sendCommand(command);
}



Russound.prototype.parseResponse = function(data) {
  data = data.replace(/([\w\[\]\.]+)=/g,'"$1"=');
  data = data.replace(/=/g,':');
  data = JSON.parse("{" + data + "}");
  return data;
}
var notificationKeys = ["System.status"];
Russound.prototype.handleNotification = function(data) {
  var changes = {};
  for (var key in data) {
    if (key == "System.status") {
      var on = data[key] == "ON";
      this.emit("DeviceEvent", on ? "On" : "Off");
    }

    changes["russound." + key] = data[key]; 
    this.status[key] = data[key];
    if (this.debug) console.log("Russound", key, data[key])
  }
  this.emit("StateEvent", changes);
}

Russound.prototype.handleData = function(data) {
  if (this.debug) console.log("Russound <", data);
  if (!data.endsWith("\r\n")) return;
  var lines = data.split("\r\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    var response = line.charAt(0);
    line = line.substring(2);

    if (response == "E") {
      this.handleError(line);
    } else if (response == "N") {
      this.handleNotification(this.parseResponse(line));
    } else if (response ==   "S") {
      //console.log(this.parseResponse(line));
    }
    var callback = this.callbackStack.shift();
    if (callback) {
      callback(line);

    }
  };

};

Russound.prototype.handleStatus = function (status) {
  //console.log("Status", status);
}

Russound.prototype.updateSources = function() {
  var keys = [];
  for (var i = 1; i < 9; i++) {
    keys.push("C[1].Z[" + i + "].currentSource");
  }
  for (var i = 1; i < 9; i++) {
    keys.push("C[1].Z[" + i + "].name");
  }
    for (var i = 1; i < 9; i++) {
    keys.push("S[" + i + "].name");
  }
  var command = "GET " + keys.join(", ");
  this.sendCommand(command, this.handleStatus.bind(this));
}

Russound.prototype.connect = function() {
  this.reconnecting_ = false;
  this.client = net.connect({
    host : this.host,
    port : this.port || 9621,
  }, this.handleConnected.bind(this));
  this.client.setEncoding("ascii");
  this.client.setTimeout(10);
  this.client.on('data', this.handleData.bind(this));
  this.client.on('end', this.handleEnd.bind(this));
  this.client.on('error', this.handleError.bind(this));
};

Russound.prototype.reconnect = function() {
  if (this.reconnecting_) return;

  this.reconnecting_ = true;
  setTimeout(this.connect.bind(this), 10000);
}

Russound.prototype.watchForChanges = function() {
  this.sendCommand("WATCH System ON");
  for (var i = 1; i < 9; i++) {
   this.sendCommand("WATCH C[1].Z["+ i +"] ON");
  };
  for (var i = 1; i < 8; i++) {
   this.sendCommand("WATCH S["+ i +"] ON");
  };
}
Russound.prototype.keepAlive = function() {
  this.sendCommand("");
}

Russound.prototype.handleConnected = function() {
  this.emit("DeviceEvent", "Connected");
  this.emit("StateEvent", {russoundConnected:true});
  this.watchForChanges();
  if (!this.keepAliveInterval) {
    this.keepAliveInterval = setInterval(this.keepAlive.bind(this), 10000);
  }
};

Russound.prototype.handleEnd = function() {
  this.emit("DeviceEvent", "Russound.Disconnected");
  this.emit("StateEvent", {russoundConnected:false});
};

Russound.prototype.handleError = function(e) {
  console.log("!  Russound\t" + e + "");
  this.reconnect();
};


exports.Russound = Russound;