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
  this.clients.push(socket);
  socket.on('message', this.handleSocketMessage.bind(this));
  socket.on('error', this.handleSocketError.bind(this));
  socket.on('disconnect', this.handleSocketClose.bind(this, socket));
  socket.on('hostname', function(hostname) {
    console.log("hostname", hostname);
    socket.hostname = hostname;
  }.bind(this));
  socket.on('knob-up', function() {
    this.getKnob(socket.hostname).knobUp();
    console.log("knob-up");
  }.bind(this));
  socket.on('knob-down', function() {
    this.getKnob(socket.hostname).knobDown();
    console.log("knob-down");
  }.bind(this));
  socket.on('knob-turn', function(delta) {
    this.getKnob(socket.hostname).knobTurned(delta);
    console.log("knob-turn", delta);
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
  this.pressed = true;
  this.turned = false;
  this.held = false;
  this.flicked = false
  this.totalDelta = 0;
  this.totalDistance = 0;
  this.holdTimeout = setTimeout(this.knobLongPressed.bind(this), 600);

  this.emit("DeviceEvent", "KnobDown", {context: this.context});
}

PowerMateKnob.prototype.knobUp = function() {
  this.totalDelta = 0;
  this.totalDistance = 0;
  this.pressed = false;
  clearTimeout(this.holdTimeout);

  if (!this.turned && !this.held) this.knobPressed();
  this.emit("DeviceEvent", "KnobUp", {context: this.context});
}

PowerMateKnob.prototype.knobPressed = function() {
  this.emit("DeviceEvent", "KnobPressed", {context: this.context});
}

PowerMateKnob.prototype.knobLongPressed = function() {
  this.held = true;
  this.emit("DeviceEvent", "KnobLongPressed", {context: this.context});
}

module.exports = PowerMate;