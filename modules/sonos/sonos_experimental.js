var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var request = require('request');
var url = require('url');
var util = require('util');
var xml2js = require('xml2js');
var os = require('os');
var fs = require('fs');
var gm = require('gm');
var im = gm.subClass({ imageMagick: true });

try { // SSDP is optional. If present, will scan.
  var ssdp = require('node-ssdp');
} catch (e) {}

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
  this.cacheArtwork = data.cacheArtwork;
  this.debug = data.debug;
  this.replaceSpotifyArtwork = data.replaceSpotifyArtwork || true;
  this.spotifyAccountId = data.spotifyAccountId;
  this.spotifySid = data.spotifySid;
  this.spotifyArtworkPrefix = data.spotifyArtworkPrefix;

  if (!(data.components) && this.host) data.components = { "Main" : this.host }
  // Create a component list from a single host if needed
  this.defaultComponent = data.defaultComponent || "Main";

  this.components = {};
  this.discoveredIps = [];
  this.componentsByIp = {};

  for (var componentName in data.components) { // Instantiate components
    var host = data.components[componentName];
    this.createComponent(host, componentName);
    this.discoveredIps.push(host);
  }

  if (!data.components) 
    this.scanforComponents();

}
util.inherits(Sonos, EventEmitter);

Sonos.PORT = 1400;
Sonos.ENDPOINTS = {
  AVTransport : '/MediaRenderer/AVTransport/Control',
  RenderingControl : '/MediaRenderer/RenderingControl/Control',
  ContentDirectory : '/MediaServer/ContentDirectory/Control'
};

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

Sonos.prototype.createComponent =  function (host, name) {
  var info = {host : host, system : this, debug: this.debug};
  new SonosComponent(info, function(component, error) {
    if (!error) {
      var id = name || component.realName;
      id = id.replace(" ","") // remove spaces for the ID version of the name
      component.name = id;
      this.addComponent(component, id);
  
      if (id)
        console.log("*  Discovered Sonos:", '"' + id + '"', ":", '"' + host + '",' );

    } else {
      console.log("Could not add component:", host, error);
    }
  }.bind(this));
}

Sonos.prototype.addComponent = function(component, id) {
  this.components[id] = component;
  this.componentsByIp[component.host] = component;
  component.on("DeviceEvent", this.emit.bind(this, "DeviceEvent")); // reemit events
  component.on("StateEvent", this.emit.bind(this, "StateEvent"));

  if (!this.gotFavorites) {
    component.getFavorites();
    this.gotFavorites = true;
  }
  this.subscribeToComponentEvents(component);
}

Sonos.PLAYER_UPNP_URN = 'urn:schemas-upnp-org:device:ZonePlayer:1';
Sonos.prototype.scanforComponents = function() {
  if (!ssdp) return;
  var client = new ssdp.Client();
  var timeout;
  client.on('response', function (headers, statusCode, rinfo) {
    var host = rinfo.address;
    if (this.discoveredIps.indexOf(host) == -1) {
      this.discoveredIps.push(host);
      if (headers["ST"] != Sonos.PLAYER_UPNP_URN) return;     
      if (!headers["LOCATION"]) return;
      this.createComponent(host);
    }
  }.bind(this));

  // search periodcally
  function scanDevices() {
    if (this.debug) console.log("Scanning for sonos");
    client.search(Sonos.PLAYER_UPNP_URN);
    clearTimeout(timeout);
    // timeout = setTimeout(scanDevices, 5 * 60 * 1000);
  }
  scanDevices()
}

