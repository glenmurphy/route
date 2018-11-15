var EventEmitter = require('events').EventEmitter;
var http = require('http');
var util = require('util');

var nextCheck = 1*60*60*1000;

function AirVisual(data) {
  this.debug = data.debug;
  this.latitude = data.latitude;
  this.longitude = data.longitude;
  this.airVisualKey = data.airVisualKey;
  this.currentConditions = undefined;
  this.name = data.name || "AirQuality";
  this.fetchAirQuality();
};
util.inherits(AirVisual, EventEmitter);

AirVisual.prototype.fetchAirQuality = function() {
  var path = '/v2/nearest_city?lat'+this.latitude+'&lon='+this.longitude+'&key='+this.airVisualKey;
  var req = http.get({
    host: 'api.airvisual.com',
    port: 80,
    path : path
  }, function(res) {
    res.setEncoding("utf8");
    res.data = '';
    res.on('data', function(d) { res.data += d; });
    res.on('end', function() { this.parseAirQuality(res.data, res.headers);}.bind(this));
  }.bind(this));
  req.on('error', function(e) {
    console.log('airvisual: ' + e.message);
  });
  req.end();
}

AirVisual.prototype.parseAirQuality = function(data, headers) {
  if (!data) return null;

  try {
    data = JSON.parse(data);
    var aqi = data.data.current.pollution.aqius;
    if (this.aqi != aqi) {
      this.aqi = aqi;

      var category;

      if (aqi <= 50) {
	    category = "Good";
	  } else if (aqi <= 100) {
	    category = "Moderate";
	  } else if (aqi <= 150) {
	    category = "UnhealthyForSensitiveGroups";
	  } else if (aqi <= 200) {
	    category = "Unhealthy";
	  } else if (aqi <= 300) {
	    category = "VeryUnhealthy";
	  } else if (aqi > 300) {
	    category = "Hazardous";
	  } else {
	  	category = "Unknown";
	  }

      this.emit("DeviceEvent", category);
    }
    var state = {};
    state[this.name] = data.data;
    this.emit("StateEvent", state);
    if (this.debug) console.log("AirVisual data", data);
    if (this.debug) console.log("AirVisual checking in", nextCheck);
    setTimeout(this.fetchAirQuality.bind(this), nextCheck);
  } catch(e) {
    console.log("AirVisual: Error parsing:" + e);
  }
}

AirVisual.prototype.exec = function(command, data) {
  console.log("AirVisual:" + command);
};

module.exports = AirVisual;
