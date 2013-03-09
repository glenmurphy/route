var EventEmitter = require('events').EventEmitter;
var http = require('http');
var url = require('url');
var util = require('util');
var xml2js = require('xml2js');
var os = require('os');

// see http://IP:1400/status/upnp for status
// subscription logs at http://IP:1400/status/opt/log/anacapa.trace

function SonosComponent(data) {
  this.name = data.name;
  this.host = data.host;
  this.player_state = "";
  this.volume = 0;
  this.deviceid = 1;
  this.getUID();
}
util.inherits(SonosComponent, EventEmitter);


/* SONOS ------------------------------------------------------------------- */
function Sonos(data) {
  this.server = http.createServer(this.handleReq.bind(this)).listen(9000);
  this.debug = data.debug;

  this.components = data.components || {};
  this.defaultComponent = data.defaultComponent || "Main";
  for (var component in this.components) { // Instantiate components
    var newComponent = new SonosComponent({ name : component , host : this.components[component]});
    this.components[component] = newComponent;
    newComponent.on("DeviceEvent", this.emit.bind(this, "DeviceEvent")); // reemit events
    newComponent.on("StateEvent", this.emit.bind(this, "StateEvent"));
  }

  var ip = null;
  if (os.networkInterfaces().en0) {
    os.networkInterfaces().en0.forEach(function(details){
      if (details.family=='IPv4') { ip = details.address}
    });
  }
  this.listen_ip = data.listen_ip || ip;
  this.listen_port = data.listen_port || 9000;
  this.subscribeEvents();
  for (var first in this.components) {
    this.components[first].getFavorites();
    break; // only run once
  }
  setInterval(this.subscribeEvents.bind(this), 59 * 60 * 1000); // Resubscribe every 59 minutes (1m overlap)
  //this.queueURI("x-sonos-spotify:spotify%3atrack%3a0xFomAiFsu5qCnLM0hu0UR?sid=12&flags=0");

}
util.inherits(Sonos, EventEmitter);

Sonos.PORT = 1400;
Sonos.TRANSPORT_ENDPOINT = '/MediaRenderer/AVTransport/Control';
Sonos.RENDERING_ENDPOINT = '/MediaRenderer/RenderingControl/Control';
Sonos.CONTENT_ENDPOINT = '/MediaServer/ContentDirectory/Control';

Sonos.TRANSPORT_SERVICE = "urn:schemas-upnp-org:service:AVTransport";  //"urn:upnp-org:serviceId:AVTransport"; //
Sonos.RENDERING_SERVICE = "urn:schemas-upnp-org:service:RenderingControl";
Sonos.CONTENT_SERVICE = "urn:schemas-upnp-org:service:ContentDirectory";

Sonos.SERVICES = [
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
  { "Service":"/MediaRenderer/RenderingControl/Event", "Description":"Render Control" },
  //{ "Service":"/MediaRenderer/ConnectionManager/Event", "Description":"Connection Manager" },
  { "Service":"/MediaRenderer/AVTransport/Event", "Description":"Transport Event" }
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

//  if (params.context) var component = this.components[params.context];


  console.log("*  Sonos Executing: " + command, component, params);

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
      component.queueURI(params.uri, params.metadata);
      //this.play();
      break;
  }
};


SonosComponent.prototype.getUID = function() {
  var req = http.get({hostname: this.host, port: Sonos.PORT, path: '/status/zp'}, function(res) {
    res.on('data', function(data) {
      var parser = new xml2js.Parser();
        parser.parseString(data, function (err, result) {
        this.uid = result.ZPSupportInfo.ZPInfo[0].LocalUID[0];
      }.bind(this));
    }.bind(this));
  }.bind(this));
  req.on('error', function(e) {
    console.log('! Sonos', this.name, e.message);
  }.bind(this));
}


SonosComponent.prototype.callAction = function(service, action, arguments, device, callback) {
  var xmlns = service + ':' + device;
  
  var body = "<u:" + action + " xmlns:u=\"" + xmlns + "\">" ;
  for (var key in arguments) {
    body += "<" + key + ">" + arguments[key] + "</" + key + ">";
  }
  body += "</u:" + action + ">";

  if (service == Sonos.TRANSPORT_SERVICE) var endpoint = Sonos.TRANSPORT_ENDPOINT;
  if (service == Sonos.RENDERING_SERVICE) var endpoint = Sonos.RENDERING_ENDPOINT;
  if (service == Sonos.CONTENT_SERVICE) var endpoint = Sonos.CONTENT_ENDPOINT;
  this.sendCommand(endpoint, xmlns + '#' + action, body, callback);
}

