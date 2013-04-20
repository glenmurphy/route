var EventEmitter = require('events').EventEmitter;
var http = require('http');
var url = require('url');
var util = require('util');
var xml2js = require('xml2js');
var os = require('os');

// see http://IP:1400/status/upnp for status
// subscription logs at http://IP:1400/status/opt/log/anacapa.trace

/* SONOS ------------------------------------------------------------------- */
function Sonos(data) {
  var ips = [];

  var ifaces = os.networkInterfaces();
  for (var dev in ifaces) {
    var alias = 0;
    for (var i in ifaces[dev]) {
      if (ifaces[dev][i].family == 'IPv4' && 
          ifaces[dev][i].address && 
          ifaces[dev][i].address != "127.0.0.1")
        ips.push(ifaces[dev][i].address);
    }
  }
  this.listenIp = data.listenIp || ips[0];
  this.listenPort = data.listenPort || 9000;

  this.server = http.createServer(this.handleReq.bind(this)).listen(this.listenPort);
  this.debug = true;//data.debug;

  this.components = data.components || { "Main" : this.host }; // Create a component list from a single host if needed
  this.defaultComponent = data.defaultComponent || "Main";
  for (var component in this.components) { // Instantiate components
    var newComponent = new SonosComponent({ name : component , host : this.components[component], system : this});
    this.components[component] = newComponent;
    newComponent.on("DeviceEvent", this.emit.bind(this, "DeviceEvent")); // reemit events
    newComponent.on("StateEvent", this.emit.bind(this, "StateEvent"));
  }

  for (var first in this.components) {
    this.components[first].getFavorites();
    break; // only run once
  }

  setTimeout(this.subscribeEvents.bind(this), 3000); // subscribe to events. Ideally this should be gated on UID fetching
  setInterval(this.subscribeEvents.bind(this), 59 * 60 * 1000); // Resubscribe every 59 minutes (1m overlap)
}
util.inherits(Sonos, EventEmitter);

Sonos.PORT = 1400;
Sonos.ENDPOINTS = {
  AVTransport : '/MediaRenderer/AVTransport/Control',
  RenderingControl : '/MediaRenderer/RenderingControl/Control',
  ContentDirectory : '/MediaServer/ContentDirectory/Control'
}

Sonos.SERVICES = [
  { "Service":"/MediaRenderer/RenderingControl/Event", "Description":"Render Control" },
  { "Service":"/MediaRenderer/AVTransport/Event", "Description":"Transport Event" },
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
  //{ "Service":"/MediaRenderer/ConnectionManager/Event", "Description":"Connection Manager" },
];

Sonos.prototype.exec = function(command, params) {
  if (!component) {
    var commandComponents = command.split(".");
    var component = commandComponents.shift();
    component = this.components[component];
    if (component) {
        command = commandComponents.join(".")
    } else {
      component = this.components[this.defaultComponent];
    }
  }

  console.log("*  Sonos Executing: " + command, component.name, params);

  // Reroute events to a coordinator if present
  if (component.coordinator) component = component.coordinator;

  switch (command) {
    case "Play":
      component.play();
      break;
    case "Pause":
      component.pause();
      break;
    case "PlayPause":
      component.playPause();
      break;
    case "Prev":
    case "Previous":
    case "PrevTrack":
      component.prevTrack();
      break;
    case "Next":
    case "NextTrack":
      component.nextTrack();
      break;
    case "TrackInfo":
      component.getTrackInfo();
      break;
    case "Spotify.ListenTo":
      component.playSpotifyTrack(params.string);
      break;
    case "PlayURI":
      component.playURI(params.uri, params.metadata);
      //this.play();
      break;
  }
};

Sonos.prototype.getComponentByID = function(id) {
  for (var c in this.components) {
    c = this.components[c];
    if (c.uid == id) return c;
  }
  return undefined;
};

// Notifications
Sonos.prototype.subscribeEvents = function() {
  for (var component in this.components) {
    for (var service in Sonos.SERVICES) {
      this.subscribeEvent(this.components[component].host, Sonos.SERVICES[service].Service, Sonos.SERVICES[service].Description);
    }
  };
};

Sonos.prototype.subscribeEvent = function(host, service, description) {
  //curl -X SUBSCRIBE -H "CALLBACK: <http://10.0.0.8:3000/callback>" -H "NT: upnp:event" -H "TIMEOUT: Second -3600" http://10.0.0.2:1400/MediaRenderer/AVTransport/Event -vvvvvvvv

  if (this.debug) console.log("* Sonos: Subscribed " + this.listenIp + " to " + host + " " + description);
  var request = http.request({
    host: host,
    port: Sonos.PORT,
    path: service,
    method: "SUBSCRIBE",
    headers : {
      "Cache-Control":"no-cache",
      "Pragma"       :"no-cache",
      //"USER-AGENT"   :"Linux UPnP/1.0 Sonos/16.7-48310 (PCDCR)",
      "CALLBACK"     :"<http://" + this.listenIp + ":" + this.listenPort + ">",
      "NT"           :"upnp:event",
      "TIMEOUT"      :"Second-3600"
    }
  });
  request.on('error', function() {});
  request.end();
};

