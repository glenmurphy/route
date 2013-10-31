var noble = require('noble'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter;

function BTProximity(data) {
  this.mac = data.mac;
  this.name = data.name;

  noble.on('stateChange', this.handleStateChange.bind(this));
  noble.on('discover', this.handleDiscover.bind(this));

  setInterval(this.checkAway.bind(this), 5000);
}
util.inherits(BTProximity, EventEmitter);

BTProximity.AWAYAFTERTIME = 90000; // how long we can go without seeing a device before we consider you away

BTProximity.prototype.handleStateChange = function(state) {
  console.log(state);
  if (state === "poweredOn") {
    console.log("BTProximity: Powered on");
    this.init();
  }
};

BTProximity.prototype.exec = function(command, data) {
};

BTProximity.prototype.init = function() {
  console.log("Initing...");
  noble.startScanning([], true);
  if (!this.lastSeen) {
    this.lastSeen = new Date().getTime(); // Pretend we're here.
    this.present = true;
  }
};

BTProximity.prototype.shutdown = function() {
};

BTProximity.prototype.checkAway = function() {
  if (this.lastSeen + BTProximity.AWAYAFTERTIME < new Date().getTime()) {
    this.setAway();
  }
};

BTProximity.prototype.setAway = function() {
  if (!this.present) return;

  this.present = false;
  console.log("BTProximity: User is away " + (new Date()).toLocaleTimeString());
  this.emit("DeviceEvent", "Away");
};

BTProximity.prototype.setPresent = function() {
  this.lastSeen = new Date().getTime();
  if (this.present) return;

  this.present = true;
  console.log("BTProximity: User found " + (new Date()).toLocaleTimeString());
  this.emit("DeviceEvent", "Present");
};

BTProximity.prototype.handleDiscover = function(peripheral) {
  // Convert UUID to MAC
  var mac = peripheral.uuid.toUpperCase().replace(/(.{2})(?=.)/g,"$1:");
  if (mac == this.mac) {
    this.setPresent();
  }
};

exports.BTProximity = BTProximity;
