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
  this.staticServer = new static.Server(data.dir);
  this.basedir = data.basedir;

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
  console.log(info);

  // Emit requests to /event/pie?params as 'Web.pie?params'
  var prefix = "/event/";
  if (info.pathname.indexOf(prefix) == 0) {
    info.pathname = info.pathname.substring(prefix.length);
    this.textResponse = null;
    this.handleEvent(info);
    res.writeHead(200, {'Content-Type': 'text/plain'});
    if (this.textResponse) res.write(this.textResponse);
    res.end('');
  } else if (info.pathname.indexOf('/state') == 0) {
    var json = JSON.stringify(this.state.allValues());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify(json));
    res.end();
  }
  else if (info.pathname == "/" && this.basedir) {
    console.log("[" + info.pathname + "]" + this.basedir);

    res.writeHead(302, {'Location': this.basedir});
    res.end();
  } else {
    this.staticServer.serve(req, res);
  }
};

Web.prototype.handleEvent = function(info) {
  console.log(info);
  this.emit("DeviceEvent", info.pathname, info.query);
}


Web.prototype.handleSocketConnection = function(ws) {
  console.log('i Web client connected');
  this.clients.push(ws);
  var json = JSON.stringify(this.state.allValues());
  ws.send(json);
  ws.on('message', this.handleSocketMessage.bind(this));
  ws.on('close', this.handleSocketClose.bind(this, ws));  
};

Web.prototype.handleSocketMessage = function(message) {
//  this.emit("DeviceEvent", message);
  this.handleEvent(url.parse(message, true));
}

Web.prototype.handleSocketClose = function(ws) {
  console.log('i Web client disconnected');
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