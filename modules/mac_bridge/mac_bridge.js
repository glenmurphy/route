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

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

/* Bridge ------------------------------------------------------------------- */
function Bridge(data) {
  this.host = data.host;
  this.port = data.port;
  this.connect();
  this.dataBuffer = null;
}
util.inherits(Bridge, EventEmitter);

Bridge.prototype.exec = function(command, params) {
  console.log("*  Bridge Executing: " + command);
  if (command == "Reconnect") {
    this.reconnect();
  } else if (command == "Say") {
    this.sendEvent("Say:" + params.string);
  } else {
    this.sendEvent(command)
  }
};

Bridge.prototype.sendEvent = function(event) {
  this.client.write(event + "\n");
}

Bridge.prototype.connect = function() {
  this.reconnecting_ = false;
  this.client = net.connect({
    host : this.host,
    port : this.port
  }, this.handleConnected.bind(this));
  this.client.setEncoding();
  this.client.on('data', this.handleData.bind(this));
  this.client.on('end', this.handleEnd.bind(this));
  this.client.on('error', this.handleError.bind(this));
};

Bridge.prototype.reconnect = function() {
  if (this.reconnecting_) return;
  this.reconnecting_ = true;
  setTimeout(this.connect.bind(this), 5000);
}

Bridge.prototype.handleConnected = function() {
  this.emit("DeviceEvent", "Bridge.Connected");
  this.emit("StateEvent", {BridgeConnected:true});
};

Bridge.prototype.handleData = function(data) {

  if (this.dataBuffer) {
    data = this.dataBuffer + data;
    this.dataBuffer = null;
  }

  if (data.endsWith("}\n\n")) {
    try {
      var json = JSON.parse(data);
      this.playerInfo = json; 
      this.emit("StateEvent", json);
    } catch (e) {
      console.log(e);
    }
    this.dataBuffer = null;
  } else {
    this.dataBuffer = data;
  }
};

Bridge.prototype.handleEnd = function() {
  //this.emit("DeviceEvent", "Bridge.Disconnected");
  this.emit("StateEvent", {BridgeConnected:false});
  this.reconnect();
};

Bridge.prototype.handleError = function(e) {
  console.log("! Could not connect to bridge: (" + e + ")");
  this.reconnect();
};

exports.Bridge = Bridge;
