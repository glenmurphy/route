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
  this.fadeTimeouts = {};
};
util.inherits(Russound, EventEmitter);

Russound.prototype.exec = function(command, params) {
  var event = command;
  var controller = params.controller || "1"
  var zone = params.zone || this.zoneNames[params.zoneName] || 1;

  var eventText = "EVENT C[" + controller + "].Z[" + zone + "]!" + event + " " + params.data1 + " " + (params.data2 || "")
  console.log("*  Russound Executing: " + eventText);
  this.sendEvent(null, zone, event, params.data1, params.data2);
};

Russound.prototype.getVolume = function(controller, zone) {
  return parseInt(this.status["C["+ (controller || 1) +"].Z["+zone+"].volume"]);
}

Russound.prototype.setVolume = function(controller, zone, value) {
  this.sendEvent(controller, zone, "KeyPress", "Volume", value);
}

Russound.prototype.fadeVolume = function(controller, zone, value, duration, startValue, startTime) {
  var now = new Date();
  if (!startTime) {
    startTime = now;
    startValue = this.getVolume(controller,zone);
    if (this.fadeTimeouts[zone]) clearTimeout(this.fadeTimeouts[zone])
  }

  if (!duration) return this.setVolume(controller, zone, value);
  
  var percent = (now - startTime) / duration;
  if (percent > 1.0) percent = 1.0;
  var newValue = startValue + Math.round((value - startValue) * percent);
  this.setVolume(controller, zone, newValue);

  if (percent < 1.0) this.fadeTimeouts[zone] = setTimeout(this.fadeVolume.bind(this), 100, controller, zone, value, duration, startValue, startTime);
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
  if (this.debug && command.length) console.log("Russound >", command);
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


Russound.prototype.selectSource = function(controller, zone, source) {
  this.sendEvent(controller, zone, "SelectSource", source);
}

Russound.prototype.allOff = function(controller) {
  this.sendEvent(controller, 1, "AllOff");
}

Russound.prototype.setDND = function(controller, zone, state) {
  this.sendEvent(controller, zone, "DoNotDisturb", state ? "ON" : "OFF");
}

Russound.prototype.setPageTarget = function(zone) {
  for (var i = 1; i < 9; i++) {
    this.setDND(i, i != zone);
  }
}

Russound.prototype.sendEvent = function(controller, zone, event, data1, data2) {
  var command = "EVENT C[" + (controller || 1) + "].Z[" + zone + "]!" + event;
  if (data1 != undefined) command += " " + data1;
  if (data2 != undefined) command += " " + data2;
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
  var now = new Date();

  if (this.initializing && this.lastEvent && (now - this.lastEvent > 1000)) {
    this.initializing = false;
    if (this.debug) console.log("Russound init complete");
  }
  this.lastEvent = now;

  var changes = {};
  for (var key in data) {
    if (key == "System.status") {
      var on = data[key] == "ON";
      this.emit("DeviceEvent", on ? "On" : "Off", null,  {initializing: this.initializing});
    }
    this.emit("DeviceEvent", key, data[key], {initializing: this.initializing});
    changes["russound." + key] = data[key]; 
    this.status[key] = data[key];
  }
  this.emit("StateEvent", changes);

}

Russound.prototype.handleData = function(data) {
  if (!data.endsWith("\r\n")) return;
  var lines = data.split("\r\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (this.debug && line.length) console.log("Russound <", line);

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
  this.initializing = true;
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
    this.keepAliveInterval = setInterval(this.keepAlive.bind(this), 60000);
  }
};

Russound.prototype.handleEnd = function() {
  if (this.keepAliveInterval) {
    clearInterval(this.keepAliveInterval);
    delete this.keepAliveInterval;
  }
  this.emit("DeviceEvent", "Russound.Disconnected");
  this.emit("StateEvent", {russoundConnected:false});
};

Russound.prototype.handleError = function(e) {
  console.log("!  Russound\t" + e + "");
  this.reconnect();
};


exports.Russound = Russound;