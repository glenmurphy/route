var EventEmitter = require('events').EventEmitter;
var util = require('util');
var SerialPort = require("serialport").SerialPort


function Serial(data) {
  this.commands = data.commands
  this.port = data.port
  this.options = data.options;
  this.serialPort = new SerialPort(this.port, this.options);

  this.serialPort.on("open", function () {
    console.log('open');
    this.serialPort.on('data', function(data) {
      console.log('data received: ' + data);
    }.bind(this));  
    var buffer = new Buffer("BEEF100500C6FF111101000100", "hex");
    this.serialPort.write("buffer", function(err, results) {
      if (err) console.log('err ' + err);
      console.log('results ' + results);
    }.bind(this));  
  }.bind(this));
};

Serial.prototype.exec = function(command, data) {
  if (!(command in this.commands)) return;
  console.log("*  Serial Executing: " + command);
  var path = this.commands[command];
  this.send(path);
};

Serial.prototype.send = function(string) {
  this.serialPort.write(string);
}



util.inherits(Serial, EventEmitter);
exports.Serial = Serial;