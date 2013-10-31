var EventEmitter = require('events').EventEmitter;
var util = require('util');
var netatmo = require('node-netatmo');

function Netatmo(data) {
  this.host = data.host;
  this.connection = new netatmo.Netatmo();
  this.connection.on('error', function(err) { console.log("!  Netatmo error", err);})
  this.connection.setConfig( data.clientId , data.clientSecret , data.userName , data.password);
  this.connection.getToken(function(err) {
    if (err) return console.log('getToken: ' + err.message);
    if (this.debug) console.log("*  Netatmo logged in");
    // good to go!
    this.check()
  }.bind(this))
}
util.inherits(Netatmo, EventEmitter);

Netatmo.prototype.check = function() {
  this.connection.getUser(function(err, results) {
    if (err) return console.log('getUser: ' + err.message);
    if (results.status !== 'ok')  { console.log('getUser not ok'); return console.log(results); }
    if (this.debug) console.log("D  Netatmo user:", results.body);
    this.devices = results.body.devices;
  }.bind(this));
  this.connection.getDevices(function(err, results) {
    if (err) return console.log('getDevices: ' + err.message);
    if (results.status !== 'ok')  { console.log('getDevices not ok'); return console.log(results); }
    if (this.debug) console.log("D  Netatmo devices:", results.body);
    this.devices = results.body.devices;
    this.deviceId = this.devices[0]._id;
    this.modules = results.body.modules;
    this.getMeasurements();
  }.bind(this));
}

Netatmo.TYPES = [ 'temperature', 'humidity', 'co2', 'pressure', 'noise' ];
Netatmo.prototype.getMeasurements = function() {
  var allDevices = this.devices.concat(this.modules);
  for (var i in allDevices) {
    var device = allDevices[i];
    var params = {
      device_id : this.deviceId,
      module_id : device._id,
      scale     : 'max',
      type      : Netatmo.TYPES,
      date_end   : "last",
      };
    var name = device.module_name;
    this.connection.getMeasurement(params, function(device, err, results) {
      if (err) return console.log('getMeasurement: ' + err.message);
      if (results.status !== 'ok')  { console.log('getMeasurement not ok', results); return console.log(results); }
      var measurements = results.body[0].value[0];
      var status = {}
      for (var i = 0; i < measurements.length; i++) {
        if (measurements[i]) status[Netatmo.TYPES[i]] = measurements[i];
      };
      status.temperature = Math.round(status.temperature * 9 / 5 + 32);
      this.emit("DeviceEvent", device.module_name + "." + status.temperature, status);
      var state = {};
      state["Netatmo." + device.module_name] = status;
      this.emit("StateEvent", state);
    }.bind(this, device));
  }
  setTimeout(this.getMeasurements.bind(this), 5 * 60 * 60 * 1000);
}

exports.Netatmo = Netatmo;
