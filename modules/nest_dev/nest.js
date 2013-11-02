var EventEmitter = require('events').EventEmitter;
var util = require('util');
var nest = require('unofficial-nest-api')

function Nest(data) {
  this.user = data.user;
  this.password = data.password;
  this.connect();
};
util.inherits(Nest, EventEmitter);

Nest.prototype.connect = function () {
  nest.login(this.user, this.password, function (response) {
    //console.log(response);
    if (!response) {
      console.log("Login failed");
    } else {
      nest.fetchStatus(this.statusUpdated.bind(this));
    }
  }.bind(this));
}

Nest.prototype.statusUpdated = function(data) {
  this.names = {};
  for (var deviceId in data.device) {
    if (data.device.hasOwnProperty(deviceId)) {
      var device = data.shared[deviceId];
      this.names[deviceId] = device.name;
        if (this.debug) console.log(util.format("%s [%s], Current temperature = %d F target=%d",
          device.name, deviceId,
          nest.ctof(device.current_temperature),
          nest.ctof(device.target_temperature)));
    }
  }
  this.subscribe();
  this.fetchData();
};

Nest.prototype.fetchData = function(data) {
  nest.subscribe(function (deviceId, data, type) {
    if (deviceId) {
        //console.log('Device: ' + deviceId + " type: " + type);
        if (this.debug) console.log(JSON.stringify(data));
        var state = {};
        state[this.names[deviceId]] = data;
        this.emit("StateEvent", {"nest" : state});

    } else {

    }
    setTimeout(this.fetchData.bind(this), 2000);
  }.bind(this), ['shared', 'energy_latest']);
}

Nest.prototype.setTemperature = function(thermostat, temperature) {


}

Nest.prototype.subscribe = function() {
    nest.subscribe(this.subscribeDone.bind(this));
}

Nest.prototype.subscribeDone = function(deviceId, data) {
    if (deviceId) {
        if (this.debug) console.log('Device: ' + deviceId)
        if (this.debug) console.log(JSON.stringify(data));
    }
    setTimeout(this.subscribe.bind(this), 2000);
}

Nest.prototype.exec = function(command, data) {
  this.log(command);
};

Nest.prototype.log = function(data) {
  console.log("Nest LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

exports.Nest = Nest;