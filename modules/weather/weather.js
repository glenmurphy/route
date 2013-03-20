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

Weather.TIMEARRAY = ["NightEnd", "NauticalDawn", "Dawn", "Sunrise", "SunriseEnd", "GoldenHourEnd", "SolarNoon", "GoldenHour", "SunsetStart", "Sunset", "Dusk", "NauticalDusk", "Night"];

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
  times = this.normalizeStrings(times);
  var position = SunCalc.getPosition(new Date(), this.latitude, this.longitude);
  this.emit("StateEvent", {SunEvents:times});
  this.emit("StateEvent", {SunPosition:position});

  this.emit("StateEvent", {SunEvent:this.getSunEvent(new Date(), times)});

  function pad(str, char, len) {
    return str + new Array(Math.max(len - str.length, 0)).join(char);
  }

  var logstring = "";
  for (var i = 0; i < Weather.TIMEARRAY.length; i++) {
    var attrname = Weather.TIMEARRAY[i];
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

Weather.prototype.getSunEvent = function (date, sunEvents) {
  var sunEvent; 

  for (var i = 0; i < Weather.TIMEARRAY.length; i++) {
    var attrname = Weather.TIMEARRAY[i];

    if (sunEvents[attrname] < date) {
      sunEvent = attrname;
    }
  }

  return sunEvent;
}

Weather.prototype.normalizeStrings = function(obj) {
  var newObj = {};
  for (i in obj) {
    newObj[i.charAt(0).toUpperCase() + i.slice(1)] = obj[i];
  }

  return newObj;
}

Weather.prototype.processSunEvent = function (type) {
  this.emit("DeviceEvent", type);
  this.emit("StateEvent", {SunEvent:type});
}

Weather.prototype.exec = function(command, data) {
  this.log(command);
};

Weather.prototype.log = function(data) {
  console.log("Weather LOG:" + data);
  this.emit("DeviceEvent", "Sunrise");
}

exports.Weather = Weather;