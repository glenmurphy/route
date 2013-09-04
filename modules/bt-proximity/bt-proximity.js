var spawn = require('child_process').spawn,
	  util = require('util'),
    EventEmitter = require('events').EventEmitter;

/**
 * This is a pile of hacks; it uses the BlueZ command line tools to 
 * look for a specific bluetooth device. Because those tools can be
 * somewhat brittle (or maybe it's just my adapter), it restarts the
 * bluetooth device each time.
 *
 * Before using, you need to do
 *   hcitool lescan
 *   hcitool lecc [MACADDRESS]
 */
function BTProximity(data) {
  this.mac = data.mac;
  this.name = data.name;
  this.init();

  setInterval(this.checkAway.bind(this), 5000);
  process.on('SIGINT', this.shutdown.bind(this));
}
util.inherits(BTProximity, EventEmitter);

BTProximity.SCANPRESENT = 40000; // how often we SCAN when present.
BTProximity.SCANAWAY = 5000; // how often we SCAN when away.
BTProximity.AWAYAFTERTIME = 90000; // how long we can go without seeing a device before we consider you away

BTProximity.prototype.exec = function(command, data) {
};

BTProximity.prototype.init = function() {
  if (this.tool)
    this.tool.kill();

  this.tool = spawn('gatttool', ['-b', this.mac, '-I'], {detached: true});
  this.tool.stdout.on("data", this.handleData.bind(this));
  this.tool.stderr.on("data", this.handleData.bind(this));
  this.tool.on("close", this.handleClose.bind(this));

  this.setScanRate(BTProximity.SCANPRESENT);
  if (!this.lastSeen) {
    this.lastSeen = new Date().getTime(); // Pretend we're here.
    this.present = true;
  }
};

BTProximity.prototype.shutdown = function() {
  console.log("BTProximity: Shutting down gatttool...");
  if (this.tool)
    this.tool.kill();
  process.exit();
};

BTProximity.prototype.handleClose = function() {
  console.log("BTProximity: gatttool closed");
  this.tool = null;
  setTimeout(this.init.bind(this), 5000);
};

BTProximity.prototype.checkAway = function() {
  var time = new Date().getTime();
  if (this.lastSeen + BTProximity.AWAYAFTERTIME < time) {
    this.setAway();
  }
};

BTProximity.prototype.setScanRate = function(rate) {
  if (this.scanInterval)
    clearInterval(this.scanInterval);
  this.scanInterval = setInterval(this.scan.bind(this), rate);
};

BTProximity.prototype.scan = function () {
  if (!this.tool) return;
  console.log("BTProximity: Scanning: " + (new Date()).toLocaleTimeString());
  this.tool.stdin.write('connect\n');
};

BTProximity.prototype.setAway = function() {
  if (!this.present) return;

  this.present = false;
  console.log("BTProximity: User is away " + (new Date()).toLocaleTimeString());
  this.emit("DeviceEvent", "Away");
  this.setScanRate(BTProximity.SCANAWAY);
};

BTProximity.prototype.setPresent = function() {
  this.lastSeen = new Date().getTime();
  if (this.present) return;

  this.present = true;
  console.log("BTProximity: User found " + (new Date()).toLocaleTimeString());
  this.emit("DeviceEvent", "Present");
  this.setScanRate(BTProximity.SCANPRESENT);
};

BTProximity.prototype.handleData = function(data) {
  var lines = data.toString().split("\n");
  for (var i = 0; i < lines.length; i++) {
    line = lines[i].toLowerCase();
    if (line.indexOf("connection successful") != -1 || line.indexOf("[con]") != -1) {
      console.log("BTProximity: Found: " + (new Date()).toLocaleTimeString());
      this.setPresent();
    } else if (line.indexOf("too many open files") != -1) {
      this.init();
    }
  }
};

exports.BTProximity = BTProximity;
