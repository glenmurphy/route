var EventEmitter = require('events').EventEmitter;
var http = require('http');
var util = require('util');

/* SONOS ------------------------------------------------------------------- */
function Sonos(data) {
  this.host = data.host;
  this.lastReqs = -1;
  this.playing = false;
  setInterval(this.poll.bind(this), Sonos.POLL_INTERVAL);
}
util.inherits(Sonos, EventEmitter);

Sonos.PORT = 1400;
Sonos.DSP_PATH = "/status/proc/driver/audio/dsp";
Sonos.POLL_INTERVAL = 3000;
Sonos.TRANSPORT_ENDPOINT = '/MediaRenderer/AVTransport/Control'

Sonos.prototype.fetchPage = function(host, port, path, resultHandler) {
  var request = http.request({
    port : port,
    host : host,
    path : path
  });
  request.on('error', function() {});
  request.addListener('response', function (response) {
    var data = '';
    response.addListener('data', function (chunk) {
      data += chunk;
    });
    response.addListener('end', function () {
      if (resultHandler) resultHandler(data);
    });
  });
  request.end();
};

Sonos.prototype.exec = function(command, data) {
  console.log("*  Sonos Executing: " + command);
  switch (command) {
    case "Play":
      this.play();
      break;
    case "Pause":
      this.pause();
      break;
    case "PlayPause":
      this.playPause();
      break;
  }
};

Sonos.prototype.sendCommand = function(action, body) { 
  var data = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>' + body + '</s:Body></s:Envelope>';
  var request = http.request({
    host : this.host,
    port : Sonos.PORT,
    path : Sonos.TRANSPORT_ENDPOINT,
    method : "POST",
    headers : {
      "Content-Length" : Buffer.byteLength(data, 'utf8'),
      "Content-Type" : "text/xml",
      "SOAPACTION" : action
    }
  });
  
  request.on('error', function() {});
  request.end(data);
}

Sonos.prototype.playPause = function() {
  if (this.playing)
    this.pause();
  else
    this.play();
}

Sonos.prototype.play = function() {
  var action = '"urn:schemas-upnp-org:service:AVTransport:1#Play"'
  var body = '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>'
  this.sendCommand(action, body)
};

Sonos.prototype.pause = function() {
  var action = '"urn:schemas-upnp-org:service:AVTransport:1#Pause"'
  var body = '<u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Pause>'
  this.sendCommand(action, body)
};

Sonos.prototype.poll = function () {
  this.fetchPage(this.host, Sonos.PORT, Sonos.DSP_PATH, this.handlePoll.bind(this));
};

Sonos.prototype.handlePoll = function (data) {
  var lines = data.split("\n");
  for (var i = 1; i < lines.length; i++) {
    if (lines[i - 1].substring(0, 5).toLowerCase() == 'reqs(') {
      var reqs = parseInt(lines[i].trim().split(":")[0]);
      this.newReqs(reqs);
      return;
    }
  }
};

Sonos.prototype.newReqs = function (reqs) {
  if (this.lastReqs == -1)
    console.log("Sonos Connected");
  else if (!this.playing && reqs != this.lastReqs) {
    this.playing = true;
    this.emit("DeviceEvent", "Started");
  } else if (this.playing && reqs == this.lastReqs) {
    this.playing = false;
    this.emit("DeviceEvent", "Stopped");
  }

  this.lastReqs = reqs;
};

exports.Sonos = Sonos;