
var EventEmitter = require('events').EventEmitter;
var net = require('net');
var util = require('util');
var http = require('http');
var url = require('url');

function GoPro(data) {
  this.host = data.host || "10.9.9.5";
  this.port = data.port || "8080";
  this.password = data.password;
  this.debug = data.debug;
}
util.inherits(GoPro, EventEmitter);

//
GoPro.prototype.exec = function(command, params) {
  if (command == "StartCapture") {
    this.sendCommand("/bacpac/SH", 1);
  } else if (command == "StopCapture") {
    this.sendCommand("/bacpac/SH", 2);
  }
};

GoPro.prototype.setMode = function(mode) {
  this.sendCommand("/bacpac/CM", mode);
}

//Reference:
//http://www.techanswerguy.com/2013/02/capturing-live-stream-from-gopro-hero-2.html

GoPro.prototype.sendCommand = function(path, value) {
  var query = {password: this.password, p:"%0" + value}
  var commandURL = url.format({protocol:"http", host:this.host, pathname:path, query:query})
  http.get(commandURL, function(res) {
    if (this.debug) console.log("Sent: ", commandURL);
  }).on('error', function(e) {
    if (this.debug) console.log("Error", commandURL);
  });
}
exports.GoPro = GoPro;
