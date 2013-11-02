var noble = require('noble'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter;

function BTProximity(data) {
  this.debug = data.debug;
  noble.on('stateChange', this.handleStateChange.bind(this));
  noble.on('discover', this.handleDiscover.bind(this));

  // Map of people names to macs.
  this.people = data.people || {};

  // Create reverse people map.
  this.people_ids = {};
  for (var name in this.people) {
    var id = this.people[name];
    this.people_ids[id] = name;
  }

  // Create list of present ids
  this.present_ids = [];

  this.lastSeen = {}

  if(this.debug) console.log(this.people)

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

  /*if (!this.lastSeen) {
    this.lastSeen = new Date().getTime(); // Pretend we're here.
    this.present = true;
  }*/
};

BTProximity.prototype.shutdown = function() {
};

BTProximity.prototype.checkAway = function() {

  for (var mac in this.lastSeen) {
    
    //console.log("Last seen time: "+this.lastSeen[mac]);
    if (this.lastSeen[mac] + BTProximity.AWAYAFTERTIME < new Date().getTime()) {
      this.setAway(mac);
    }
  }
};

BTProximity.prototype.setAway = function(mac) {

  // If we still have mac as present, remove it now
  for (var i = 0; i < this.present_ids.length; i++) {
    if (mac == this.present_ids[i]) {
      this.present_ids.splice(i,1);
      if (this.debug) {
        console.log("BTProximity: User "+ this.people_ids[mac] +" is away " + (new Date()).toLocaleTimeString());
      }
      this.emit("DeviceEvent", "Away." + this.people_ids[mac]);
    }
  }
};

BTProximity.prototype.setPresent = function(mac) {

  // Update the last time we saw this id
  this.lastSeen[mac] = new Date().getTime();

  // If mac is already counted as present, return
  for (var id in this.present_ids) {
    if (mac == this.present_ids[id]) return;
  }
    
  // Otherwise, add id to present id array
  this.present_ids.push(mac);
  
  if (this.debug) {
    console.log("BTProximity: User "+this.people_ids[mac]+" found " + (new Date()).toLocaleTimeString());
  }
  this.emit("DeviceEvent", "Present." + this.people_ids[mac]);
};

BTProximity.prototype.handleDiscover = function(peripheral) {
  // Convert UUID to MAC
  var mac = peripheral.uuid.toUpperCase().replace(/(.{2})(?=.)/g,"$1:");
  
  // If the mac we found is in our people list, set person to present
  for (var id in this.people_ids) {
    if (id == mac) {
      this.setPresent(mac);  
    }
  }

  //if (this.debug) console.log(mac);
};

exports.BTProximity = BTProximity;
