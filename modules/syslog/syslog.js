var EventEmitter = require('events').EventEmitter;
var util = require('util');
var net = require('net');
var syslogReceiver = require("./lib/syslog-recv");

function Syslog(data) {
  this.port = data.port || 5141;
  this.matches = data.matches;
  this.debug = data.debug;
  var syslogServer = syslogReceiver.getServer(this.port, null, function(evt) {
    for (var match in this.matches) {
      if (evt.original.indexOf(match) != -1) {
        this.emit("DeviceEvent", this.matches[match]);
      }
    }
    if (this.debug) console.log(evt.original);
  }.bind(this));
};

util.inherits(Syslog, EventEmitter);
exports.Syslog = Syslog;