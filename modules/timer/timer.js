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
  var record = {context:context, date:date, event:event};
  this.timers.push(record);
  this.schedule(record);
}

Timer.prototype.schedule = function(record) {
  var timeout = setTimeout(this.timerDone.bind(this, record));
}

Timer.prototype.timerDone = function(record) {
  var params = {};
  if (params.context) params.context = record.context;
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
  var offset;
  var seconds = spec.split("seconds");
  if (seconds.length > 1) offset = seconds[0];

  var minutes = spec.split("minutes");
  if (minutes.length > 1) offset = 60 * minutes[0];

  var hours = spec.split("hours");
  if (hours.length > 1) offset = 60 * 60 * hours[0];
  
  return new Date() + 1000 * 1000;
}

Timer.prototype.log = function(data) {
  console.log("Timer LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

exports.Timer = Timer;