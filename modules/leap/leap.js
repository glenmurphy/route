var EventEmitter = require('events').EventEmitter;
var Leapjs = require('../../../node_modules/leapjs/lib/index');
// var Leapjs = require('leapjs').leapjs;
var util = require('util');

var controllerOptions = {enableGestures: true};

function Leap(data) {
  this.controller = new Leapjs.Controller(
    {host: data.host,
    port: data.port || '127.0.0.1',
    enableGestures: data.enableGestures || false,
    enableHeartbeat: data.enableHeartbeat || true,
    heartbeatInterval: data.heartbeatInterval || 100,
    requestProtocolVersion: data.requestProtocolVersion || 3
  });

  this.controller.on('frame', this.handleFrame.bind(this));

  this.controller.on('ready', function() {
    console.log("ready");
  });
  this.controller.on('connect', function() {
    console.log("connect");
  });
  this.controller.on('disconnect', function() {
    console.log("disconnect");
  });
  this.controller.on('focus', function() {
    console.log("focus");
  });
  this.controller.on('blur', function() {
    console.log("blur");
  });
  this.controller.on('deviceConnected', function() {
    console.log("deviceConnected");
  });
  this.controller.on('deviceDisconnected', function() {
    console.log("deviceDisconnected");
  });

  this.controller.connect();
  console.log("\nWaiting for device to connect...");
}
util.inherits(Leap, EventEmitter);

Leap.prototype.handleFrame = function(frame) {
  // console.log(frame);
  this.emit("DeviceEvent", frame);
};

exports.Leap = Leap;
