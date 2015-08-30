// Very simple remote powermate processor

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var url = require('url');
var io = require('socket.io');

function PowerMate(data) {
  this.port = data.port || 9003
  this.devices = data.devices;
  this.knobs = {};
  this.socket = require('socket.io')(this.port)
  this.socket.on('connection', this.handleSocketConnection.bind(this));
  this.socket.on('error', this.handleSocketError.bind(this));
  this.sendRawEvents = data.sendRawEvents;
};
util.inherits(PowerMate, EventEmitter);

PowerMate.prototype.getKnob = function(id) {
	var knob = this.knobs[id];
	if (!knob) {
    knob = new PowerMateKnob(id);
    knob.context = this.devices[id];
    knob.on("DeviceEvent", this.emit.bind(this, "DeviceEvent")); // reemit events
    this.knobs[id] = knob;
	}
	return knob;
} 

PowerMate.prototype.handleSocketConnection = function(socket) {
  socket.on('error', this.handleSocketError.bind(this));
  socket.on('disconnect', this.handleSocketClose.bind(this, socket));
  socket.on('hostname', function(hostname) {
    console.log("hostname", hostname);
    socket.hostname = hostname;
  }.bind(this));
  socket.on('knob-up', function() {
    this.getKnob(socket.hostname).knobUp();
    if (this.debug) console.log("knob-up");
  }.bind(this));
  socket.on('knob-down', function() {
    this.getKnob(socket.hostname).knobDown();
    if (this.debug) console.log("knob-down");
  }.bind(this));
  socket.on('knob-turn', function(delta) {
    this.getKnob(socket.hostname).knobTurned(delta);
    if (this.debug) console.log("knob-turn", delta);
  }.bind(this));
};

PowerMate.prototype.handleSocketError = function(socket) {
  console.log("!  PM Web socket error", socket);
};

PowerMate.prototype.handleSocketClose = function(socket) {};


// Knob functions
function PowerMateKnob(id) {
  this.id = id;
}
util.inherits(PowerMateKnob, EventEmitter);

PowerMateKnob.DOUBLE_PRESS_DELAY = 200;


PowerMateKnob.prototype.knobTurned = function(delta) {
 
  if (this.pressed) {
    this.totalDelta += parseInt(delta);
    this.totalDistance += Math.abs(delta);
   }

  if (this.totalDistance > 2) { // Ignore a small amount of turning
    this.turned = true;
    clearTimeout(this.holdTimeout);
  }

  if (!this.flicked && Math.abs(this.totalDelta) > 10) {
    this.emit("DeviceEvent", this.pressed ? "KnobPressFlicked" : "KnobFlicked" , {context: this.context, value: delta, totalDelta: this.totalDelta});
    this.flicked = true;
  }

  console.log(this.id, delta);
  this.emit("DeviceEvent", this.pressed ? "KnobPressTurned" : "KnobTurned" , {context: this.context, value: delta, totalDelta: this.totalDelta});
}

PowerMateKnob.prototype.knobDown = function() {
  if (this.sendRawEvents) this.emit("DeviceEvent", "KnobDown", {context: this.context});

  this.pressed = true;
  this.turned = false;
  this.held = false;
  this.flicked = false
  this.totalDelta = 0;
  this.totalDistance = 0;
  
  if (this.doubleTimeout) {
    clearTimeout(this.doubleTimeout);
    delete this.doubleTimeout;
    this.knobDoublePressed();
    this.held = true;
  } else { // could do double-tap-hold, but that is a bit much.
    this.holdTimeout = setTimeout(this.knobLongPressed.bind(this), 600);
  }
}

PowerMateKnob.prototype.knobUp = function() {
  if (this.sendRawEvents) this.emit("DeviceEvent", "KnobUp", {context: this.context});
  this.totalDelta = 0;
  this.totalDistance = 0;
  this.pressed = false;
  clearTimeout(this.holdTimeout);

  if (!this.turned && !this.held) {
    // send normal press after a delay
    this.doubleTimeout = setTimeout(this.knobPressed.bind(this), PowerMateKnob.DOUBLE_PRESS_DELAY);
  };
}

PowerMateKnob.prototype.knobPressed = function() {
  this.emit("DeviceEvent", "KnobPressed", {context: this.context});
  delete this.doubleTimeout;
}

PowerMateKnob.prototype.knobDoublePressed = function() {
  this.emit("DeviceEvent", "KnobDoublePressed", {context: this.context});
}

PowerMateKnob.prototype.knobLongPressed = function() {
  this.held = true;
  this.emit("DeviceEvent", "KnobLongPressed", {context: this.context});
}

module.exports = PowerMate;