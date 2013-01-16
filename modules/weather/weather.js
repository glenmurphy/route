/*
Copyright 2012 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var darksky = require("darksky");
var SunCalc = require("suncalc");

function Weather(data) {
  this.latitude = data.latitude;
  this.longitude = data.longitude;
  this.location = data.location;
  this.darkskyKey = data.darkskyKey
  setTimeout(this.calculateSunEvents.bind(this), 1000);

  this.darksky = new darksky(this.darkskyKey);
  this.fetchRainForecast();
};
util.inherits(Weather, EventEmitter);

function setDateTimeout(fn, d){
    var t = d.getTime() - (new Date()).getTime();
    if (t > 0) return setTimeout(fn, t);
}

Weather.prototype.fetchRainForecast = function() {
  this.darksky.forecast(this.latitude, this.longitude,
    this.parseRainForecast.bind(this) ,
    function(err) {console.error(err);});
}

Weather.prototype.parseRainForecast = function(data) {
  data = data.toString();
  data = JSON.parse(data);
  var nextCheck = data["checkTimeout"];
  nextCheck = Math.min(nextCheck, 1800);
  setTimeout(this.fetchRainForecast.bind(this), nextCheck * 1000);
  this.emit("StateEvent", {weather:data});
}

Weather.prototype.calculateSunEvents = function() {
  var times = SunCalc.getTimes(new Date(), this.latitude, this.longitude);
  var position = SunCalc.getPosition(new Date(), this.latitude, this.longitude);
  this.emit("StateEvent", {sunEvents:times});
  this.emit("StateEvent", {sunPosition:position});

  var logstring = "";
  for (var attrname in times) {
    logstring += attrname + ":" + times[attrname].getHours() + ":" +  times[attrname].getMinutes() + " ";
    setDateTimeout(this.processSunEvent.bind(this, attrname), times[attrname]);
  }
  console.log("Sun Events:" + logstring)

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