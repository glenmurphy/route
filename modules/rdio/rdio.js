var EventEmitter = require('events').EventEmitter;
var net = require('net');
var util = require('util');
var http = require('http');
var xml2js = require('xml2js');

/* SPOTIFY ------------------------------------------------------------------- */
function Rdio(data) {
  this.bridge = data.bridge;
}
util.inherits(Rdio, EventEmitter);


Rdio.prototype.exec = function(command, params) {
  console.log("*  Rdio Executing: " + command);
  console.log(params);
  if (command == "Reconnect") {
    this.reconnect();
  } else if (command == "Listen") {
    // this.listenTo(params.query);
  } else {
    this.bridge.sendEvent("Rdio." + command);
  }
};

Rdio.prototype.playSource = function(track) {
  this.bridge.sendEvent("Rdio.ListenTo:" + track);
}

module.exports = Rdio;
