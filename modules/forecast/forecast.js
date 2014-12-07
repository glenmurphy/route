var EventEmitter = require('events').EventEmitter;
var util = require('util');
var https = require('https');
var SunCalc = require("suncalc");

function Forecast(data) {
  this.debug = data.debug;
  this.latitude = data.latitude;
  this.longitude = data.longitude;
  this.forecastKey = data.forecastKey
  this.currentConditions = undefined;
  this.fetchRainForecast();
};
util.inherits(Forecast, EventEmitter);

Forecast.prototype.fetchRainForecast = function() {
  var path = '/forecast/'+this.forecastKey+'/'+this.latitude+','+this.longitude;
  var req = https.get({
    host: 'api.forecast.io',
    port: 443,
    path : path
  }, function(res) {
    res.setEncoding("utf8");
    res.data = '';
    res.on('data', function(d) { res.data += d; });
    res.on('end', function() { this.parseRainForecast(res.data, res.headers);}.bind(this));
  }.bind(this));
  req.on('error', function(e) {
    console.log('forecast: ' + e.message);
  });
  req.end();
}

Forecast.prototype.parseRainForecast = function(data, headers) {
  var expires = new Date(headers.expires);
  var nextCheck = (expires - new Date())/1000;
  if (!data) return null;

  try {
    data = JSON.parse(data);
    var newConditions = data.currently.summary;
    if (this.currentConditions != newConditions) {
      this.currentConditions = newConditions;
      this.emit("DeviceEvent", newConditions.replace(" ", ""));
    }
    this.emit("StateEvent", {Forecast:data});
    nextCheck = Math.max(10, Math.min(nextCheck, 1800));
    if (this.debug) console.log("Forecast checking in", nextCheck);
    setTimeout(this.fetchRainForecast.bind(this), nextCheck * 1000);
  } catch(e) {
    console.log("Forecast: Error parsing:" + e);
  }
}

Forecast.prototype.exec = function(command, data) {
  console.log("Forecast:" + command);
};

module.exports = Forecast;