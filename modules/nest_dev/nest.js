var EventEmitter = require('events').EventEmitter;
var util = require('util');
var nest = require('unofficial-nest-api')

function Nest(data) {
  this.user = data.user;
  this.debug = data.debug;
  this.password = data.password;
  this.connect();
  this.names = {};
  this.ids = {};
};
util.inherits(Nest, EventEmitter);

Nest.prototype.connect = function () {
  nest.login(this.user, this.password, function (err, data) {
    if (err) {
      console.log("Login failed", err);
    } else {
      //if (this.debug) console.log("Nest connected", data);
      nest.fetchStatus(this.statusUpdated.bind(this));
    }
  }.bind(this));
}

Nest.prototype.statusUpdated = function(data) {
  this.names = {};
  for (var deviceId in data.device) {
    if (data.device.hasOwnProperty(deviceId)) {
      var device = data.shared[deviceId];
      // console.log(deviceId, device.name, device);
      var shortName = device.name.replace(/ /g,"") || deviceId;
      this.ids[deviceId] = shortName;
      this.names[shortName] = deviceId;
      this.handleDeviceData(deviceId, device);
    }
  }
  // this.subscribe();
  this.fetchData();
};

Nest.prototype.handleDeviceData = function(deviceId, data) {
  if (deviceId) {
    // console.log('SubscribedDevice: ' + deviceId);
    // if (this.debug) console.log(JSON.stringify(data));
    var shortName = data.name.replace(/ /g,"") || deviceId;
    var temperature = nest.ctof(data.current_temperature);
    data.current_temperature_f = Math.round(temperature);
    var target_temperature = nest.ctof(data.target_temperature);
    data.target_temperature_f = Math.round(target_temperature);
    var state = {};
    state["nest." + shortName] = data;
    this.emit("StateEvent", state);
    this.emit("DeviceEvent", shortName + "." + temperature);
  }
}

Nest.prototype.fetchData = function(data) {
  nest.subscribe(function (deviceId, data, type) {
    this.handleDeviceData(deviceId, data);
    setTimeout(this.fetchData.bind(this), 2000);
  }.bind(this), ['shared']);
}

Nest.prototype.setTemperature = function(thermostat, temperature) {
  var deviceId = this.names[thermostat];
  console.log(thermostat, temperature, nest.ftoc(temperature));
  nest.setTemperature(deviceId, nest.ftoc(temperature));
}

Nest.prototype.setTargetTemperatureType = function(thermostat, type) {
  var deviceId = this.names[thermostat];
  console.log(thermostat, type);
  nest.setTargetTemperatureType(deviceId, type);
}

Nest.prototype.exec = function(command, data) {
  this.log(command);
};

Nest.prototype.log = function(data) {
  console.log("Nest LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

module.exports = Nest;