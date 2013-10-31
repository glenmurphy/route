var EventEmitter = require('events').EventEmitter;
var util = require('util');
var SunCalc = require("suncalc");

function Sun(data) {
  this.debug = data.debug;
  this.latitude = data.latitude;
  this.longitude = data.longitude;
  setTimeout(this.calculateSunEvents.bind(this), 1000);
};
util.inherits(Sun, EventEmitter);

Sun.TIMEARRAY = ["NightEnd", "NauticalDawn", "Dawn", "Sunrise", "SunriseEnd", "GoldenHourEnd", "SolarNoon", "GoldenHour", "SunsetStart", "Sunset", "Dusk", "NauticalDusk", "Night"];

function setDateTimeout(fn, d){
  var t = d.getTime() - (new Date()).getTime();
  if (t > 0) return setTimeout(fn, t);
}

function pad(str, char, len) {
  return str + new Array(Math.max(len - str.length, 0)).join(char);
}

Sun.prototype.calculateSunEvents = function() {
  var times = SunCalc.getTimes(new Date(), this.latitude, this.longitude);
  times = this.normalizeStrings(times);

  var position = SunCalc.getPosition(new Date(), this.latitude, this.longitude);
  
  this.emit("StateEvent", {SunEvents:times});
  this.emit("StateEvent", {SunEvent:this.getSunEvent(new Date(), times)});
  this.emit("StateEvent", {SunPosition:position});

  var logstring = "";
  for (var i = 0; i < Sun.TIMEARRAY.length; i++) {
    var attrname = Sun.TIMEARRAY[i];
    logstring += times[attrname].getHours() + ":" + times[attrname].getMinutes() + " " + attrname + ", ";
    setDateTimeout(this.processSunEvent.bind(this, attrname), times[attrname]);

    if (this.debug) {
      console.log("SunEvent: " + attrname);
      console.log("Time: " + times[attrname]);
      console.log("Time now: " + new Date());
      console.log("Time left: " + (times[attrname].getTime() - (new Date()).getTime()).toString());
    }
  }

  if (this.debug) console.log("*  Sun: Sun events: " + logstring)

  // recalculate tomorrow at midnight;
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(3);
  tomorrow.setMinutes(0);
  tomorrow.setSeconds(0);
  setDateTimeout(this.calculateSunEvents.bind(this), tomorrow);
}

Sun.prototype.getSunEvent = function (date, sunEvents) {
  var sunEvent = "Night";
  for (var i = 0; i < Sun.TIMEARRAY.length; i++) {
    var attrname = Sun.TIMEARRAY[i];
    if (sunEvents[attrname] < date) {
      sunEvent = attrname;
    }
  }

  return sunEvent;
}

Sun.prototype.normalizeStrings = function(obj) {
  var newObj = {};
  for (i in obj) {
    newObj[i.charAt(0).toUpperCase() + i.slice(1)] = obj[i];
  }
  return newObj;
}

Sun.prototype.processSunEvent = function (type) {
  this.emit("DeviceEvent", type);
  this.emit("StateEvent", {SunEvent:type});
  if (this.debug) {
    console.log(type);
    console.log(new Date());
  }
}

Sun.prototype.exec = function(command, data) {
  console.log("Sun:" + command);
};

exports.Sun = Sun;