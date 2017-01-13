var EventEmitter = require('events').EventEmitter;
var util = require('util');
var url = require('url');
var http = require('http');
var https = require('https');
var restler = require('restler');

// TODO get ISY devices from ISY
// TODO get ISY programs from ISY
// TODO get ISY Hue network resources(consider not going through ISY for hue)

/**
 * Initializes ISY module with username and password for REST requests
 * Also adds host of ISY as well as debug data
 */
function Isy(data) {
  this.host = data.host;
  this.username = data.username;
  this.password = data.password;
  this.debug = data.debug;
	this.devices = data.devices || {};

  // Create reverse devices map.
  this.device_ids = {};
  for (var name in this.devices) {
    var id = this.devices[name];
    this.device_ids[id] = name;
  }
};
util.inherits(Isy, EventEmitter);

/**
 * Retrieves nodes from ISY which includes lights, switches etc.
 */
Isy.prototype.getNotes = function() {

}

/**
 * Uses the first part of command as the @device_name
 * Uses the second part of command as the @command_name
 * Uses the third part as level if it exists
 * Everything else will be transferred as params
 */
Isy.prototype.exec = function(command, params) {
  console.log("*  Isy Executing: [" + command + "] : " + JSON.stringify(params));

  var segments = command.split(".");
	var device_name = segments.shift();
	var command_name = segments.shift();
	var level = segments.shift();
	this.sendCommand(device_name, command_name, level, params);
};

/**
 * Map Automaton human readable commands to ISY command names
 */
Isy.prototype.sendCommand = function(device_name, command_name, level, params) {

  switch (command_name) {
  	case "On":
  		this.sendRestCommand(this.devices[device_name], "DON", level, params);
  		break;
  	case "Off":
  		this.sendRestCommand(this.devices[device_name], "DOF", level, params);
  		break;
  }

};
 
/**
 * Assemble actual REST comand to send to ISY. Supports basic light commands
 * and level comands for lights.
 */
Isy.prototype.sendRestCommand = function(deviceAddress, command, level, parameter) {
    var uriToUse = 'http://'+this.host+'/rest/nodes/'+deviceAddress+'/cmd/'+command;
    
    if(level != null) {
        uriToUse += '/' + level;
    }

    if (this.debug) console.log("D Isy sending command: "+uriToUse);

    var options = {
        username: this.username,
        password: this.password
    }    

    restler.get(uriToUse, options).on('complete', function(data, response) {
        if(response.statusCode == 200) {
            console.log("*  Isy Success: Command executed");
        } else {
            console.log("!  Isy Failure: REST error");
        }
    });
}


Isy.prototype.log = function(data) {
  console.log("Isy LOG:" + data);
  this.emit("DeviceEvent", "Logged");
};

module.exports = Isy;