Sonos.prototype.componentForIP = function(ip) {
  var match =  Object.keys(this.components).filter(function(key) {return this.components[key].host === ip}.bind(this)).shift();
  return this.components[match];
};

Sonos.prototype.handleReq = function(req, res) {
  var address = req.connection.remoteAddress;
  var component = this.componentForIP(address);
  component.handleReq(req,res);
};

Sonos.prototype.metadataForInfo = function (info) {
  return '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">'
  + '<item>'
  + '<dc:title>' + info.title+ '</dc:title>'
  + '<upnp:class>object.item.audioItem.musicTrack</upnp:class>'
  + '</item></DIDL-Lite>';
};


/**
 * 
 */
function SonosComponent(data) {
  this.name = data.name;
  this.host = data.host;
  this.volume = 0;
  this.deviceid = 1;
  this.system = data.system;
  this.getUID();
}
util.inherits(SonosComponent, EventEmitter);

SonosComponent.prototype.getUID = function() {
  var req = http.get({hostname: this.host, port: Sonos.PORT, path: '/status/zp'}, function(res) {
    res.on('data', function(data) {
      var parser = new xml2js.Parser();
        parser.parseString(data, function (err, result) {
        this.realName = result.ZPSupportInfo.ZPInfo[0].ZoneName[0];
        this.uid = result.ZPSupportInfo.ZPInfo[0].LocalUID[0];
      }.bind(this));
    }.bind(this));
  }.bind(this));
  req.on('error', function(e) {
    console.log('! Sonos', this.name, e.message);
  }.bind(this));
};

SonosComponent.prototype.callAction = function(service, action, arguments, device, callback) {
  var xmlns = "urn:schemas-upnp-org:service:" + service + ':' + device;

  var body = "<u:" + action + " xmlns:u=\"" + xmlns + "\">" ;
  for (var key in arguments) {
    body += "<" + key + ">" + arguments[key] + "</" + key + ">";
  }
  body += "</u:" + action + ">";

  var endpoint = Sonos.ENDPOINTS[service];
  this.sendCommand(endpoint, xmlns + '#' + action, body, callback);
};

