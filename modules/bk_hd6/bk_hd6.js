
// (00, X, 2, 1=1;cs16) Turn Z1 power on (unit not in Sleep)
// (00, X, 2, 2=0;cs16) Turn Z2 power off (unit in Sleep)

var eventText = "EVENT C[" + controller + "].Z[" + zone + "]!" + event + " " + params.data1 + " " + (params.data2 || "")

function bkCommand() {
  return var eventText = `(${arguments.join(",")};)`
}


var EventEmitter = require('events').EventEmitter;
var util = require('util');
var net = require('net');
// var wol = require('wake_on_lan');

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

function BKCT(data) {
  this.host = data.host;
  this.zoneNames = data.zoneNames;
  this.connect();
  this.callbackStack = [];
  this.status = {};
  this.debug = data.debug;
  this.fadeTimeouts = {};
  this.commandQueue = [];

};
util.inherits(BKCT, EventEmitter);

BKCT.prototype.exec = function(command, params) {
  var event = command;
  var controller = params.controller || "1"
  var zone = params.zone || this.zoneNames[params.zoneName] || 1;

  var eventText = "EVENT C[" + controller + "].Z[" + zone + "]!" + event + " " + params.data1 + " " + (params.data2 || "")
  console.log("*  BKCT Executing: " + eventText);
  this.sendEvent(null, zone, event, params.data1, params.data2);
};

BKCT.prototype.getVolume = function(controller, zone) {
  return parseInt(this.status["C["+ (controller || 1) +"].Z["+zone+"].volume"]);
}

BKCT.prototype.setVolume = function(controller, zone, value) {
  if (value == NaN) return;
  this.sendEvent(controller, zone, "KeyPress", "Volume", value);
}

BKCT.prototype.fadeVolume = function(controller, zone, value, duration, startValue, startTime) {
  if (!value) return;

  var now = new Date();
  if (!startTime) {
    startTime = now;
    startValue = this.getVolume(controller,zone);
    if (this.fadeTimeouts[zone]) clearTimeout(this.fadeTimeouts[zone])
    //console.log("Animating audio from", startValue, value);
  }

  if (!duration) return this.setVolume(controller, zone, value);
  
  var percent = (now - startTime) / duration;
  if (percent > 1.0) percent = 1.0;
  var newValue = startValue + Math.round((value - startValue) * percent);
  this.setVolume(controller, zone, newValue);

  if (percent < 1.0) this.fadeTimeouts[zone] = setTimeout(this.fadeVolume.bind(this), 100, controller, zone, value, duration, startValue, startTime);
}

BKCT.prototype.wake = function(event) {
  // wol.wake(this.mac_addr, function(error) {
    if (error) {
      // handle error
    } else {
      // done sending packets
    }
  });
}


BKCT.prototype.send = function(command, callback) {
  var isFirstRequest = (this.commandQueue.length == 0);
  this.commandQueue.push(command);
  this.callbackStack.push(callback);

  if (isFirstRequest)
    process.nextTick(this.sendNextCommand.bind(this));
};

BKCT.prototype.sendNextCommand = function() {
  if (!this.commandQueue.length) return;
  var string = this.commandQueue.shift();
  if (this.debug && string.length) console.log("BKCT >", string);
  this.client.write(string + "\r", "UTF8", function () {
    setTimeout(this.sendNextCommand.bind(this), 300);  
  }.bind(this));
};

// BKCT.prototype.reconnect = function() {
//   if (this.reconnecting_) return;
//   this.reconnecting_ = true;
//   setTimeout(this.connect.bind(this), 1000);
// }

BKCT.prototype.get = function (keys) {
//GET C[1].Z[4].bass, C[1].Z[4].treble

}


BKCT.prototype.selectSource = function(controller, zone, source) {
  this.sendEvent(controller, zone, "SelectSource", source);
}

BKCT.prototype.allOff = function(controller) {
  this.sendEvent(controller, 1, "AllOff");
}

BKCT.prototype.setDND = function(controller, zone, state) {
  this.sendEvent(controller, zone, "DoNotDisturb", state ? "ON" : "OFF");
}

BKCT.prototype.setPageTarget = function(zone) {
  for (var i = 1; i < 9; i++) {
    this.setDND(i, i != zone);
  }
}

BKCT.prototype.sendEvent = function(controller, zone, event, data1, data2) {
  var command = "EVENT C[" + (controller || 1) + "].Z[" + zone + "]!" + event;
  if (data1 != undefined) command += " " + data1;
  if (data2 != undefined) command += " " + data2;
  this.send(command);
}

BKCT.prototype.parseResponse = function(data) {
  data = data.replace(/([\w\[\]\.]+)=/g,'"$1"=');
  data = data.replace(/=/g,':');
  data = JSON.parse("{" + data + "}");
  return data;
}
var notificationKeys = ["System.status"];
BKCT.prototype.handleNotification = function(data) {
  var now = new Date();

  if (this.initializing && this.lastEvent && (now - this.lastEvent > 1000)) {
    this.initializing = false;
    if (this.debug) console.log("BKCT init complete");
  }
  this.lastEvent = now;

  var changes = {};
  for (var key in data) {
    if (key == "System.status") {
      var on = data[key] == "ON";
      this.emit("DeviceEvent", on ? "On" : "Off", null,  {initializing: this.initializing});
    }
    if (this.emitEvents) this.emit("DeviceEvent", key, data[key], {initializing: this.initializing});
    changes["BKCT." + key] = data[key]; 
    this.status[key] = data[key];
  }
  this.emit("StateEvent", changes);

}

BKCT.prototype.handleData = function(data) {
  if (!data.endsWith("\r\n")) return;
  var lines = data.split("\r\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (this.debug && line.length) console.log("BKCT <", line);

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

BKCT.prototype.handleStatus = function (status) {
  if (this.debug) console.log("Status", status);
}

BKCT.prototype.updateSources = function() {
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
  this.send(command, this.handleStatus.bind(this));
}

BKCT.prototype.connect = function() {
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

BKCT.prototype.reconnect = function() {
  if (this.reconnecting_) return;

  this.reconnecting_ = true;
  setTimeout(this.connect.bind(this), 10000);
}

BKCT.prototype.watchForChanges = function() {
  this.send("WATCH System ON");
  for (var i = 1; i < 9; i++) {
   this.send("WATCH C[1].Z["+ i +"] ON");
  };
  for (var i = 1; i < 8; i++) {
   this.send("WATCH S["+ i +"] ON");
  };
}
BKCT.prototype.keepAlive = function() {
  this.send("");
}

BKCT.prototype.handleConnected = function() {
  this.emit("DeviceEvent", "Connected");
  this.emit("StateEvent", {BKCTConnected:true});
  this.watchForChanges();
  if (!this.keepAliveInterval) {
    this.keepAliveInterval = setInterval(this.keepAlive.bind(this), 60000);
  }
};

BKCT.prototype.handleEnd = function() {
  if (this.keepAliveInterval) {
    clearInterval(this.keepAliveInterval);
    delete this.keepAliveInterval;
  }
  this.emit("DeviceEvent", "BKCT.Disconnected");
  this.emit("StateEvent", {BKCTConnected:false});
};

BKCT.prototype.handleError = function(e) {
  console.log("!  BKCT\t" + e + "");
  this.reconnect();
};


module.exports = BKCT;