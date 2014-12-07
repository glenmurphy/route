var EventEmitter = require('events').EventEmitter;
var util = require('util');

String.prototype.camelcase = function() {
    return this.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); }).replace(/ /g, "");
};

function Location(data) {
  this.host = data.host;
  this.users = {};
};
util.inherits(Location, EventEmitter);

Location.prototype.exec = function(command, params) {
  if (command == "Update") {
    this.users[params.user] = params;
    this.emit("StateEvent", {locationUsers : this.users});
    var eventDescription = params.user + " " + params.event + " " + params["location"];
    this.emit("DeviceEvent", eventDescription.camelcase());
  }
};

module.exports = Location;