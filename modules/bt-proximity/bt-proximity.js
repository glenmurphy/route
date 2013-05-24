var spawn = require('child_process').spawn,
	  util = require('util'),
    EventEmitter = require('events').EventEmitter;

/**
 * This is a pile of hacks; it uses the BlueZ command line tools to 
 * look for a specific bluetooth device. Because those tools can be
 * somewhat brittle (or maybe it's just my adapter), it restarts the
 * bluetooth device each time.
 */
function BTProximity(data) {
  this.mac = data.mac;
  this.name = data.name;
  this.init();

  this.present = new Date().getTime(); // Pretend we're here.
  setInterval(this.checkAway.bind(this), BTProximity.AWAYCHECKTIME);
  setInterval(this.connect.bind(this), BTProximity.RESCANTIME);
}
util.inherits(BTProximity, EventEmitter);

BTProximity.prototype.exec = function(command, data) {
};

BTProximity.prototype.init = function() {
  this.tool = spawn('gatttool', ['-b', this.mac, '-I']);
  this.tool.stdout.on("data", this.handleData.bind(this));
  this.tool.on("close", this.handleClose.bind(this));
};

BTProximity.prototype.handleClose = function() {
  console.log("BTPROX: GATTTOOL CLOSED");
  this.tool = null;
  setTimeout(this.init.bind(this), 10000);
};

BTProximity.AWAYAFTERTIME = 120000; // how long we can go without seeing a device before we consider you away
BTProximity.AWAYCHECKTIME = 5000; // how often we check for AWAYAFTERTIME
BTProximity.RESCANTIME = 30000; // how often we force-rescan the network

BTProximity.prototype.connect = function () {
  this.tool.stdin.write('connect\n');
};

BTProximity.prototype.setAway = function() {
  console.log("Away");
  this.emit("DeviceEvent", "Away");
  this.present = 0;
};

BTProximity.prototype.setPresent = function() {
  if (!this.present) {
    console.log("Present");
    this.emit("DeviceEvent", "Present");
  }
  this.present = new Date().getTime();
};

BTProximity.prototype.checkAway = function() {
  if (!this.present) return;

  var time = new Date().getTime();
  if (this.present + BTProximity.AWAYAFTERTIME < time) {
    this.setAway();
  }
};

BTProximity.prototype.handleData = function(data) {
  var lines = data.toString().split("\n");
  for (var i = 0; i < lines.length; i++) {
    line = lines[i];
    console.log(line);
    if (line.indexOf("Connection successful") != -1) {
      this.setPresent();
    } else if (line.indexOf("Error") != -1) {
      this.connect();
    }
  }
};

exports.BTProximity = BTProximity;

// var b = new (require("./bt-proximity")).BTProximity({mac : "00:18:30:EB:68:BC"});