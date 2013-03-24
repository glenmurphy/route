var EventEmitter = require('events').EventEmitter;
var net = require('net');
var util = require('util');

/**
 *
 */
function Insteon(data) {
  this.host = data.host;
  this.hostid = data.hostid;
  this.connect();
  this.debug = data.debug;
  this.writeQueue = [];
  // Dupe preventer. Stores IDs.
  this.history = {};

  // Custom commands (name : insteon command)
  this.commands = data.commands ? data.commands : {};

  // Map of device names to ids.
  this.devices = data.devices ? data.devices : {};

  // Create reverse devices map.
  this.device_ids = {};
  for (var name in this.devices) {
    var id = this.devices[name];
    this.device_ids[id] = name;
  }
}
util.inherits(Insteon, EventEmitter);

Insteon.SMARTLINC_PLM_PORT = 9761;

Insteon.prototype.sendCommand = function(device_name, command_name, level) {
console.log(device_name, command_name, level);
  var device_id = this.devices[device_name] || device_id;
  var command_id = Insteon.COMMAND_IDS[command_name];
  if (!command_id || !device_id) return;
  if (undefined == level) level = "FF";
  var prefix = device_id.length == 2 ? "0261" : "0262";
  var string = prefix + device_id + "0F" + command_id + level;
  this.sendString(string);
}


Insteon.prototype.exec = function(command, params) {
  console.log("*  Insteon Executing: " + command);

  var string = this.commands[command];
  if (string) {
    this.sendString(string);
  } else if (command == "SetLightState") {
    
  } else { // Build a command manually
    var segments = command.split(".");
    var device_name = segments.shift();
    var command_name = segments.shift();
    var data = segments.shift();
    this.sendCommand(device_name, command_name, data);
  }
};


Insteon.prototype.sendString = function(string) {
  var isFirstRequest = this.writeQueue.length == 0;
  this.writeQueue.push(string);
  if (isFirstRequest) setTimeout(this.sendNextString.bind(this),10);
};

Insteon.prototype.sendNextString = function() {
  try {
    if (!this.writeQueue.length) return;
    var string = this.writeQueue.shift();
    if (this.debug) console.log("\tInsteon Sending: " + string);
    string = new Buffer(string, "hex");
    this.client.write(string, "UTF8", function () {
      setTimeout(this.sendNextString.bind(this),1000);  
    }.bind(this));    
  } catch (e) {
    console.log("Insteon " + e)
  }
}


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
  setTimeout(this.connect.bind(this), 10000);
}

Insteon.prototype.handleConnected = function() {
  this.emit("DeviceEvent", "Connected");
  //this.sendStatusRequests();
};

Insteon.prototype.sendStatusRequests = function() {
 for (var device in this.devices) {
    if (device.indexOf("Motion") == -1) { // Skip motion detectors
      this.sendCommand(device,"Status", "FF");
    }
  }
}

Insteon.MESSAGE_FLAGS = {
  "100" : "Broadcast Message",
  "000" : "Direct Message",
  "001" : "ACK of Direct Message",
  "101" : "NAK of Direct Message", 
  "110" : "Group Broadcast Message",
  "010" : "Group Cleanup Direct Message", 
  "011" : "ACK of Group Cleanup Direct Message",
  "111" : "NAK of Group Cleanup Direct Message",
};

function invertObject (obj) {
  var new_obj = {};
  for (var prop in obj) {
    if(obj.hasOwnProperty(prop)) {
      new_obj[obj[prop]] = prop;
    }
  }
  return new_obj;
};

Insteon.COMMAND_NAMES = {
  "00" : "RESP",
  "04" : "ACK04?",
  "06" : "ACK06?",
  "0F" : "Ping",
  "10" : "IDRequest",
  "11" : "On",
  "12" : "FastOn",
  "13" : "Off",
  "14" : "FastOff",
  "15" : "Dim1",
  "16" : "Brighten1",
  "17" : "HoldStart",
  "18" : "HoldStop",
  "19" : "Status",
  "2E" : "OnWithRate",
  "2F" : "OffWithRate"
};
Insteon.COMMAND_IDS = invertObject(Insteon.COMMAND_NAMES);