SonosComponent.prototype.sendCommand = function(endpoint, action, body, callback) { 
  var data = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>' + body + '</s:Body></s:Envelope>';
  if (this.debug) console.log("> Sonos:", data);
  var request = http.request({
    host : this.host,
    port : Sonos.PORT,
    path : endpoint,
    method : "POST",
    headers : {
      "Content-Length" : Buffer.byteLength(data, 'utf8'),
      "Content-Type" : "text/xml",
      "SOAPACTION" : (action ? "\"" + action + "\"" : "")
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

SonosComponent.prototype.playSpotifyTrack = function (url, metadata) {
  var uri = "x-sonos-spotify:" + encodeURIComponent(url) + "?sid=12&amp;flags=0"
  console.log(uri);
  this.playURI(uri, metadata);
};

SonosComponent.prototype.isPlaying = function() {
  return this.player_state === "PLAYING";
};

SonosComponent.prototype.playPause = function() {
  this.isPlaying() ? this.pause() : this.play();
};

SonosComponent.prototype.play = function() {
  if (this.muteState) this.setMute(false);
  this.callAction("AVTransport", "Play", {InstanceID : 0, Speed : 1}, this.deviceid);
};

SonosComponent.prototype.pause = function() {
  this.callAction("AVTransport", "Pause", {InstanceID : 0}, this.deviceid);
};

SonosComponent.prototype.prevTrack = function() {
  this.callAction("AVTransport", "Previous", {InstanceID : 0}, this.deviceid);
};

SonosComponent.prototype.nextTrack = function() {
  this.callAction("AVTransport", "Next", {InstanceID : 0}, this.deviceid);
};

SonosComponent.prototype.removeAllTracksFromQueue = function(callback) {
   this.callAction("AVTransport", "RemoveAllTracksFromQueue", {InstanceID : 0}, this.deviceid, callback);
};

SonosComponent.prototype.addURIToQueue = function(uri, metadata, callback) {
  this.callAction("AVTransport", "AddURIToQueue", {
      InstanceID : 0,
      EnqueuedURI: uri,
      EnqueuedURIMetaData: encodeHTML(metadata || ""),
      DesiredFirstTrackNumberEnqueued : 0,
      EnqueueAsNext: 0
    }, this.deviceid, callback);
};

SonosComponent.prototype.playQueue = function(uri, callback) {
  var uri = "x-rincon-queue:" + this.uid + "#0";
  this.playURI(uri, null, callback);
};

SonosComponent.prototype.setPlayMode = function(mode, callback) { // NORMAL, REPEAT_ALL, SHUFFLE, SHUFFLE_NOREPEAT
  this.callAction("AVTransport", "SetPlayMode", {InstanceID : 0, NewPlayMode : mode}, this.deviceid, callback);
};

SonosComponent.prototype.becomeStandalone = function () {
  this.callAction("AVTransport", "BecomeCoordinatorOfStandaloneGroup", {InstanceID : 0}, this.deviceid);
};

SonosComponent.prototype.addGroupMember = function (newComponent) {
  newComponent.setCurrentURI("x-rincon:" + this.uid);
};

SonosComponent.prototype.removeGroupMember = function (newComponent) {
  newComponent.becomeStandalone();
};

SonosComponent.prototype.playFavorite = function(name) {
  for (var f in this.system.favorites) {
    f = this.system.favorites[f];
    if (f.name == name || f.url == name) {
      console.log("matched ", f);
      this.playURI(f.url, f.urlMetadata);
      return;
    }
  }
  console.log("! Sonos: Favorite not found", name);
};

SonosComponent.prototype.setCurrentURI = function(uri, metadata, callback) {
  this.callAction("AVTransport", "SetAVTransportURI",
    {InstanceID : 0, CurrentURI : encodeHTML(uri), CurrentURIMetaData : encodeHTML(metadata || "")}, this.deviceid, callback);
};

SonosComponent.prototype.playURI = function(uri, metadata, callback) {
  if (uri.indexOf("x-rincon-cpcontainer:") == 0) {
    this.queueContainerURI(uri, metadata, callback);
  } else {
    this.setCurrentURI(uri, metadata, function(resp) {
      var parser = new xml2js.Parser();
        parser.parseString(resp, function (err, result) {
        console.log("RESPONSE: " + resp);
        this.play();
      }.bind(this));
    }.bind(this));
  }
};

SonosComponent.prototype.queueContainerURI = function(uri, metadata, callback) {
  this.removeAllTracksFromQueue(function() {
    this.addURIToQueue(uri, metadata, function() {
      this.playQueue();
    }.bind(this));
  }.bind(this));
};

SonosComponent.prototype.getVolume = function(callback) {
  this.callAction("RenderingControl", "GetVolume", {InstanceID : 0, Channel : "Master"}, this.deviceid,
    function (data) {
      var tmp = data.substring(data.indexOf('<CurrentVolume>') + '<CurrentVolume>'.length);
      var volume = tmp.substring(0, tmp.indexOf('<'));
      this.volume = volume;
      if (callback) {
        callback(volume);
      }
    });
};

SonosComponent.prototype.setVolume = function(volume) {
  this.volume = volume;
  this.callAction("RenderingControl", "SetVolume", {DesiredVolume : volume, InstanceID : 0, Channel : "Master"}, this.deviceid);
};

SonosComponent.prototype.setMute = function(flag) { // NORMAL, REPEAT_ALL, SHUFFLE, SHUFFLE_NOREPEAT
  this.callAction("RenderingControl", "SetMute", {DesiredMute : flag, InstanceID : 0, Channel : "Master"}, this.deviceid);
};

SonosComponent.prototype.getFavorites = function(callback) {
  this.callAction("ContentDirectory", "Browse", {
      ObjectID : "FV:2",
      BrowseFlag : "BrowseDirectChildren",
      Filter : "dc:title,res,dc:creator,upnp:artist,upnp:album,upnp:albumArtURI",
      StartingIndex : 0,
      RequestedCount : 100,
      SortCriteria : ""
    }, this.deviceid, function (data) {
      try {
        var parser = new xml2js.Parser();
        parser.parseString(data, function (err, result) {
          var trackInfo = result["s:Envelope"]["s:Body"][0]["u:BrowseResponse"][0];
          parser.parseString(trackInfo.Result[0], function (err, result) {
            var results = result["DIDL-Lite"].item;
            var favorites = []
            for (var i = 0; i < results.length; i++) {
              var meta = results[i];
              var favoriteInfo = {
                name : meta["dc:title"][0],
                description : meta["r:description"][0],
                type : meta["r:type"][0],
                url : meta.res[0]._,
                urlMetadata : meta["r:resMD"][0],
                // Artwork : url.resolve("http://" + this.host + ":" + Sonos.PORT, meta["upnp:albumArtURI"][0])
              };
              favorites.push(favoriteInfo);
            };
            this.system.favorites = favorites;
            this.emit("StateEvent", {"sonosFavorites" : favorites});
          }.bind(this));
        }.bind(this));
      } catch (e) {
        if (this.debug) console.log("! Sonos favorites", e, data)
      }
    }.bind(this));
};

SonosComponent.prototype.handleReq = function(req, res) {
  var data = '';
  req.on('data', function(chunk) {
    data += chunk;
  });
  req.on('end', function() {
    this.parseNotification(data);
    res.writeHead(200);
    res.end();
  }.bind(this));
  req.on('readable', function(waa) {
    req.read();
  });
};

SonosComponent.prototype.parseXMStreamContent = function (string) {
  var record = {};
  if (!string) return record;
  var fields = string.split("|");
  for (var i = 0; i < fields.length; i++) {
    var namesplit = fields[i].indexOf(" ");
    record[fields[i].substring(0,namesplit).toLowerCase()] = fields[i].substring(namesplit);
  }
  return record;
}

SonosComponent.prototype.parseMetadata = function (metadata, callback) {
  var parser = new xml2js.Parser();
  parser.parseString(metadata, function (err, result) {
    if (!result) return;

    var metaInfo = {};
    var meta = result["DIDL-Lite"]["item"][0];
    if (this.debug) console.log("metadata", meta);
    var streamcontent = xmlValue(meta, "r:streamContent");
    streamcontent = this.parseXMStreamContent(streamcontent);
    metaInfo.name =  streamcontent.title || xmlValue(meta, "dc:title");
    metaInfo.artist = streamcontent.artist || xmlValue(meta, "dc:creator");
    metaInfo.album = xmlValue(meta, "upnp:album");
    if (xmlValue(meta, "upnp:albumArtURI")) metaInfo.artwork = url.resolve("http://" + this.host + ":" + Sonos.PORT, xmlValue(meta, "upnp:albumArtURI"));
    
    callback(metaInfo);
  }.bind(this));
};

SonosComponent.prototype.updatePlayingState = function(state) {
  if (this.playingState == state) return;

  this.emit("DeviceEvent", this.name + (state == "PLAYING" ? ".Started" : ".Stopped"));
  this.emit("DeviceEvent", this.name + ".PlayingState", { state : state });
  this.playingState = state;
};

SonosComponent.prototype.updateTrackInfo = function(details) {
  this.emit("DeviceEvent", this.name + ".TrackInfo", details);
};

SonosComponent.prototype.updateNextTrackInfo = function(details) {
  this.emit("DeviceEvent", this.name + ".NextTrackInfo", details);
};

SonosComponent.prototype.parseNotification = function (data) {
  try {
    var parser = new xml2js.Parser();
    parser.parseString(data, function (err, result) {
      if (!result) return;

      var eventInfo = result["e:propertyset"]["e:property"][0].LastChange[0];
      parser.parseString(eventInfo, function (err, result) {
        var playerInfo = {};
        var status = result.Event.InstanceID[0];
        for (var key in status) {
          if (key == "$") continue
          try {
            var val = status[key][0].$.val;
          } catch (e) {}

          switch (key) {
            case "TransportState":
              this.updatePlayingState(val);
              break;
            case "CurrentTrackURI":
              playerInfo.TrackURI = val;
              if (val.indexOf("x-rincon:") == 0) {
                var id = val.split("x-rincon:").pop();
                this.coordinator = this.system.getComponentByID(id);
                if (this.coordinator) playerInfo.GroupCoordinator = this.coordinator.name;
              } else {
                delete this.coordinator;
                playerInfo.GroupCoordinator = "";
              }
              break;
            case "CurrentTrackMetaData":
              this.parseMetadata(val, this.updateTrackInfo.bind(this));
              break;
            case "r:NextTrackURI":
              playerInfo.NextTrackURI = val;
              break;
            case "r:NextTrackMetaData":
              this.parseMetadata(val, this.updateNextTrackInfo.bind(this));
              break;
            case "Mute":
              var muteState = this.muteState;
              if (undefined != muteState &&  muteState != val) {
                this.emit("DeviceEvent", this.name + (val == "1" ? ".Muted" : ".Unmuted"));
              }
              this.muteState = val;

              break;
            default:
              //console.log(key, status[key]);
              break;
          }
        }
        var state = {};
        for (var key in playerInfo) {
          state["sonos." + this.name + "." + key] = playerInfo[key];
        }
        this.emit("StateEvent", state);
      }.bind(this));
    }.bind(this));
  } catch (e) {
    console.log("Sonos: parse error" + e, e.stack);
  } 
};

function xmlValue(element, key) {
  try {
    var value = element[key][0];
    if (undefined == (value.substring)) value = undefined;
    return value;
  } catch (e) {
    return undefined;
  }
}

function encodeHTML(string) {
  return string.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
}

exports.Sonos = Sonos;
