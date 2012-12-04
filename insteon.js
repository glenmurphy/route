var EventEmitter = require('events').EventEmitter;
var net = require('net');
var util = require('util');

/**
 *
 */
function Insteon(data) {
  this.host = data.host;
  this.connect();

  // Dupe preventer. Stores IDs.
  this.history = {};

  // Get these from the SmartLinc scene > Click _here_ to customize controls.
  this.commands = data.commands;

  // Map of device names to ids.
  this.devices = data.devices;

  // Create reverse devices map.
  this.device_ids = {};
  for (var key in this.devices) {
    this.device_ids[this.devices[key]] = key;
  }
}
util.inherits(Insteon, EventEmitter);

Insteon.SMARTLINC_PLM_PORT = 9761;

Insteon.prototype.exec = function(command, data) {
  if (!(command in this.commands)) return;
  console.log("*  Insteon Executing: " + command);
  var path = this.commands[command];
  this.ping(path);
};

Insteon.prototype.ping = function(path) {
  path = new Buffer(path, "hex");
  this.client.write(path);
};

Insteon.prototype.connect = function() {
  this.reconnecting_ = false;
  this.client = net.connect({
    host : this.host,
    port : Insteon.SMARTLINC_PLM_PORT
  }, this.handleConnected.bind(this));
  this.client.on('data', this.handleData.bind(this));
  this.client.on('error', this.handleError.bind(this));
};

Insteon.prototype.reconnect = function() {
  if (this.reconnecting_) return;

  this.reconnecting_ = true;
  setTimeout(this.connect.bind(this), 1000);
}

Insteon.prototype.handleConnected = function() {
  this.emit("DeviceEvent", "Insteon.Connected");
};

Insteon.prototype.lookupCommandName = function(command) {
  switch (command) {
    case "11": return "On";
    case "13": return "Off";
    case "17": return "HoldStart";
    case "18": return "HoldStop";
    default : return command;
  }
}

Insteon.prototype.parse0250 = function(data) {
  var parsed = data.match(/(....)(......)(......)(..)(..)(..)/);
  if (parsed.length != 7) return data;
  var device = parsed[2];
  var target = parsed[3];

  // This is actually super annoying - C7-based commands arrive first
  // and quickly, but don't always arrive. The other commands often take
  // seconds, but eventually arrive. We want to key things off the C7, 
  // but use the others without duplicates.
  var flags = parsed[4];
  var command = parsed[5];
  var alt = parsed[6];

  var out = {
    name : (device in this.device_ids) ? this.device_ids[device] : device,
    command : this.lookupCommandName(command),
    control : (flags == "C7") ? parseInt(target) : parseInt(alt)
  }
  return out;
}

Insteon.prototype.handleData = function(data) {
  data = new Buffer(data).toString("hex").toUpperCase();

  // Try to decode the string.
  var cmd = data.substr(0, 4);
  switch (cmd) {
    case '0250':
      this.emitDeviceStatus(this.parse0250(data));
      break;
    default:
      this.emit("DeviceEvent", data);
      break;
  }
};

/**
 * Insteon sends two types of message in response to status events
 * one of them (C7) is very quick but unreliable, the others are 
 * slow but more reliable. As the controllers send both, we want 
 * to use the first if we can, but use the second if it isn't sent
 * and we need to do so without dupes.
 */
Insteon.prototype.emitDeviceStatus = function(data) {
  var date = new Date();
  var control_name = data.name + "." + data.control;

  if ((control_name in this.history) &&
      this.history[control_name].command == data.command &&
      date - this.history[control_name].time < 3000) {
    return;
  }

  this.history[control_name] = {
    command : data.command,
    time : date
  };

  var out = [
    data.name,
    data.command
  ];
  if (data.control > 1)
    out.push(data.control);
  this.emit("DeviceEvent", out.join("."));
}

Insteon.prototype.handleError = function(e) {
  this.emit("DeviceEvent", "Insteon.Error");
  console.log(e);
  this.reconnect();
};

Insteon.prototype.handleEnd = function() {
  this.emit("DeviceEvent", "Insteon.Disconnected");
  this.reconnect();
};

exports.Insteon = Insteon;