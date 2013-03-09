var EventEmitter = require('events').EventEmitter;
var util = require('util');

function Room(data) {
  for (var key in data) {
    this[key] = data[key];
  }
};

util.inherits(Room, EventEmitter);

exports.Room = Room;