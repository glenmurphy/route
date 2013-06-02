var EventEmitter = require('events').EventEmitter;
var http = require('http');
var url = require('url');
var static = require('node-static');
var util = require('util');
var io = require('socket.io');
var path = require('path');

function Web(data) {
  this.basedir = data.basedir;
  this.server = http.createServer(this.handleReq.bind(this)).listen(data.port ? data.port : 8080);
  this.staticServer = new static.Server(data.dir);

  this.socket = io.listen(this.server, { log: false });
  this.socket.on('connection', this.handleSocketConnection.bind(this));
  this.socket.on('error', this.handleSocketError.bind(this));
  this.clients = [];

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
  } else if (info.pathname == "/" && this.basedir) {
    res.writeHead(302, {'Location': this.basedir});
    res.end();
  } else {
    this.staticServer.serve(req, res);
  }
};

Web.prototype.handleEvent = function(info) {
  this.emit("DeviceEvent", info.pathname, info.query);
}

Web.prototype.handleSocketConnection = function(socket) {
  this.emit("DeviceEvent", "ClientConnected");
  this.clients.push(socket);
  try {
    socket.emit('state', this.state.allValues());    
  } catch (e) {
    console.log("!  Web emit error:", e, this.state.allValues());
  }
  socket.on('message', this.handleSocketMessage.bind(this));
  socket.on('error', this.handleSocketError.bind(this));
  socket.on('disconnect', this.handleSocketClose.bind(this, socket));
};

Web.prototype.handleSocketError = function(socket) {
  console.log("!  Web socket error", socket);
};

Web.prototype.handleSocketMessage = function(message) {
  this.handleEvent(url.parse(message, true));
};

Web.prototype.handleSocketClose = function(socket) {
  this.emit("DeviceEvent", "ClientDisconnected");
  for (var i=0; i < this.clients.length; i++) {
    if (this.clients[i] == socket) {
      this.clients.splice(i, 1);
    }
  }
};

//
// State Changes
//

Web.prototype.setStateObject = function(object) {
  this.state = object;
  this.state.addListener('StateEvent', this.stateChanged.bind(this));
}

Web.prototype.stateChanged = function(newState) {
  for (var i=0; i < this.clients.length; i++) {
    this.clients[i].emit('state', newState);
  }
};


exports.Web = Web;