SonosComponent.prototype.sendCommand = function(endpoint, action, body, callback) { 
  var data = '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>' + body + '</s:Body></s:Envelope>';
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

SonosComponent.prototype.playSpotifyTrack = function (url) {
  var uri = "x-sonos-spotify:" + encodeURIComponent(url) + "?sid=12&amp;flags=0"
  console.log(uri);
  this.queueURI(uri,null);
}


SonosComponent.prototype.playPause = function() {
  if (this.player_state === "PLAYING")
    this.pause();
  else
    this.play();
}

SonosComponent.prototype.play = function() {
  this.callAction(Sonos.TRANSPORT_SERVICE, "Play", {InstanceID : 0, Speed : 1}, this.deviceid, function(resp) {console.log(resp);});
};

SonosComponent.prototype.pause = function() {
 this.callAction(Sonos.TRANSPORT_SERVICE, "Pause", {InstanceID : 0}, this.deviceid);
};

SonosComponent.prototype.prevTrack = function() {
   this.callAction(Sonos.TRANSPORT_SERVICE, "Previous", {InstanceID : 0}, this.deviceid);
};

SonosComponent.prototype.nextTrack = function() {
   this.callAction(Sonos.TRANSPORT_SERVICE, "Next", {InstanceID : 0}, this.deviceid, console.log);
};

SonosComponent.prototype.removeAllTracksFromQueue = function() {
   this.callAction(Sonos.TRANSPORT_SERVICE, "RemoveAllTracksFromQueue", {InstanceID : 0}, this.deviceid);
};

SonosComponent.prototype.addURItoQueue = function(uri) {
   this.callAction(Sonos.TRANSPORT_SERVICE, "AddURIToQueue", {InstanceID : 0}, this.deviceid);
};

SonosComponent.prototype.setPlayMode = function(mode) { // NORMAL, REPEAT_ALL, SHUFFLE, SHUFFLE_NOREPEAT
  this.callAction(Sonos.TRANSPORT_SERVICE, "SetPlayMode", {InstanceID : 0, NewPlayMode : mode}, this.deviceid);
};


SonosComponent.prototype.queueContainerURI = function(uri, metadata) {
  this.removeAllTracksFromQueue();
  this.queueURI(uri, metadata);
  this.playQueue();

}

function encodeHTML(string) {
    return string.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
}

SonosComponent.prototype.queueURI = function(uri, metadata) {
  metadata = metadata || "";
  //console.log("play", uri, encodeHTML(metadata));
  //var meta = '<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/"><item id="-1" parentID="-1" restricted="true"><res protocolInfo="sonos.com-spotify:*:audio/x-spotify:*" duration="0:03:59">x-sonos-spotify:spotify%3atrack%3a4fOk5H8oMWP99F7HXAZ4O7?sid=12&amp;flags=0</res><r:streamContent></r:streamContent><r:radioShowMd></r:radioShowMd><upnp:albumArtURI>/getaa?s=1&amp;u=x-sonos-spotify%3aspotify%253atrack%253a4fOk5H8oMWP99F7HXAZ4O7%3fsid%3d12%26flags%3d0</upnp:albumArtURI><dc:title>Fear</dc:title><upnp:class>object.item.audioItem.musicTrack</upnp:class><dc:creator>Sarah McLachlan</dc:creator><upnp:album>Fumbling Towards Ecstasy (Legacy Edition)</upnp:album></item></DIDL-Lite>'
  this.callAction(Sonos.TRANSPORT_SERVICE, "SetAVTransportURI",
    {InstanceID : 0, CurrentURI : (uri), CurrentURIMetaData : encodeHTML(metadata)}, this.deviceid, function(resp) {
      var parser = new xml2js.Parser();
      parser.parseString(resp, function (err, result) {
      console.log("RESPONSE: " + resp);
      this.play();
    }.bind(this));
  }.bind(this));
};

SonosComponent.prototype.getVolume = function(callback) {
  this.callAction(Sonos.RENDERING_SERVICE, "GetVolume", {InstanceID : 0, Channel : "Master"}, this.deviceid,
    function (data) {
      var tmp = data.substring(data.indexOf('<CurrentVolume>') + '<CurrentVolume>'.length);
      var volume = tmp.substring(0, tmp.indexOf('<'));
      this.volume = volume;
      if (callback) {
        callback(volume);
      }
    });
};

SonosComponent.prototype.getFavorites = function(callback) {
  this.callAction(Sonos.CONTENT_SERVICE, "Browse", {
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
            this.emit("StateEvent", {"sonosFavorites" : favorites});
          }.bind(this));
        }.bind(this));
      } catch (e) {
        console.log("! Sonos favorites", e)
      }
    }.bind(this));
};