Sonos.prototype.exec = function(command, params) {
  var commandComponents = command.split(".");
  var component = commandComponents.shift();
  component = this.components[component];
  if (component) {
    command = commandComponents.join(".");
  } else {
    component = this.components[this.defaultComponent];
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
    case "Mute":
      component.setMute(true);
      break;
    case "Unmute":
      component.setMute(false);
      break;
    case "SetVolume":
      component.setVolume(params.value);
      break;
    case "AdjustVolume":
      component.adjustVolume(parseInt(params.delta));
      break;
    case "VolumeUp":
      component.adjustVolume(2);
      break;
    case "VolumeDown":
      component.adjustVolume(-1);
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
// Sonos.prototype.subscribeEvents = function() {
//   for (var componentName in this.components) {
//     var component = this.components[componentName];
//     this.subscribeToComponentEvents(component);
//   }
// };
Sonos.prototype.subscribeToComponentEvents = function(component) {
  component.initializing = 0;
  for (var service in Sonos.SERVICES) {
    component.initializing++;
    this.subscribeEvent(component.host, Sonos.SERVICES[service].Service, Sonos.SERVICES[service].Description);
  }
  setTimeout(this.subscribeToComponentEvents.bind(this, component), 59 * 60 * 1000); // Resubscribe every 59 minutes (1m overlap)
};

Sonos.prototype.subscribeEvent = function(host, service, description) {
  //curl -X SUBSCRIBE -H "CALLBACK: <http://10.0.0.8:3000/callback>" -H "NT: upnp:event" -H "TIMEOUT: Second -3600" http://10.0.0.2:1400/MediaRenderer/AVTransport/Event -vvvvvvvv

  if (this.debug) console.log("*  Sonos: Subscribed " + this.listenIp + " to " + host + " " + description);
  var request = http.request({
    host: host,
    port: Sonos.PORT,
    path: service,
    method: "SUBSCRIBE",
    headers : {
      "Cache-Control":"no-cache",
      "Pragma"       :"no-cache",
      //"USER-AGENT"   :"Linux UPnP/1.0 Sonos/16.7-48310 (PCDCR)",
      "CALLBACK"     :"<http://" + this.listenIp + ":" + this.listenPort + service + ">",
      "NT"           :"upnp:event",
      "TIMEOUT"      :"Second-3600"
    }
  });
  request.on('error', function() {});
  request.end();
};

Sonos.prototype.componentForIP = function(ip) {
  if (ip.indexOf("::ffff:") == 0) {
    ip = ip.substr("::ffff:".length);
  }
  var match =  Object.keys(this.components).filter(function(key) {return this.components[key].host === ip;}.bind(this)).shift();
  return this.components[match];
};

Sonos.prototype.handleReq = function(req, res) {
  var info = url.parse(req.url, true);
  if ((info.pathname == "/artwork.jpg") || (info.pathname == "/artwork-blur.jpg") ) { 
    var artworkPath = os.tmpdir() + info.pathname;
    if (fs.existsSync(artworkPath)) {
      res.writeHead(200, {'Content-Type': "image/jpeg"});
      fs.createReadStream(artworkPath).pipe(res);
    } else {
      console.log("no");
      res.end();
    }
  } else {
    var ip = req.connection.remoteAddress;
    if (ip.indexOf("::ffff:") == 0) {
      ip = ip.substr("::ffff:".length);
    }
    var component = this.componentsByIp[ip];
    if (component) component.handleReq(req,res);
  }

};

Sonos.prototype.metadataForInfo = function (info) {
  // This only currently works for spotify uris
  var metadata = '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">';
  metadata += '<item id="00030000' + encodeURIComponent(info.uri) + '" parentID="-1" restricted="true">';
  metadata += '<dc:title>' + info.title + '</dc:title>';
  metadata += '<upnp:class>object.item.audioItem.musicTrack</upnp:class>';
  metadata += '<desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">' + this.spotifyAccountId + '</desc>';
  metadata += '</item></DIDL-Lite>';
  return metadata;
};

Sonos.prototype.sonosURIForSpotifyURI = function (uri) {
  return "x-sonos-spotify:" + encodeURIComponent(uri) + "?sid=" + this.spotifySid + "&amp;flags=0";
};


/**
 *  Sonos Component
 */

function SonosComponent(data, initCallback) {
  this.name = data.name;
  this.host = data.host;
  this.volume = 0;
  this.deviceid = 1;
  this.system = data.system;
  this.getUID(initCallback);
  this.debug = data.debug;
}
util.inherits(SonosComponent, EventEmitter);

SonosComponent.prototype.getUID = function(initCallback) {
  var req = http.get({hostname: this.host, port: Sonos.PORT, path: '/status/zp'}, function(res) {
    res.on('data', function(data) {
      var parser = new xml2js.Parser();
      parser.parseString(data, function (err, result) {
        this.realName = result.ZPSupportInfo.ZPInfo[0].ZoneName[0];
        this.uid = result.ZPSupportInfo.ZPInfo[0].LocalUID[0];
        if (initCallback) initCallback(this, null);
      }.bind(this));
    }.bind(this));
  }.bind(this));
  req.on('error', function(e) {
    if (initCallback) initCallback(this, e);
    console.log('!  Sonos', this.name, e.message);
  }.bind(this));
};

SonosComponent.prototype.callAction = function(service, action, args, device, callback) {
  var xmlns = "urn:schemas-upnp-org:service:" + service + ':' + device;

  var body = "<u:" + action + " xmlns:u=\"" + xmlns + "\">" ;
  for (var key in args) {
    body += "<" + key + ">" + args[key] + "</" + key + ">";
  }
  body += "</u:" + action + ">";

  var endpoint = Sonos.ENDPOINTS[service];
  this.sendCommand(endpoint, xmlns + '#' + action, body, callback);
};

SonosComponent.prototype.sendCommand = function(endpoint, action, body, callback) { 
  var data = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>' + body + '</s:Body></s:Envelope>';
  if (this.debug) console.log(" > Sonos:", data);
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
      if (this.debug) console.log(" < Sonos:", data);
      if (callback) {
        callback(data);
      }
    }.bind(this));
  });
  
  request.on('error', function() {});
  request.end(data);
};

