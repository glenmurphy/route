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
var path = require('path');
var url = require('url');
var fs = require('fs');
var util = require('util');
var static = require('node-static');
var WebSocketServer = require('ws').Server

function Web(data) {
  this.server = http.createServer(this.handleReq.bind(this))
  this.server.listen(data.port ? data.port : 8080);
  this.staticServer = new static.Server(__dirname + '/web_static');

  this.clients = [];
  this.wss = new WebSocketServer({server:this.server});
  this.wss.on('connection', this.handleSocketConnection.bind(this));

  this.textResponse = null;
};
util.inherits(Web, EventEmitter);

Web.prototype.setTextResponse = function (response) {
  this.textResponse = response;
}

Web.prototype.handleReq = function(req, res) {
  var info = url.parse(req.url, true);

  // Emit requests to /event/pie?params as 'Web.pie?params'
  var prefix = "/event/";
  if (info.pathname.indexOf(prefix) == 0) {
    this.textResponse = null;
    info.pathname = info.pathname.substring(prefix.length);
    this.emit("DeviceEvent", info.pathname, info.query);
    res.writeHead(200, {'Content-Type': 'text/plain'});
    if (this.textResponse) res.write(this.textResponse);
    res.end('');
  } else {
    this.staticServer.serve(req, res);
  }
};

Web.prototype.handleSocketConnection = function(ws) {
  console.log((new Date()) + ' Client Connected');
  this.clients.push(ws);
  var json = JSON.stringify(this.state.allValues());
  ws.send(json);
  ws.on('message', this.handleSocketMessage.bind(this));
  ws.on('close', this.handleSocketClose.bind(this, ws));  
};

Web.prototype.handleSocketMessage = function(message) {
  this.emit("DeviceEvent", message);
}

Web.prototype.handleSocketClose = function(ws) {
  console.log((new Date()) + ' Client Disconnected');
  for (var i=0; i < this.clients.length; i++) {
    if (this.clients[i] == ws) {
      this.clients.splice(i, 1);
    }
  }
}

//
// State Changes
//

Web.prototype.setStateObject = function(object) {
  this.state = object;
  this.state.addListener('StateEvent', this.stateChanged.bind(this));
}

Web.prototype.stateChanged = function(newState) {
  for (var i=0; i < this.clients.length; i++) {
      this.clients[i].send(JSON.stringify(newState));
  }
};


exports.Web = Web;