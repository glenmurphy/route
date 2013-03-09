var EventEmitter = require('events').EventEmitter;
var util = require('util');

function Room(id, data) {
  this.id = id;
  for (var key in data) {
    this[key] = data[key];
  }
};

util.inherits(Room, EventEmitter);

exports.Room = Room;