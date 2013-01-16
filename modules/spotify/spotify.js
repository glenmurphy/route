/*
Copyright 2012 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

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
  if (command == "Reconnect") {
    this.reconnect();
  } else if (command == "Listen") {
    this.listenTo(params.toValue)
  } else {
    this.bridge.sendEvent("Spotify." + command);
  }
};

// Find matching spotify urls matching a type/query
Spotify.prototype.searchByType = function(type, query, callback) {
  http.get("http://ws.spotify.com/search/1/" + type + "?q=" + query, function(res) {
    var body = '';
    res.on('data', function (d) {body += d;});
    res.on('end', function () {
      var parser = new xml2js.Parser();
      parser.parseString(body, function (err, result) {
        var array = result[type + "s"][type];                        
        callback.bind(this)(array);
      }.bind(this));
    }.bind(this));
  }.bind(this))
}

// Search artists and tracks to find the best match for a request
Spotify.prototype.listenTo = function(query) {
  this.client.write("Say: playing" + query.split(" by ").join(". by ") +  "\n");
  query = query.split(" by ").join(" ");
  this.searchByType("artist", query, function (artists) {
    if (artists && artists.length && artists[0] && artists[0].popularity > 0.2) {
      return this.playInContext(artists[0]['$']['href']);
    }
    console.log("no artist matches");
    this.searchByType("track", query, function (tracks) {
      if (tracks && tracks.length && tracks[0] && tracks[0].popularity > 0.2) {
        var track = tracks[0]['$']['href'];
        var album = tracks[0]['album'][0]['$']['href'];
        console.log(album);
        return this.playInContext(track, album);
      }
      console.log("no track matches");
    }.bind(this));
  }.bind(this)); 
}

Spotify.prototype.playInContext = function(track, context) {
  this.bridge.sendEvent("Spotify.ListenTo:" + track + (context ? "/" + context : ""));
}

exports.Spotify = Spotify;
