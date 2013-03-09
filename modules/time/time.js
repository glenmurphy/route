var EventEmitter = require('events').EventEmitter;
var util = require('util');

function Time(data) {
  this.host = data.host;
  this.route = data.route;
  this.emitEvents();
};
util.inherits(Time, EventEmitter);

Time.PRESETS = {
  "1200" : "Noon",
  "0000" : "Midnight",
}

Time.prototype.emitEvents = function() {
    var time = new Date();
    //time.setSeconds(0).setMilliseconds(0);
    var hours = time.getHours();
    var minutes = time.getMinutes();
    if (hours < 10) hours = "0" + hours.toString();
    if (minutes < 10) minutes = "0" + minutes.toString();
    var string = util.format('%s%s', hours, minutes);

    // If we have access to route, verify execution to avoid noise
    if (this.route) var eventCount = this.route.allEventsMatchingName("Time." + string).length;
    if (!this.route || eventCount) {
      this.emit("DeviceEvent", string);
    }

    // Emit presets without checking, since they are non-noisy
    if (Time.PRESETS[string]) {
      this.emit("DeviceEvent", Time.PRESETS[string]);      
    }

    var nextTime = time;
    time.setSeconds(0);
    time.setMilliseconds(0); // zero out cruft
    var nextTime = new Date(time.getTime() + 1000 * 60); // next minute
    var delay = nextTime - new Date();
    setTimeout(this.emitEvents.bind(this), delay);           
}

Time.prototype.log = function(data) {
  console.log("Time LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

exports.Time = Time;