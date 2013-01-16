var EventEmitter = require('events').EventEmitter;
var http = require('http');
var util = require('util');

function RedEye(data) {
  this.host = data.host;
  this.executing_ = false;
  this.commands = data.commands ? data.commands : {};
};
util.inherits(RedEye, EventEmitter);

RedEye.PORT = 82;

RedEye.prototype.exec = function(command) {
  if (!(command in this.commands)) return;
  console.log("*  RedEye Executing: " + command);
  var code = this.commands[command];
  var request = http.request({
    port : RedEye.PORT,
    host : this.host,
    path : "/cgi-bin/play_iph.sh?" + code + "%201"
  });
  request.on('error', function() {});
  request.end();
};

exports.RedEye = RedEye;