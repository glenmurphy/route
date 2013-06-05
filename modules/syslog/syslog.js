var EventEmitter = require('events').EventEmitter;
var util = require('util');
var net = require('net');
var syslogReceiver = require("./lib/syslog-recv");

function Syslog(data) {
  this.port = data.port || 514;
  this.matches = data.matches;
  this.debug = data.debug;
  this.syslogServer = syslogReceiver.getServer(this.port, null, this.handleLog.bind(this));
}; 
util.inherits(Syslog, EventEmitter);

Syslog.prototype.handleLog = function(evt) {
  if (this.debug) console.log(evt.original);
  for (var regex in this.matches) {
    var match = evt.original.match(regex);
    if (match) {
      match.shift();
      if (this.matches[regex]) this.emit("DeviceEvent", this.matches[regex], {match: match});
      return;
    }
  }
  
}

exports.Syslog = Syslog;