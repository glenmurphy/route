// Very simple remote powermate processor

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var url = require('url');
var http = require('http');

function PowerMate(data) {
  this.port = data.port || 9003
  this.devices = data.devices;
  this.knobs = {};
  this.server = http.createServer(this.httpReq.bind(this)).listen(this.port);
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

PowerMate.prototype.httpReq = function(req, res) { 
  res.writeHead(200);
  res.end();
  var info = url.parse(req.url, true);
  var query = info.query;
  this.getKnob(query.device).handleEvent(query.event, query.value);
}; 


// Knob functions


function PowerMateKnob(id) {
  this.id = id;
}
util.inherits(PowerMateKnob, EventEmitter);


PowerMateKnob.prototype.handleEvent = function(event, value) {
  switch(event) {
    case "KnobUp":
      this.knobUp(value);
      break;
    case "KnobDown":
      this.knobDown(value);
      break;
    case "KnobTurn":
      this.knobTurned(value);
      break;
  }
}

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


// PowerMate.prototype.exec = function(command, params) {};

module.exports = PowerMate;