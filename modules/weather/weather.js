var EventEmitter = require('events').EventEmitter;
var util = require('util');
var https = require('https');
var SunCalc = require("suncalc");

function Weather(data) {
  this.latitude = data.latitude;
  this.longitude = data.longitude;
  this.location = data.location;
  this.darkskyKey = data.darkskyKey
  setTimeout(this.calculateSunEvents.bind(this), 1000);
  this.fetchRainForecast();
};
util.inherits(Weather, EventEmitter);

function setDateTimeout(fn, d){
    var t = d.getTime() - (new Date()).getTime();
    if (t > 0) return setTimeout(fn, t);
}

Weather.prototype.fetchRainForecast = function() {
  var path = '/v1/forecast/'+this.darkskyKey+'/'+this.latitude+','+this.longitude;
  var req = https.get({
    host: 'api.darkskyapp.com',
    port: 443,
    path : path
  }, function(res) {
    res.setEncoding("utf8");
    res.data = '';
    res.on('data', function(d) { res.data += d; });
    res.on('end', function() { this.parseRainForecast(res.data);}.bind(this));
  }.bind(this)).on('error', function(e) {
    console.log("Darksky: " + e);
  });
  req.on('error', function(e) {
    console.log('Darksky: ' + e.message);
  });

  req.end();
}

Weather.prototype.parseRainForecast = function(data) {
  if (!data) return null;
  try {
    data = JSON.parse(data);
    var nextCheck = data["checkTimeout"];
    nextCheck = Math.min(nextCheck, 1800);
    setTimeout(this.fetchRainForecast.bind(this), nextCheck * 1000);
    this.emit("StateEvent", {weather:data});    
  } catch(e) {
    console.log("Darksky: Error parsing:" + e);
  }
}

Weather.prototype.calculateSunEvents = function() {
  var times = SunCalc.getTimes(new Date(), this.latitude, this.longitude);
  var position = SunCalc.getPosition(new Date(), this.latitude, this.longitude);
  this.emit("StateEvent", {sunEvents:times});
  this.emit("StateEvent", {sunPosition:position});

  function pad(str, char, len) {
    return str + new Array(Math.max(len - str.length, 0)).join(char);
  }

  var timeArray = ["nightEnd", "nauticalDawn", "dawn", "sunrise", "sunriseEnd", "goldenHourEnd", "goldenHour", "sunsetStart", "sunset", "dusk", "nauticalDusk", "night"];
  var logstring = "";
  for (var i = 0; i < timeArray.length; i++) {
    var attrname = timeArray[i];
    logstring += times[attrname].getHours() + ":" + times[attrname].getMinutes() + " " + attrname + ", ";
    setDateTimeout(this.processSunEvent.bind(this, attrname), times[attrname]);
  }

  if (this.debug) console.log("* Weather: Sun events: " + logstring)

  // recalculate tomorrow at midnight;
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0);
  tomorrow.setMinutes(0);
  tomorrow.setSeconds(0);
  setDateTimeout(this.calculateSunEvents.bind(this), tomorrow);
}

Weather.prototype.processSunEvent = function (type) {
  this.emit("DeviceEvent", type);
}

Weather.prototype.exec = function(command, data) {
  this.log(command);
};

Weather.prototype.log = function(data) {
  console.log("Weather LOG:" + data);
  this.emit("DeviceEvent", "Sunrise");
}

exports.Weather = Weather;