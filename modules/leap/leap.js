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

  switch (gesture.state) {
    case "start":
      Leap.frameCount = 0;
      break;
    case "update":
      Leap.frameCount++;
      break;
    case "stop":
      if (Leap.frameCount >= this.threshold) {
        switch (gesture.type) {
          case "swipe":
            if (Math.sqrt(Math.pow(gesture.direction[0], 2)) > Math.sqrt(Math.pow(gesture.direction[1], 2))) {
              //Horizontal gesture
              if(gesture.direction[0] < 0) {
                // Left gesture
                this.emit("DeviceEvent", "Swipe.Left");
              }
              else {
                // Right gesture
                this.emit("DeviceEvent", "Swipe.Right");
              }
            }
            else {
              //Vertical gesture
              if(gesture.direction[1] < 0) {
                // Downward gesture
                this.emit("DeviceEvent", "Swipe.Down");
              }
              else {
                // Upward gesture
                this.emit("DeviceEvent", "Swipe.Up");
              }
            }
            break;
          case "circle":
            if(gesture.clockwiseness === "clockwise") {
              this.emit("DeviceEvent", "Circle.Clockwiseness");
            }
            else {
              this.emit("DeviceEvent", "Circle.CounterClockwiseness"); 
            }
            break;
          case "screenTap":
            this.emit("DeviceEvent", "ScreenTap");
            break;
          case "keyTap":
            this.emit("DeviceEvent", "KeyTap");
            break;
        }
      }
      break;
  }
};

exports.Leap = Leap;