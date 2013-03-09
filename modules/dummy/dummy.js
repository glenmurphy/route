var EventEmitter = require('events').EventEmitter;
var util = require('util');

function Dummy(data) {
  this.host = data.host;
};
util.inherits(Dummy, EventEmitter);

Dummy.prototype.exec = function(command, data) {
  this.log(command);
};

Dummy.prototype.log = function(data) {
  console.log("DUMMY LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

exports.Dummy = Dummy;