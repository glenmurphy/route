var pty = require('pty.js'),
	util = require('util'),
    EventEmitter = require('events').EventEmitter,
    http = require('http');

function BTProximity(data) {
  this.mac = data.mac;
  this.name = data.name;

  this.present = 0;
  this.linebuf = "";
  this.reset();
  process.on('SIGINT', this.shutdown.bind(this));

  setInterval(this.checkAway.bind(this), BTProximity.AWAYLOOP);
}
util.inherits(BTProximity, EventEmitter);

BTProximity.prototype.exec = function(command, data) {
};

BTProximity.AWAYLOOP = 15000;

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

  if (this.present + BTProximity.AWAYLOOP < new Date().getTime()) {
    this.setAway();
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
    setTimeout(this.reset.bind(this), BTProximity.AWAYLOOP / 5);
  }
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