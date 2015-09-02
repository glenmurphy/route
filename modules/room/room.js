var EventEmitter = require('events').EventEmitter;
var http = require('http');
var util = require('util');

function Room(data, name) {
  this.id = name;
  this._private = function () {};
  this.commands = data.commands;
  this.activities = data.activities;
  for (var key in data.values) { this[key] = data.values[key];}

  this.name = data.label || this.label || name;
  // Rooms have a private dictionary for attributes that may be cyclical
  Object.defineProperty( this, '_private', {value: {}, writable:true, configurable:true, enumerable:false});
} 
util.inherits(Room, EventEmitter);

Room.prototype.exec = function(command, params) {
  var value = this.commands[command];
  if (value) this.route.execCommands(value, params, command);    
};

Room.prototype.set = function(key, value) {
  var state = {};
  state["rooms." + this.id + "." + key] = value;
  this[key] = value;
  this.emit("StateEvent", state);
}

module.exports = Room;