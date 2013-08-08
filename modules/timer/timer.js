var EventEmitter = require('events').EventEmitter;
var util = require('util');

function Timer(data) {
  this.host = data.host;
  this.state = data.state;
  this.timers = [];
  this.timeouts = [];
};
util.inherits(Timer, EventEmitter);

Timer.prototype.exec = function(command, params) {
  if (command == "SetAlarm") {
    this.setAlarm(params.alarmTime, params.event, params.context);
  } else {
    this.log(command);
  }
};

Timer.prototype.setAlarm = function(alarmTime, event, context) {
  var date = this.dateFromSpecifier(alarmTime);
  var record = {context:context, date:date, event:event, specifier:alarmTime};
  this.timers.push(record);
  this.schedule(record);
}

Timer.prototype.schedule = function(record) {
  var now = new Date();
  var delay = record.date.getTime() - now.getTime();
  console.log("Scheduling", record, delay);



  var timeout = setTimeout(this.timerDone.bind(this, record), delay);
}

Timer.prototype.timerDone = function(record) {
  var params = {};
  if (record.context) params.context = record.context;
  if (record.specifier) params.specifier = record.specifier;
  if (record.event) this.emit("DeviceEvent", record.event, params);
}

Timer.prototype.setDateTimeout = function(fn, d) {
    var t = d.getTime() - (new Date()).getTime();
    if (t > 0) return setTimeout(fn, t);
}

Timer.prototype.dateFromSpecifier = function(spec) {
  try {
    var sunDate = this.state.allValues().sunEvents[spec];
    if (sunDate) return sunDate;
  } catch (e) {}
  var offset = 0;
  var seconds = spec.split("second");
  if (seconds.length > 1) offset = seconds[0];

  var minutes = spec.split("minute");
  if (minutes.length > 1) offset = 60 * minutes[0];

  var hours = spec.split("hour");
  if (hours.length > 1) offset = 60 * 60 * hours[0];
  
  this.emit("DeviceEvent", "Say", {string: "Set timer "});

  var now = new Date();
  var milli = now.getTime();
  milli += offset * 1000;

  return new Date(milli);
}

Timer.prototype.log = function(data) {
  console.log("Timer LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

exports.Timer = Timer;