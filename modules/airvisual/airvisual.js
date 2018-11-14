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
    var newConditions = data.data.current.pollution;
    if (this.currentConditions != newConditions) {
      this.currentConditions = newConditions;
      this.emit("DeviceEvent", JSON.stringify(newConditions).replace(" ", ""));
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
