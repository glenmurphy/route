var pty = require('pty.js'),
	util = require('util'),
    EventEmitter = require('events').EventEmitter,
    http = require('http');

/**
 * This is a pile of hacks; it uses the BlueZ command line tools to 
 * look for a specific bluetooth device. Because those tools can be
 * somewhat brittle (or maybe it's just my adapter), it restarts the
 * bluetooth device each time.
 */
function BTProximity(data) {
  this.mac = data.mac;
  this.name = data.name;

  this.present = new Date().getTime(); // Pretend we're here.
  this.linebuf = "";
  this.reset();
  process.on('SIGINT', this.shutdown.bind(this));

  setInterval(this.checkAway.bind(this), BTProximity.AWAYCHECKTIME);
}
util.inherits(BTProximity, EventEmitter);

BTProximity.prototype.exec = function(command, data) {
};

BTProximity.AWAYAFTERTIME = 120000; // how long we can go without seeing a device before we consider you away
BTProximity.RESETAFTER = 50000; // Reset the adapter if we haven't heard anything in this time.
BTProximity.AWAYCHECKTIME = 10000; // how often we check for AWAYAFTERTIME
BTProximity.RESCANTIME = 30000; // how often we force-rescan the network

BTProximity.prototype.reset = function() {
  if (this.term) {
    this.term.kill();
    this.term.end();
  }

  this.term = pty.spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

  this.term.write('sudo hciconfig hci0 down\r');
  this.term.write('sudo hciconfig hci0 up\r');
  this.term.write('sudo hcitool lescan\r');

  this.term.on('data', this.handleData.bind(this));
};

BTProximity.prototype.setAway = function() {
  this.emit("DeviceEvent", "Away");
  this.present = 0;
};

BTProximity.prototype.setPresent = function() {
  if (!this.present) {
    this.emit("DeviceEvent", "Present");
  }
  this.present = new Date().getTime();
};

BTProximity.prototype.checkAway = function() {
  if (!this.present) return;

  var time = new Date().getTime();
  if (this.present + BTProximity.AWAYAFTERTIME < time) {
    this.setAway();
  } else if (this.present + BTProximity.RESETAFTER < time) {
  	this.reset();
  }
};

BTProximity.prototype.shutdown = function() {
  console.log("\nGracefully shutting down from SIGINT");
  this.term.kill();
  this.term.end();
  process.exit();
};

BTProximity.prototype.handleLine = function(line) {
  if (line.substr(0, this.mac.length) == this.mac) {
    this.setPresent();
    setTimeout(this.reset.bind(this), BTProximity.RESCANTIME);
  }
  //console.log(line);
};

BTProximity.prototype.processLineBuf = function() {
  var index = this.linebuf.indexOf("\n");
  if (index != -1) {
    this.handleLine(this.linebuf.substr(0, index));
    this.linebuf = this.linebuf.substr(index + 1);
    this.processLineBuf();
  }
};

BTProximity.prototype.handleData = function(data) {
  this.linebuf += data;
  this.processLineBuf();
};

exports.BTProximity = BTProximity;