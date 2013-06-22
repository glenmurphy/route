var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var http = require('http');
var net = require('net');
var url = require('url');
var util = require('util');

function InsteonIPCamera(data) {
  this.host = data.host;
  this.port = data.port || "80";
  this.username = data.username;
  this.password = data.password;
  this.dir = data.dir || "../..";
  this.debug = data.debug;
}
util.inherits(InsteonIPCamera, EventEmitter);

InsteonIPCamera.prototype.exec = function(command, params) {
  if (command == "Capture") {
    this.sendCommand("/snapshot.cgi");
  }
};

InsteonIPCamera.prototype.sendCommand = function(path, value) {
  var options = {
    host: this.host,
    port: 80,
    path: path,
    headers: {
     'Authorization': 'Basic ' + new Buffer(this.username + ':' + this.password).toString('base64')
    } 
  };

  http.get(options, function(res) {
    var imagedata = ''
    res.setEncoding('binary')

    res.on('data', function(chunk){
      imagedata += chunk
    });

    res.on('end', function(){
      fs.writeFile(this.dir + '/Front door' + new Date() +'.png', imagedata, 'binary', function(err){
        if (err) throw err
        console.log('File saved.')
      });
    }.bind(this));

  }.bind(this)).on('error', function(e) {
    console.log("Got error: " + e.message);
  });
}

exports.InsteonIPCamera = InsteonIPCamera;
