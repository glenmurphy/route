var EventEmitter = require('events').EventEmitter;
var http = require('http');
var url = require('url');
var util = require('util');
var xml2js = require('xml2js');

/* SONOS ------------------------------------------------------------------- */
function Sonos(data) {
  this.server = http.createServer(this.handleReq.bind(this)).listen(9000);
  this.host = data.host;
  this.lastReqs = -1;
  this.playing = false;
  this.volume = 0;
  this.services = [
      //{ "Service": "/ZoneGroupTopology/Event", "Description": "Zone Group" }, // The service notifications we want to subscribe to
      //{ "Service": "/MediaRenderer/AVTransport/Event", "Description": "Transport Event" },
      //{ "Service": "/MediaServer/ContentDirectory/Event", "Description": "Content Directory" },
      //{ "Service": "/MediaRenderer/RenderingControl/Event", "Description": "Render Control" }
      //{ "Service":"/AlarmClock/Event", "Description":"Alarm Clock" },
      //{ "Service":"/MusicServices/Event", "Description":"Music Services" },
      //{ "Service":"/AudioIn/Event", "Description":"Audio In" },
      //{ "Service":"/DeviceProperties/Event", "Description":"Device Properties" },
      //{ "Service":"/SystemProperties/Event", "Description":"System Properties" },
      //{ "Service":"/ZoneGroupTopology/Event", "Description":"Zone Group" },
      //{ "Service":"/GroupManagement/Event", "Description":"Group Management" },
      //{ "Service":"/MediaServer/ContentDirectory/Event", "Description":"Content Directory" },
      //{ "Service":"/MediaRenderer/RenderingControl/Event", "Description":"Render Control" },
      //{ "Service":"/MediaRenderer/ConnectionManager/Event", "Description":"Connection Manager" },
      { "Service":"/MediaRenderer/AVTransport/Event", "Description":"Transport Event" }
    ];

  this.subscribeEvents();

  setInterval(this.poll.bind(this), Sonos.POLL_INTERVAL);
  //setInterval(this.getTrackInfo.bind(this), 10000);
  //this.queueURI("x-sonos-spotify:spotify%3atrack%3a0xFomAiFsu5qCnLM0hu0UR?sid=12&flags=0");
}
util.inherits(Sonos, EventEmitter);

Sonos.PORT = 1400;
Sonos.DSP_PATH = "/status/proc/driver/audio/dsp";
Sonos.POLL_INTERVAL = 3000;
Sonos.TRANSPORT_ENDPOINT = '/MediaRenderer/AVTransport/Control';
Sonos.RENDERING_ENDPOINT = '/MediaRenderer/RenderingControl/Control';

Sonos.prototype.handleReq = function(req, res) {
  var info = url.parse(req.url, true);
  console.log(info);

  var path = '/notify';
  if (info.pathname.indexOf(path) == 0) {
      res.writeHead(200);
      res.end();

      var data = '';
      req.on('data', function(chunk) {
        data += chunk;
      }).on('end', function() {
        console.log('data: %s', data);
      });
    }
};

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
    case "Prev":
      this.previous();
      break;
    case "Next":
      this.next();
      break;
    case "TrackInfo":
      this.getTrackInfo();
      break;
  }
};

Sonos.prototype.sendCommand = function(endpoint, action, body, callback) { 
  var data = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>' + body + '</s:Body></s:Envelope>';
  var request = http.request({
    host : this.host,
    port : Sonos.PORT,
    path : endpoint,
    method : "POST",
    headers : {
      "Content-Length" : Buffer.byteLength(data, 'utf8'),
      "Content-Type" : "text/xml",
      "SOAPACTION" : action
    }
    }, function(response){
      var data = '';
      response.on('data', function (chunk) {
        data += chunk;
      });
      response.on('end', function () {
        if (callback) {
          callback(data);
        }
      });
    });
  
  request.on('error', function() {});
  request.end(data);
};

Sonos.prototype.playPause = function() {
  if (this.playing)
    this.pause();
  else
    this.play();
}

Sonos.prototype.play = function() {
  var action = '"urn:schemas-upnp-org:service:AVTransport:1#Play"'
  var body = '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>'
  this.sendCommand(Sonos.TRANSPORT_ENDPOINT, action, body);
};

Sonos.prototype.queueURI = function(uri) {
  var action = '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"'
  var body = '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><CurrentURI>' + uri + '</CurrentURI><CurrentURIMetaData></CurrentURIMetaData></u:SetAVTransportURI>';  
  this.sendCommand(Sonos.TRANSPORT_ENDPOINT, action, body, function (err) {
console.log("err " + err);
  }.bind(this));
};