SonosComponent.prototype.isPlaying = function() {
  return this.playerState === "PLAYING";
};

SonosComponent.prototype.playPause = function() {
  if (this.isPlaying()) {
    this.pause();
  } else {
    this.play();
  }
};

SonosComponent.prototype.play = function(callback) {
  if (this.muteState) this.setMute(false);
  this.callAction("AVTransport", "Play", {InstanceID : 0, Speed : 1}, this.deviceid, callback);
};

SonosComponent.prototype.pause = function(callback) {
  this.callAction("AVTransport", "Pause", {InstanceID : 0}, this.deviceid, callback);
};

SonosComponent.prototype.prevTrack = function(callback) {
  this.callAction("AVTransport", "Previous", {InstanceID : 0}, this.deviceid, callback);
};

SonosComponent.prototype.nextTrack = function(callback) {
  var target = this.coordinator || this;
  target.callAction("AVTransport", "Next", {InstanceID : 0}, this.deviceid, callback);
};

SonosComponent.prototype.removeAllTracksFromQueue = function(callback) {
  this.callAction("AVTransport", "RemoveAllTracksFromQueue", {InstanceID : 0}, this.deviceid, callback);
};

SonosComponent.prototype.playSpotifyTrack = function (uri, metadata, callback) {
  uri = this.system.sonosURIForSpotifyURI(uri);
  this.playURI(uri, metadata, callback);
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

SonosComponent.prototype.playQueue = function(callback) {
  var uri = "x-rincon-queue:" + this.uid + "#0";
  this.playURI(uri, null, callback);
};

SonosComponent.prototype.setPlayMode = function(mode, callback) { // NORMAL, REPEAT_ALL, SHUFFLE, SHUFFLE_NOREPEAT
  console.log("*  Sonos " + this.name, "set play mode:", mode);
  this.callAction("AVTransport", "SetPlayMode", {InstanceID : 0, NewPlayMode : mode}, this.deviceid, callback);
};

SonosComponent.prototype.seek = function(time, callback) {
  var date = new Date(time * 1000);
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();
  if (minutes < 10) minutes = "0" + minutes;
  if (seconds < 10) seconds = "0" + seconds;

  timeString =  [hours, minutes, seconds].join(":");
  this.callAction("AVTransport", "Seek", {InstanceID : 0, Unit : "REL_TIME", Target: timeString}, this.deviceid, callback);
};


SonosComponent.prototype.becomeStandalone = function (callback) {
  this.callAction("AVTransport", "BecomeCoordinatorOfStandaloneGroup", {InstanceID : 0}, this.deviceid, callback);
};

SonosComponent.prototype.joinGroup = function (component, callback) {
  var groupId = component.coordinator || component.uid;
  this.setCurrentURI("x-rincon:" + component.uid, undefined, callback);
};

SonosComponent.prototype.addGroupMember = function (newComponent, callback) {
  newComponent.joinGroup(this, callback);
};

SonosComponent.prototype.removeGroupMember = function (newComponent, callback) {
  newComponent.becomeStandalone(callback);
};

SonosComponent.prototype.playFavorite = function(name, callback) {
  for (var f in this.system.favorites) {
    f = this.system.favorites[f];
    if (f.name == name || f.url == name) {
      this.playURI(f.url, f.urlMetadata, callback);
      return;
    }
  }
  console.log("!  Sonos: Favorite not found", name);
};

SonosComponent.prototype.setCurrentURI = function(uri, metadata, callback) {
  this.callAction("AVTransport", "SetAVTransportURI",
    {InstanceID : 0, CurrentURI : encodeHTML(uri), CurrentURIMetaData : encodeHTML(metadata || "")}, this.deviceid, callback);
};

SonosComponent.prototype.playURI = function(uri, metadata, callback) {
  if (uri.indexOf("x-rincon-cpcontainer:") === 0) {
    this.setPlayMode("SHUFFLE");
    this.queueContainerURI(uri, metadata, callback);
  } else {
    this.setCurrentURI(uri, metadata, function(resp) {
      var parser = new xml2js.Parser();
      parser.parseString(resp, function (err, result) {
        //console.log("RESPONSE: " + resp);
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

SonosComponent.prototype.playMultipleTracksWithInfo = function(infos, callback) {
  var uris = [], metadatas = [];
  for (var i = 0; i < infos.length; i++) {
    var info = infos[i];
    var uri = info.uri;
    var metadata = this.system.metadataForInfo(info);
    if (uri && metadata) {
      uris.push(uri);
      metadatas.push(metadata);
      if (i==20) break;
    }
  }
  this.playMultipleURIs(uris, metadatas, callback);
};

SonosComponent.prototype.playMultipleURIs = function(uris, metadatas, callback) {
  this.removeAllTracksFromQueue(function() {
    this.addMultipleURIsToQueueIndividually(uris, metadatas, function (response) {
      this.playQueue();
    }.bind(this));   
  }.bind(this));
};

SonosComponent.prototype.addMultipleURIsToQueue = function(uris, metadatas, callback) {
  uris = uris.map(function(uri) {
    if (uri.indexOf("spotify:") === 0) uri = this.system.sonosURIForSpotifyURI(uri);
    return uri;
  }.bind(this));

  this.addURIToQueue();
  console.log(uris, metadatas);
  this.callAction("AVTransport", "AddMultipleURIsToQueue",
    { InstanceID : 0,
      UpdateID : 0,
      NumberOfURIs : uris.length,
      EnqueuedURIs : uris.join(" "),
      EnqueuedURIsMetaData : encodeHTML(metadatas.join(" ")),
      ContainerURI : "",
      ContainerMetaData : "",
      DesiredFirstTrackNumberEnqueued : 0,
      EnqueueAsNext : 0
    }, this.deviceid, callback);
};

SonosComponent.prototype.addMultipleURIsToQueueIndividually = function(uris, metadatas, firstCallback, lastCallback) {
  uris = uris.map(function(uri) {
    if (uri.indexOf("spotify:") === 0) uri = this.system.sonosURIForSpotifyURI(uri);
    return uri;
  }.bind(this));

  this.urisToQueue = uris;
  this.metadatasToQueue = metadatas;
  this.queueFirstCallback = firstCallback;
  this.queueLastCallback = lastCallback;
  this.queueNextTrack(true);
};

SonosComponent.prototype.queueNextTrack = function(first) {
  var uri = this.urisToQueue.shift();
  var metadata = this.metadatasToQueue.shift();
  this.addURIToQueue(uri, metadata, function(response){
    //console.log("response: ", this.urisToQueue.length, response);
    if (first && this.queueFirstCallback) this.queueFirstCallback();
    if (this.urisToQueue.length) {
      this.queueNextTrack();
    } else {
      if (this.queueLastCallback) this.queueLastCallback();
    }
  }.bind(this));
};

SonosComponent.prototype.getVolume = function(callback) {
  this.callAction("RenderingControl", "GetVolume", {InstanceID : 0, Channel : "Master"}, this.deviceid,
    function (data) {
      var tmp = data.substring(data.indexOf('<CurrentVolume>') + '<CurrentVolume>'.length);
      var volume = parseInt(tmp.substring(0, tmp.indexOf('<')));
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

SonosComponent.prototype.adjustVolume = function(delta) {
  this.getVolume(function (volume) {
    console.log(volume, delta, volume+delta);
    this.setVolume(volume + delta);
  }.bind(this));
};

SonosComponent.prototype.setMute = function(flag) {
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
            var favorites = [];
            for (var i = 0; i < results.length; i++) {
              var meta = results[i];
              var albumURI = meta["upnp:albumArtURI"] ? url.resolve("http://" + this.host + ":" + Sonos.PORT, meta["upnp:albumArtURI"][0]) : undefined;

              var favoriteInfo = {
                name : meta["dc:title"][0],
                description : meta["r:description"][0],
                type : meta["r:type"][0],
                url : meta.res[0]._,
                urlMetadata : meta["r:resMD"][0],
                artwork : albumURI
              };
              favorites.push(favoriteInfo);
            };
            this.system.favorites = favorites;
            this.emit("StateEvent", {"sonosFavorites" : favorites});
          }.bind(this));
        }.bind(this));
      } catch (e) {
        //if (this.debug) 
          console.log("!  Sonos favorites", e, data)
      }
    }.bind(this));
};

SonosComponent.prototype.handleReq = function(req, res) {
  req.on('data', function(chunk) { req.data = (req.data || "") + chunk;});
  req.on('end', function() {
    this.parseNotification(req.data, req.url);
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
};

SonosComponent.prototype.parseMetadata = function (metadata, callback) {
  var parser = new xml2js.Parser();
  parser.parseString(metadata, function (err, result) {
    if (!result) return;

    var metaInfo = {};
    var meta = result["DIDL-Lite"]["item"][0];
    var streamcontent = xmlValue(meta, "r:streamContent");
    streamcontent = this.parseXMStreamContent(streamcontent);
    metaInfo.name =  streamcontent.title || xmlValue(meta, "dc:title");
    metaInfo.url =  meta.res[0]._;
    metaInfo.artist = streamcontent.artist || xmlValue(meta, "dc:creator");
    metaInfo.album = xmlValue(meta, "upnp:album");
    if (xmlValue(meta, "upnp:albumArtURI")) metaInfo.artwork = url.resolve("http://" + this.host + ":" + Sonos.PORT, xmlValue(meta, "upnp:albumArtURI"));
    
    callback(metaInfo);
  }.bind(this));
};

SonosComponent.prototype.updatePlayerState = function(playerState) {
  if (this.playerState == playerState) return;

  var wasNull = undefined == this.playerState;
  if (!wasNull) {
    this.emit("DeviceEvent", this.name + (playerState == "PLAYING" ? ".Started" : ".Stopped"));
  }
  this.emit("DeviceEvent", this.name + ".PlayerState", { state : playerState }, {initializing:this.initializing});
  
  var state = {};
  state["Sonos." + this.name + ".playerState"] = playerState;
  this.emit("StateEvent", state);
  
  this.playerState = playerState;
};

function getSpotifyInfo (trackId, callback) {
  var url = "https://api.spotify.com/v1/tracks/";
  request(url + trackId, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      callback(JSON.parse(body));
    } else {
      console.log("Unable to get metadata", error);
    }
  })
}

var download2 = function(url, dest, cb) {
  var request = http.get(url, function(response) {
    var data = new Buffer('');
    response.on('data', function(chunk) { data = Buffer.concat([data, chunk]);});
    response.on('end', function() {
      var file = fs.writeFile(dest, data, cb); 
    }.bind(this));
  }).on('error', function(err) { // Handle errors
    fs.unlink(dest); // Delete the file async. (But we don't check the result)
    if (cb) cb(err.message);
  });
};



SonosComponent.prototype.updateTrackInfo = function(details) {
  if (this.system.replaceSpotifyArtwork && details.url.indexOf("x-sonos-spotify:") === 0) {
    var info = url.parse(details.url, true);
    var trackId = info.pathname.split("%3a").pop();
    getSpotifyInfo(trackId, function(info) {
      details.artwork = info.album.images[0].url;
      this.sendTrackInfo(details);
    }.bind(this));
  } else {
    this.sendTrackInfo(details);
  }
}




SonosComponent.prototype.sendTrackInfo = function(details) {
  this.trackInfo = details;
  this.emit("DeviceEvent", this.name + ".TrackInfo", details, {initializing:this.initializing});

  var state = {};
  state["Sonos." + this.name + ".trackInfo"] = details;
  this.emit("StateEvent", state);

  // Optionally, replace spotify with an alternate URL to avoid green badging


  if (this.system.cacheArtwork && im) {
    var options = {url: details.artwork};
    var artworkPath = os.tmpdir() + this.name + "-artwork.jpg";
    var artworkBlurPath = os.tmpdir() + "artwork-blur.jpg";
    var artworkFile = fs.createWriteStream(artworkPath);

    var system = this.system;
    if (details.artwork && details.artwork != this.cachedArtworkURL) {
      request(details.artwork).pipe(fs.createWriteStream(artworkPath)).on('finish', function(err) {
        if (err) console.log("Artwork download  ERROR", err);
        this.emit("DeviceEvent", this.name + ".ArtworkSaved", {path:artworkPath}, {initializing:this.initializing});
        try {
          var artworkBlurFile = fs.createWriteStream(artworkBlurPath);
          im(artworkPath).scale(1000).blur(0,36).write(artworkBlurPath, function (err) {
            if (err) {
              console.log("! Sonos blur error", err);
            } else {
              var state = {"sonosArtwork": "http://" + system.listenIp + ":" + system.listenPort + "/artwork-blur.jpg"};
              system.emit("StateEvent", state);              
            }
            });
        } catch (e) {}
        }.bind(this)
      );
    }
    this.cachedArtworkURL = details.artwork;    
  }
};

SonosComponent.prototype.updateNextTrackInfo = function(details) {
  this.nextTrackInfo = details;
  this.emit("DeviceEvent", this.name + ".NextTrackInfo", details, {initializing:this.initializing});

  var state = {};
  state["Sonos." + this.name + ".nextTrackInfo"] = details;
  this.emit("StateEvent", state);
};

SonosComponent.prototype.parseNotification = function (data, path) {  
  try {
    var parser = new xml2js.Parser();
    parser.parseString(data, function (err, result) {
      if (!result) return;

      var eventInfo = result["e:propertyset"]["e:property"][0].LastChange[0];
      parser.parseString(eventInfo, function (err, result) {
        var playerInfo = {};
        var status = result.Event.InstanceID[0];
        for (var key in status) {
          if (key == "$") continue;
          try {
            var val = status[key][0].$.val;
          } catch (e) {}

          switch (key) {
            case "TransportState":
              this.updatePlayerState(val);
              break;
            case "Volume":
              this.volume = parseInt(val);
              playerInfo.Volume = parseInt(val);
              break;
            case "CurrentTrackURI":
              playerInfo.TrackURI = val;
              if (val.indexOf("x-rincon:") === 0) {
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
              playerInfo.Muted = val == "1" ? true : false;
              break;
            default:
              //console.log(key, status[key]);
              break;
          }
        }
        var state = {};
        for (var key in playerInfo) {
          state["Sonos." + this.name + "." + key] = playerInfo[key];
        }
        this.emit("StateEvent", state);
      }.bind(this));
    }.bind(this));
  } catch (e) {
    console.log("Sonos: parse error" + e, e.stack);
  } 

  // We expect one notification from each source that is an initialization.
  if (this.initializing) this.initializing--;
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
               .replace(/"/g, '&quot;')
               .replace(/>/g, '&gt;');
}

module.exports = Sonos;
