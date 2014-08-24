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
  this.useGroupEvents = data.useGroupEvents;
  this.writeQueue = [];
  // Dupe preventer. Stores IDs.
  this.history = {};

  // Custom commands (name : insteon command)
  this.commands = data.commands || {};

  // Map of device names to ids.
  this.devices = data.devices || {};

  // Create reverse devices map.
  this.device_ids = {};
  for (var name in this.devices) {
    var id = this.devices[name];
    this.device_ids[id] = name;
  }
}
util.inherits(Insteon, EventEmitter);

Insteon.SMARTLINC_PLM_PORT = 9761;

Insteon.COMMAND_NAMES = {
  "00" : "RESP",
  // "04" : "ACK04?",
  // "06" : "ACK06?",
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
  "2F" : "OffWithRate",
};
Insteon.COMMAND_IDS = invertObject(Insteon.COMMAND_NAMES);

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

Insteon.X10_PREFIX = "X10:";

Insteon.X10_HOUSE_CODES = {
  "A": "6",
  "B": "E",
  "C": "2",
  "D": "A",
  "E": "1",
  "F": "9",
  "G": "5",
  "H": "D",
  "I": "7",
  "J": "F",
  "K": "3",
  "L": "B",
  "M": "0",
  "N": "8",
  "O": "4",
  "P": "C",
};

Insteon.X10_UNIT_CODES = {
  "1" : "600",
  "2" : "E00",
  "3" : "200",
  "4" : "A00",
  "5" : "100",
  "6" : "900",
  "7" : "500",
  "8" : "D00",
  "9" : "700",
  "10": "F00",
  "11": "300",
  "12": "B00",
  "13": "000",
  "14": "800",
  "15": "400",
  "16": "C00",
};

Insteon.X10_CMD_CODES = {
  "On":     "280",
  "Off":    "380",
  "Bright": "580",
  "Dim":    "480",
  "AllOn":  "180",
  "AllOff": "680",
}

Insteon.prototype.sendCommand = function(device_name, command_name, level) {
  console.log("*  Insteon:", device_name, command_name, level);
  var device_id = this.devices[device_name] || device_name;

  var isX10 = device_id.indexOf(Insteon.X10_PREFIX) == 0;

  if (isX10) {
    device_id = device_id.substring(Insteon.X10_PREFIX.length);
    var houseCode = device_id.substring(0,1);
    var unitCode = device_id.substring(1);
    this.sendString("0263" + Insteon.X10_HOUSE_CODES[houseCode] +  Insteon.X10_UNIT_CODES[unitCode]);
    this.sendString("0263" + Insteon.X10_HOUSE_CODES[houseCode] +  Insteon.X10_CMD_CODES[command_name]);
  } else {
    var command_id = Insteon.COMMAND_IDS[command_name];
    if (!command_id || !device_id) return;
    if (undefined === level) level = "FF";
    var isGroupCommand = device_id.length == 2;
    var prefix = isGroupCommand ? "0261" : "0262";
    var string = prefix + device_id + (isGroupCommand ? "" : "0F") + command_id + level;
    this.sendString(string);

  }
};


Insteon.prototype.exec = function(command) {
  console.log("*  Insteon executing: " + command);

  var string = this.commands[command];
  if (string) {
    this.sendString(string);
  } else if (command == "SetLightState") {
  } else if (command == "AllOff") {
    this.sendCommand("FF", "Off");
    console.log("*  Insteon: AllOff");
  } else { // Build a command manually
    var segments = command.split(".");
    var device_name = segments.shift();
    var command_name = segments.shift();
    var data = segments.shift(); // use this e.g. for level
    this.sendCommand(device_name, command_name, data);
  }
};


Insteon.prototype.sendString = function(string) {
  var isFirstRequest = this.writeQueue.length === 0;
  this.writeQueue.push(string);
  if (isFirstRequest) setTimeout(this.sendNextString.bind(this),10);
};

Insteon.prototype.sendNextString = function() {
  try {
    if (!this.writeQueue.length) return;
    var string = this.writeQueue.shift();
    if (this.debug) console.log("d  < Insteon Sending: " + string);
    string = new Buffer(string, "hex");
    this.client.write(string, "UTF8", function () {
      setTimeout(this.sendNextString.bind(this),1000);  
    }.bind(this));    
  } catch (e) {
    console.log("Insteon " + e);
  }
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
  setTimeout(this.connect.bind(this), 10000);
};

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
};

function invertObject (obj) {
  var new_obj = {};
  for (var prop in obj) {
    if(obj.hasOwnProperty(prop)) {
      new_obj[obj[prop]] = prop;
    }
  }
  return new_obj;
}

Insteon.prototype.nameForDevice = function (device) {
  if (device == "000001") return "GROUP-1";
  if (device == "000002") return "GROUP-2";
  if (device == "000003") return "GROUP-3";
  if (device == "000004") return "GROUP-4";
  if (device == this.hostid) return "CONTROL";
  return this.device_ids[device] || device; 
};

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
  info.isAck = (info.flags & (1 << 1)) !== 0;
  info.isGroup = (info.flags & (1 << 2)) !== 0;
  info.isBroadcast = (info.flags & (1 << 3)) !== 0;
  info.isNak = info.isAck && info.isBroadcast;

  info.device_name = this.nameForDevice(info.device);
  info.target_name = this.nameForDevice(info.target);
  
  info.level = parseInt(field_2, 10);
  if (info.isAck) {
    info.db_delta = parseInt(field_1,10);
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
};

Insteon.prototype.printCommand = function(info) {
  if (!info) return;
  if (info.isNak) console.log("\tFAILED");
  console.log("d  > " + info.device_name + " -> " +
    info.target_name + " \t"
               + (info.command_name || "?")
               + (info.level ? "(" + info.level + ")" : "")
               + " \t(" + info.flags + ", "
               + info.num_hops + "/" + info.max_hops + " hops) \t[" + info.cmd + "]" + info.isAck);
};


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
      } else if (info && this.useGroupEvents && info.isGroup) {
        this.emitDeviceStatus(info);
      }
      break;
    default:
      break;
    }
    if (this.debug)
      this.printCommand(info);
  } catch (e) {
    console.log("Insteon data error:", data, e);
  }
};

Insteon.prototype.emitDeviceStatus = function(info) {
  var date = new Date();
  var out = [info.device_name];


  // Multi switches pass their index via level
  if (info.device_name.indexOf("Multi") != -1) {
    if (info.isBroadcast) {
      out.push(parseInt(info.target, 10));
    } else {
      out.push(info.level); 
    }
  } else if (info.command_name.indexOf("Hold") == 0) {
      out.push(info.level); 
  } 


  // Dedupe against commands in history (e.g. a C7 event just arrived for same command)
  if ( this.useGroupEvents &&
      (info.device in this.history) &&
      this.history[info.device].command == info.command &&
      date - this.history[info.device].time < 3000) {
    return;
  }

  // Add event to history in order to dedupe group events
  if (this.useGroupEvents) {
    this.history[info.device] = {
      command : info.command,
      time : date
    };
  }

  out.push(info.command_name);

  var state = {};
  state["insteon." + info.device_name] = info.command_name;
  this.emit("DeviceEvent", out.join("."));
  this.emit("StateEvent", state);
};

Insteon.prototype.handleError = function(e) {
  this.emit("ErrorEvent", "Insteon", e);
  console.error("!  Insteon\t" + e);
  this.reconnect();
};

Insteon.prototype.handleEnd = function() {
  this.emit("DeviceEvent", "Disconnected");
  this.reconnect();
};

exports.Insteon = Insteon;
