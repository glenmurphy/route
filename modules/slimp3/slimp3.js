var EventEmitter = require('events').EventEmitter;
var net = require('net');
var util = require('util');
var dgram = require('dgram');

// http://wiki.slimdevices.com/index.php/SLIMP3_client_protocol


var CODE_DELAY = 0x00;
var CODE_CMD   = 0x02;
var CODE_DATA  = 0x03;

var NUM_LINES  =  2;
var LINE_WIDTH = 40;
var NUM_CHARS = NUM_LINES * LINE_WIDTH;


function Slimp3(data) {
  this.addr = data.addr || "10.0.1.222";
  this.port = data.port || Slimp3.COM_PORT;
  this.devices = {};
  this.debug = data.debug;
  this.connect();
};
util.inherits(Slimp3, EventEmitter);

Slimp3.REMOTE_CODES = {
  0x00FF: "VolumeDown",
  0x807F: "VolumeUp",
  0x10EF: "Play",
  0x20DF: "Pause",
  0xD02F: "Right",
  0x906f: "Left",
  0xe01f: "Up",
  0xb04f: "Down",
  0xa05f: "NextTrack",
  0xc03f: "PrevTrack",

}

Slimp3.prototype.exec = function(command, data) {
  if (command == "ShowTrackInfo") {
    console.log("show: ", data);


    this.sendText(data.name + " - " + data.artist + " - " + data.album );

    // var scene = data.scene;
    // var unit = data.zone || data.controlUnit;
    // unit = this.controlUnits[unit];
    // this.selectScene([unit], scene)
  }
};

Slimp3.prototype.sendCommand = function(buf) {
    var command = new Buffer({0:"l".charCodeAt(0), length:18});
    command = Buffer.concat([command, buf]);
    console.log("Sending:", this.addr + ":" + this.port + "\n\t", command)
    this.server.send(command, 0, command.length, this.port, this.addr);
};

Slimp3.prototype.sendText = function(string) {
    var message = new Buffer(NUM_CHARS * 2);

    for (var i = 0; i < string.length; i++) {
      message[i * 2] = CODE_DATA;
      message[i * 2 + 1] = string.charCodeAt(i);
    };

    for (; i < NUM_CHARS; i++) {  // Fill out the rest of the text view
      message[i * 2] = CODE_DATA;
      message[i * 2 + 1] = 0x20;
    };

    this.sendCommand(message);
}



Slimp3.prototype.parseData = function(data) {
  
}

// Connection

Slimp3.COM_PORT = 3483;

Slimp3.prototype.connect = function() {
  this.server = dgram.createSocket("udp4");
  this.server.on("message", this.handleMessage.bind(this));
  this.server.on("listening", function () {
    var address = this.server.address();
    console.log("server listening " + address.address + ":" + address.port); 
    this.sendText("Server reconnected");
  }.bind(this));
  this.server.bind(Slimp3.COM_PORT);
  // this.server.setEncoding();
  // this.server.on('data', this.handleData.bind(this));
  // this.server.on('error', this.handleError.bind(this));
};

Slimp3.prototype.handleIR = function(code) {

    // if (this.debug) console.log("Got IR: 0x", code.toString(16));
  var command = Slimp3.REMOTE_CODES[code] || code.toString(16);
  this.emit("DeviceEvent", command);

}

Slimp3.prototype.handleMessage = function(msg, rinfo) {
 if (this.debug) console.log("SlimServer got: '" + msg + "' from " +
   rinfo.address + ":" + rinfo.port, msg[0], msg.toString('utf8', 0, 1));

 switch (msg.toString('utf8', 0, 1)) {
  case "d":
    var message = new Buffer("D");
    this.server.send(message, 0, message.length, rinfo.port, rinfo.address);
    this.addr = rinfo.address;
    this.port = rinfo.port;
    this.sendText("Server connected");
    this.emit("DeviceEvent", "Connected");

    break;
  case "h":
    // sendText("Got Hello", true);
    break;
  case "i":
    var code = msg.readUInt16BE(10);
    this.handleIR(code);
    break;  
  // Field   Value/Description
  // 0       'i' as in "IR"
  // 1       0x002..5    player's time since startup in ticks @625 KHz
  // 6       0xFF (will eventually be an identifier for different IR code sets)
  // 7       number of meaningful bits - always 16 (0x10) for JVC
  // 8..11   the 32-bit IR code
  // 12..17  MAC address



  }


};



module.exports = Slimp3;