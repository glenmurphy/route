var EventEmitter = require('events').EventEmitter;
var Leapjs = require('leapjs');
var util = require('util');

function Leap(data) {
  this.threshold = data.threshold || 10;

  var controllerOptions = {host: data.host,
    port: data.port || '127.0.0.1',
    enableGestures: data.enableGestures || false,
    enableHeartbeat: data.enableHeartbeat || true,
    heartbeatInterval: data.heartbeatInterval || 100,
    requestProtocolVersion: data.requestProtocolVersion || 3
  };
  this.controller = new Leapjs.Controller(controllerOptions);

  this.controller.on('frame', this.handleFrame.bind(this));

  if (controllerOptions.enableGestures) {
    this.controller.on('gesture', this.handleGesture.bind(this));
  }

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

Leap.frameCount = 0;

Leap.prototype.handleFrame = function(frame) {
  // console.log(frame);
  // this.emit("DeviceEvent", frame);
};

Leap.prototype.handleGesture = function(gesture, frame) {

  if (gesture.state == "start") {
    Leap.frameCount = 0;
  }
  else if (gesture.state == "update") {
    Leap.frameCount++;
  }
  else if (gesture.state == "stop" && Leap.frameCount >= this.threshold) {
    console.log(gesture.type);
    this.emit("DeviceEvent", gesture.type);
  }
};

exports.Leap = Leap;