Sonos.prototype.pause = function() {
  var action = '"urn:schemas-upnp-org:service:AVTransport:1#Pause"'
  var body = '<u:Pause xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Pause>'
  this.sendCommand(Sonos.TRANSPORT_ENDPOINT, action, body);
};

Sonos.prototype.previous = function() {
  var action = '"urn:schemas-upnp-org:service:AVTransport:1#Previous"'
  var body = '<u:Previous xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Previous>'
  this.sendCommand(Sonos.TRANSPORT_ENDPOINT, action, body, function () {
    this.getTrackInfo();
  }.bind(this));
};

Sonos.prototype.next = function() {
  var action = '"urn:schemas-upnp-org:service:AVTransport:1#Next"'
  var body = '<u:Next xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Next>'
  this.sendCommand(Sonos.TRANSPORT_ENDPOINT, action, body, function () {
    this.getTrackInfo();
  }.bind(this));
};

Sonos.prototype.getVolume = function(callback) {
  var action = '"urn:schemas-upnp-org:service:RenderingControl:1#GetVolume"';
  var body = '<u:GetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel></u:GetVolume>';

  this.sendCommand(Sonos.RENDERING_ENDPOINT, action, body, function(data){
    var tmp = data.substring(data.indexOf('<CurrentVolume>') + '<CurrentVolume>'.length);
    var volume = tmp.substring(0, tmp.indexOf('<'));
    
    this.volume = volume;

    if (callback) {
      callback(volume);
    }
  });
};

Sonos.prototype.setVolume = function(volume) {
  //SHOULD PROBABLY DO THIS IN A CALLBACK
  this.volume = volume;

  var action = '"urn:schemas-upnp-org:service:RenderingControl:1#SetVolume"';
  var body = '<u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"><InstanceID>0</InstanceID><Channel>Master</Channel><DesiredVolume>' + volume.toString() + '</DesiredVolume></u:SetVolume>';
  this.sendCommand(Sonos.RENDERING_ENDPOINT, action, body);
};

Sonos.prototype.getTrackInfo = function() {
  var action = '"urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo"';
  var body = '<u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:GetPositionInfo>';
  this.sendCommand(Sonos.TRANSPORT_ENDPOINT, action, body, function(data){
    console.log(data);
    var parser = new xml2js.Parser();
    parser.parseString(data, function (err, result) {
      var trackInfo = result["s:Envelope"]["s:Body"][0]["u:GetPositionInfoResponse"][0];
      var trackURL = trackInfo.TrackURI[0];
      console.log(trackInfo);
      parser.parseString(trackInfo.TrackMetaData, function (err, meta) {
        if (meta) {
          meta = meta["DIDL-Lite"]["item"][0];
          var playerInfo = {
            "Player State" : "Playing",
            Name : meta["dc:title"][0],
            Artist : meta["dc:creator"][0],
            Album : meta["upnp:album"][0],
            Artwork : "http://" + this.host + ":" + Sonos.PORT + meta["upnp:albumArtURI"][0]
          };
          this.emit("StateEvent", {"sonos" : playerInfo});
        }
      }.bind(this));
    }.bind(this));
  }.bind(this));
};

Sonos.prototype.subscribeEvents = function() {
  for (var service in this.services) {
    this.subscribeEvent(this.services[service].Service, this.services[service].Description);
  }
};

Sonos.prototype.subscribeEvent = function(service, description) {
  //curl -X SUBSCRIBE -H "CALLBACK: <http://10.0.0.8:3000/callback>" -H "NT: upnp:event" -H "TIMEOUT: Second -3600" http://10.0.0.2:1400/MediaRenderer/AVTransport/Event -vvvvvvvv
  //var data = "http://" + host + ":" + Sonos.PORT + service;

  var request = http.request({
    host: this.host,
    port: Sonos.PORT,
    path: service,
    method: "SUBSCRIBE",
    headers : {
      "Cache-Control":"no-cache",
      "Pragma"       :"no-cache",
      //"USER-AGENT"   :"Linux UPnP/1.0 Sonos/16.7-48310 (PCDCR)",
      "CALLBACK"     :"<http://10.0.0.6:9000/notify>",
      "NT"           :"upnp:event",
      "TIMEOUT"      :"Second-1800"
    }
  });
  request.on('error', function() {});
  request.end();
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
  if (this.lastReqs == -1) {
    console.log("Sonos Connected");
  } else if (!this.playing && reqs != this.lastReqs) {
    this.playing = true;
    this.emit("DeviceEvent", "Started");
  } else if (this.playing && reqs == this.lastReqs) {
    this.playing = false;
    this.emit("DeviceEvent", "Stopped");
  }

  this.lastReqs = reqs;
};

exports.Sonos = Sonos;