Insteon.prototype.nameForDevice = function (device) {
  if (device == "000001") return "GROUP1";
  if (device == "000001") return "GROUP2";
  if (device == this.hostid) return "CONTROL";
  return this.device_ids[device] || device; 
}

function bit_test(num,bit){
    return ((num>>bit) % 2 != 0)
}

// TODO: this returns undefined for 0250 21D57C 110101 0 6 00
Insteon.prototype.parseCommand = function(data) {
  var info = {cmd : data};
  var parsed = data.match(/(....)(......)(......)(.)(.)(..)(..)/);
  if (!parsed || parsed.length != 8) return undefined;
  info.device = parsed[2];
  info.target = parsed[3];
  info.flags = parseInt(parsed[4], 16);
  info.num_hops = parseInt(parsed[5],16);
  info.max_hops = info.num_hops % 4;
  info.num_hops = (info.num_hops - info.max_hops) / 4;

  var field_1 = parsed[6];
  var field_2 = parsed[7];
  info.isAck = (info.flags & (1 << 1)) != 0;
  info.isGroup = (info.flags & (1 << 2)) != 0;
  info.isBroadcast = (info.flags & (1 << 3)) != 0;
  info.isNak = info.isAck && info.isBroadcast;

  info.device_name = this.nameForDevice(info.device);
  info.target_name = this.nameForDevice(info.target);

  info.level = parseInt(field_2);
  if (info.isAck) {
    info.db_delta = parseInt(field_1);
  } else {
    info.command = field_1;
    info.command_name = (Insteon.COMMAND_NAMES[field_1] || field_1);
  }
  // if (isAck) { // Just a command acknowledgement, not an actual command
  //   var db_delta = command;
  //   //this.emit("StateEvent", {("insteon." + info.device_name + ".level") : info.level});
  // } else {
  //   if (this.debug)
  //     console.log(
  //  out = {
  //     target : this.nameForDevice(target),
  //     name : this.nameForDevice(device),
  //     command : command_name,
  //     control : (flags == "C7") ? parseInt(target) : parseInt(command2)
  //   }
  // }
  return info;
}
Insteon.prototype.printCommand = function(info) {
  if (!info) return;
  if (info.isNak) console.log("\tFAILED")
  console.log("\t" + info.device_name + " -> "
               + info.target_name + " \t"
               + (info.command_name || "?")
               + (info.level ? "(" + info.level + ")" : "")
               + " \t(" + info.flags + ", "
               + info.num_hops + "/" + info.max_hops + " hops) \t[" + info.cmd + "]");
}


Insteon.prototype.handleData = function(data) {
  data = new Buffer(data).toString("hex").toUpperCase();
  try {
    // Try to decode the string.
    var cmd = data.substr(0, 4);
    var info = this.parseCommand(data);
    switch (cmd) {
      case '0250':
        if (info.isAck) {
        } else if (info && info.target == this.hostid) {
          this.emitDeviceStatus(info);
        }
        break;
      default:
        break;
    }
    if (this.debug)
      this.printCommand(info);
  } catch (e) {
    console.log("Insteon data error:", data, e)
  }
};

/**
 * Insteon sends two types of message in response to status events
 * one of them (C7) is very quick but unreliable, the others are 
 * slow but more reliable. As the controllers send both, we want 
 * to use the first if we can, but use the second if it isn't sent
 * and we need to do so without dupes.
 */
Insteon.prototype.emitDeviceStatus = function(info) {
  // var date = new Date();
  // var control_name = data.name + "." + data.control;

  // if ((control_name in this.history) &&
  //     this.history[control_name].command == data.command &&
  //     date - this.history[control_name].time < 3000) {
  //   return;
  // }

  // this.history[control_name] = {
  //   command : data.command,
  //   time : date
  // };

  var out = [
    info.device_name,
    info.command_name
  ];
  // if (data.control > 1)
  //   out.push(data.control);
  var state = {};
  state["insteon." + info.device_name] = info.command_name;
  this.emit("DeviceEvent", out.join("."));
  this.emit("StateEvent", state);
}

Insteon.prototype.handleError = function(e) {
  this.emit("ErrorEvent", "Insteon", e);
  console.error("! Insteon\t" + e);
  this.reconnect();
};

Insteon.prototype.handleEnd = function() {
  this.emit("DeviceEvent", "Disconnected");
  this.reconnect();
};

exports.Insteon = Insteon;