SonosComponent.prototype.setVolume = function(volume) {
  this.volume = volume;
  this.callAction(Sonos.RENDERING_SERVICE, "SetVolume", {DesiredVolume : volume, InstanceID : 0, Channel : "Master"}, this.deviceid);
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

  if (this.debug) console.log("* Sonos: Subscribed " + this.listen_ip + " to " + host + " " + description);
  var request = http.request({
    host: host,
    port: Sonos.PORT,
    path: service,
    method: "SUBSCRIBE",
    headers : {
      "Cache-Control":"no-cache",
      "Pragma"       :"no-cache",
      //"USER-AGENT"   :"Linux UPnP/1.0 Sonos/16.7-48310 (PCDCR)",
      "CALLBACK"     :"<http://" + this.listen_ip + ":" + this.listen_port + ">",
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
}

Sonos.prototype.handleReq = function(req, res) {
  var address = req.connection.remoteAddress;
  var component = this.componentForIP(address);
  component.handleReq(req,res);
}

SonosComponent.prototype.handleReq = function(req, res) {
  var info = url.parse(req.url, true);
  res.writeHead(200);
  res.end();

  var data = '';
  req.on('data', function(chunk) { data += chunk; });
  req.on('end', function() {
    this.parseNotification(data);
  }.bind(this));  
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
SonosComponent.prototype.parseXMStreamContent = function (string) {
  var record = {};
  if (!string) return record;
  var fields = string.split("|");
 //            'BR P|TYPE=SNG|TITLE The Night Out|ARTIST Martin Solveig' 
  for (var i = 0; i < fields.length; i++) {
    var namesplit = fields[i].indexOf(" ");
    record[fields[i].substring(0,namesplit).toLowerCase()] = fields[i].substring(namesplit);
  }
  return record;
}

SonosComponent.prototype.parseMetadata = function (metadata) {
  var metaInfo = {};
  var parser = new xml2js.Parser();
  parser.parseString(metadata, function (err, result) {
    if (result) {
      var meta = result["DIDL-Lite"]["item"][0];
      if (this.debug) console.log("metadata", meta);
      var streamcontent = xmlValue(meta, "r:streamContent");
      streamcontent = this.parseXMStreamContent(streamcontent);
      metaInfo.Name =  streamcontent.title || xmlValue(meta, "dc:title");
      metaInfo.Artist = streamcontent.artist || xmlValue(meta, "dc:creator");
      metaInfo.Album = xmlValue(meta, "upnp:album");
      if (xmlValue(meta, "upnp:albumArtURI")) metaInfo.Artwork = url.resolve("http://" + this.host + ":" + Sonos.PORT, xmlValue(meta, "upnp:albumArtURI"));
      // TODO: send next-track info too
    }
  }.bind(this));
  return metaInfo;
}

SonosComponent.prototype.parseNotification = function (data) {
  try {
    var parser = new xml2js.Parser();
    parser.parseString(data, function (err, result) {
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
              var playState = this.player_state;
              playerInfo["Player State"] = val;
              if (undefined != playState && playState != val) {
                this.emit("DeviceEvent", this.name + (val == "PLAYING" ? ".Started" : ".Stopped"));
              }
              this.player_state = val;
              break;
            case "CurrentTrackURI":
              playerInfo.TrackURI = val;
              break;
            case "CurrentTrackMetaData":
              var metaInfo = this.parseMetadata(val);
              playerInfo.TrackMetadata = metaInfo;
              break;
            case "r:NextTrackURI":
              playerInfo.NextTrackURI = val;
              break;
            case "r:NextTrackMetaData":
              var metaInfo = this.parseMetadata(val);
              playerInfo.NextTrackMetadata = metaInfo;
              break;
            case "Mute":
              var muteState = this.muteState;
              if (undefined != muteState &&  muteState != val) {
                console.log(this);
                this.emit("DeviceEvent", this.name + (val == "1" ? ".Muted" : ".Unmuted"));
              }
              this.muteState = val;

              break;
            default:
              //console.log(key, status[key]);

            
          }
        }
        var state = {};
        for (var key in playerInfo) {
          state["sonos." + this.name + "." + key] = playerInfo[key];
        }
        //console.log(state);

        this.emit("StateEvent", state);
      }.bind(this));
    }.bind(this));
  } catch (e) {
    console.log("Sonos: parse error" + e, e.stack);
  } 
}


exports.Sonos = Sonos;



// Sonos.prototype.getTrackInfo = function() {
  
//   try {
//     var action = '"urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo"';
//     var body = '<u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:GetPositionInfo>';
//     this.sendCommand(Sonos.TRANSPORT_ENDPOINT, action, body, function(data){
//       var parser = new xml2js.Parser();
//       parser.parseString(data, function (err, result) {
//         var trackInfo = result["s:Envelope"]["s:Body"][0]["u:GetPositionInfoResponse"][0];
//         var trackURL = trackInfo.TrackURI[0];
//         console.log(trackInfo);
//         parser.parseString(trackInfo.TrackMetaData, function (err, meta) {
//           if (meta) {
//             meta = meta["DIDL-Lite"]["item"][0];
//             var playerInfo = {
//               "Player State" : "Playing",
//               Name : meta["dc:title"][0],
//               Artist : meta["dc:creator"][0],
//               Album : meta["upnp:album"][0],
//               Artwork : url.resolve("http://" + this.host + ":" + Sonos.PORT, meta["upnp:albumArtURI"][0])
//             };
//             this.emit("StateEvent", {"sonos" : playerInfo});
//           }
//         }.bind(this));
//       }.bind(this));
//     }.bind(this));
//   } catch (e) {
//     console.log("Sonos parse error: " + e);
//   }
// };
