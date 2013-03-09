var EventEmitter = require('events').EventEmitter;
var net = require('net');
var util = require('util');
var http = require('http');
var xml2js = require('xml2js');

/* SPOTIFY ------------------------------------------------------------------- */
function Spotify(data) {
  this.bridge = data.bridge;
}
util.inherits(Spotify, EventEmitter);


Spotify.prototype.exec = function(command, params) {
  console.log("*  Spotify Executing: " + command);
  console.log(params);
  if (command == "Reconnect") {
    this.reconnect();
  } else if (command == "Listen") {
    this.listenTo(params.query, params.context);
  } else {
    this.bridge.exec("Spotify." + command);
  }
};

// Find matching spotify urls matching a type/query
Spotify.prototype.searchByType = function(type, query, callback) {
  console.log("http://ws.spotify.com/search/1/" + type + "?q=" + query);
  http.get("http://ws.spotify.com/search/1/" + type + "?q=" + query, function(res) {
    var body = '';
    res.on('data', function (d) {body += d;});
    res.on('end', function () {
      var parser = new xml2js.Parser();
      parser.parseString(body, function (err, result) {
        if (result) {
          var array = result[type + "s"][type];                        
          callback.bind(this)(array);          
        } else {
          console.log("! no spotify results");
        }
      }.bind(this));
    }.bind(this));
  }.bind(this))
}

Spotify.prototype.playArtistByURI = function(uri) {


}


// Search artists and tracks to find the best match for a request
Spotify.prototype.listenTo = function(query, context) {
  console.log("Searching for: " + query);
  if (!query) return;
  this.bridge.exec("Say", {string : "playing " + query.split(" by ").join(". by ") +  "\n"});
  query = query.split(" by ").join(" ");
  this.searchByType("artist", query, function (artists) {
    if (artists && artists.length && artists[0] && artists[0].popularity > 0.2) {
      return this.playArtist(artists[0]['$']['href']);
      return this.playInContext(artists[0]['$']['href'], null, context);
    }
    console.log("no artist matches");
    this.searchByType("track", query, function (tracks) {
      if (tracks && tracks.length && tracks[0] && tracks[0].popularity > 0.2) {
        var track = tracks[0]['$']['href'];
        var album = tracks[0]['album'][0]['$']['href'];
        console.log(album);
        return this.playInContext(track, album, context);
      }
      console.log("no track matches");
    }.bind(this));
  }.bind(this)); 
}

Spotify.prototype.playInContext = function(track, container, context) {
  this.bridge.exec("Spotify.ListenTo", {string : track, container : container, context : context});
}

exports.Spotify = Spotify;
