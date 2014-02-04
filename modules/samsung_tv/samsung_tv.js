var EventEmitter = require('events').EventEmitter;
var util = require('util');
var http = require('http');
var net = require('net');

function SamsungTV(data) {
  this.host = data.host;
  this.mac = data.mac;
  this.port = data.port;

};
util.inherits(SamsungTV, EventEmitter);
 
SamsungTV.PORT = 55000;

var chr = String.fromCharCode;


SamsungTV.prototype.exec = function(command, params) {
  var event = command;
  this.sendKey("KEY_" + command.toUpperCase());
};


SamsungTV.prototype.isOn = function (callback) {
  var request = http.request({
      host: this.host, port: this.port, path: "/"
    }, function(res){ 
      request.gotResponse = true;
      callback(true);
    }.bind(this));
  
  request.on('socket', function (socket) {
    socket.setTimeout(1000);  
    socket.on('timeout', function() {
      if (!request.gotResponse){
        callback(false);
        request.abort();
      }
    });
  });
  request.on('error', function(e) { callback(false); });
  request.end();
  
}


SamsungTV.prototype.sendKey = function (key) {
    console.log("* Samsung:", key);


  var app = "iphone..iapp.samsung";
  var remote = "Network Control";
  var tv = "iphone.LE32C650.iapp.samsung";
  var src = "src";
  var mac = "mac";

  remote = new Buffer(remote).toString('base64');
  tv = new Buffer(tv).toString('base64');
  src = new Buffer(src).toString('base64');
  mac = new Buffer(mac).toString('base64');

  var client = net.connect({
    host : this.host,
    port : this.port || SamsungTV.PORT,
  }, function() {
    var msg = chr(0x64, 0x00) +
      chr(src.length, 0x00) + src +
      chr(mac.length, 0x00) + mac +
      chr(remote.length, 0x00) + remote;
    var pkt = chr(0x00) +
      chr(app.length, 0x00) + app +
      chr(msg.length, 0x00) + msg;
    
    client.write(pkt);

    var msg = chr(0x64) + chr(0x00) +
      chr(src.length, 0x00) + src +
      chr(mac.length, 0x00) + mac +
      chr(remote.length, 0x00) + remote;
    var pkt = chr(0x00) +
      chr(app.length, 0x00) + app +
      chr(msg.length, 0x00) + msg;

    key = new Buffer(key).toString('base64');
    msg = chr(0x00, 0x00, 0x00, key.length, 0x00) + key;
    pkt = chr(0x00) +
          chr(tv.length, 0x00) + tv +
          chr(msg.length, 0x00) + msg;
    client.write(pkt);

    client.end();
  }.bind(this));

  client.setEncoding("ascii");
  client.setTimeout(10);
  client.on('data', function(){});
  client.on('end', function(){});
  client.on('error', function(e){
    console.log("!  SamsungTV", e);
  });
}

exports.SamsungTV = SamsungTV;