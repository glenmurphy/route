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
var http = require('http');
var util = require('util');
var xml2js = require('xml2js');

Roku.PORT = 8060;
function Roku(data) {
  this.host = data.host;
  this.getChannels();
  this.eventQueue = [];
};
util.inherits(Roku, EventEmitter);

Roku.prototype.exec = function(command, params) {
  if (command == "LaunchChannel") {
    console.log("*  Roku Executing: " + command + " : " + params.channel);
    this.launchChannel(params.channel);
  } else if (command == "SearchRoku") {
    console.log("*  Roku Search: " + command + " : " + params.forValue);
    this.searchRoku(params.forValue);
  } else if (command == "SendEvent") {
    this.sendEvent(params.rokuEvent);
  } else {
    this.sendEvent(command);
  }
};

Roku.prototype.log = function(data) {
  console.log("Roku LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}
Roku.prototype.searchRoku = function (query) {
  this.launchChannel(18681);
  setTimeout(function(){
    this.sendText(query);
    this.sendEvent("Play");
  }.bind(this), 2000);
}
Roku.prototype.launchChannel = function (channelID) {
  var request = http.request({
    port : Roku.PORT,
    host : this.host,
    path : "/launch/" + channelID,
    method: 'POST'
    }, function(res){
      console.log(res.statusCode);
      res.on('data', function (chunk) {
      }.bind(this));
      res.on('end', function () {
      }.bind(this));
  }.bind(this));
  console.log(request.path)
  request.on('error', function(e) {console.log("Error:" + e.message)});
  request.end();
 // 'POST /launch/11?contentID=14 HTTP/1.1\r\n\r\n' | ncat 192.168.1.114 8060 
}

Roku.prototype.sendText = function(text) {
  var characters = text.split('');
  for (var i = 0; i < characters.length; i++) {
    this.sendEvent(characters[i]);
  }
}

Roku.prototype.sendEvent = function(key) {
  if (key.length == 1) key = "Lit_" + escape(key);
  var isFirstRequest = this.eventQueue.length == 0;
  this.eventQueue.push(key);
  if (isFirstRequest) {
    setTimeout(this.sendNextEvent.bind(this),0);
  }
}


Roku.prototype.sendNextEvent = function() {
  if (!this.eventQueue.length) return;
  var key = this.eventQueue.shift();

  var request = http.request({
    port : Roku.PORT,
    host : this.host,
    path : "/keypress/" + key,
    method: 'POST'
    }, function(res){
      res.on('data', function (chunk) {
      }.bind(this));
      res.on('end', function () {
        this.sendNextEvent();
      }.bind(this));
  }.bind(this));
  console.log("URL: " + request.path);
  request.on('error', function(e) {console.log("Error:" + e.message)});
  request.end();
}

Roku.prototype.getChannels = function() {
  var request = http.request({
    port : Roku.PORT,
    host : this.host,
    path : "/query/apps",
    }, function(res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
      var parser = new xml2js.Parser();
      parser.parseString(chunk, function (err, result) {
        var channels = [];
        result = result.apps.app
        for (var i = 0; i < result.length; i++) {
          var channel = result[i].$;
          channel.name = result[i]._
          channels.push(channel);
        };
        this.emit("StateEvent", {"rokuChannels" : channels, "rokuIP" : this.host});
      }.bind(this));
    }.bind(this));
  }.bind(this));
  request.on('error', function(e) {console.log(e)});
  request.end();
}

var dgram = require('dgram'); // dgram is UDP

// Listen for responses
function listen(port) {
  var server = dgram.createSocket("udp4");
  server.on("message", function (msg, rinfo) {
    console.log("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
  });

  server.bind(port); // Bind to the random port we were given when sending the message, not 1900

  // Give it a while for responses to come in
  setTimeout(function(){
    server.close();
  },2000);
}

function search() {
  var message = new Buffer(
    "M-SEARCH * HTTP/1.1\n" +
    "HOST:239.255.255.250:1900\n" +
    "MAN:\"ssdp:discover\"\n" +
    "ST:roku:ecp\n" + // Essential, used by the client to specify what they want to discover, eg 'ST:ge:fridge'
    "\n"
  );
  var client = dgram.createSocket("udp4");
  client.bind(); // So that we get a port so we can listen before sending
  listen(client.address().port);
  client.send(message, 0, message.length, 1900, "239.255.255.250");
  client.close();
}

search();


exports.Roku = Roku;