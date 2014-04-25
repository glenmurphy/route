var EventEmitter = require('events').EventEmitter;
var http = require('http');
var https = require('https');
var url = require('url');
var static = require('node-static');
var util = require('util');
var io = require('socket.io');
var path = require('path');
var fs = require('fs');

function Web(data) {
  this.basedir = data.basedir;

  if (data.securePort) {
    var options = {
        key: fs.readFileSync(data.key),
        cert: fs.readFileSync(data.cert),
    }
    this.secureServer = https.createServer(options, this.handleReq.bind(this)).listen(data.securePort || 8081);    
    this.secureSocket = io.listen(this.secureServer, { log: false });
    this.secureSocket.on('connection', this.handleSocketConnection.bind(this));
    this.secureSocket.on('error', this.handleSocketError.bind(this));
  }

  this.server = http.createServer(this.handleReq.bind(this)).listen(data.port || 8080);
  if (data.eventPort) this.eventServer = http.createServer(this.handleEventReq.bind(this)).listen(data.eventPort);
  this.socket = io.listen(this.server, { log: false });
  this.socket.on('connection', this.handleSocketConnection.bind(this));
  this.socket.on('error', this.handleSocketError.bind(this));

  this.handlers = data.handlers;
  this.staticServer = new static.Server(data.dir);
  this.clients = [];
  this.textResponse = null;
};
util.inherits(Web, EventEmitter);

Web.prototype.setTextResponse = function (response) {
  this.textResponse = response;
}

// This function only allows event requests (for external use)
Web.prototype.handleEventReq = function(req, res) {
  var info = url.parse(req.url, true);
  var prefix = "/event/";
  if (info.pathname.indexOf(prefix) == 0) {
    this.handleReq(req,res);
  } else {
    res.end();
  }
}

Web.prototype.handleReq = function(req, res) {
  var info = url.parse(req.url, true);

  var matchingHandler = this.handlers[info.pathname];
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
  } else if (matchingHandler) {
    matchingHandler(req, res);
  } else {
    if (this.debug) console.log(req.url);
    this.staticServer.serve(req, res, function (err, result) {
            if (err) { // There was an error serving the file
                util.error("Error serving " + req.url + " - " + err.message);

                // Respond to the client
                res.writeHead(err.status, err.headers);
                res.end();
            }
        });
  }
};

Web.prototype.handleEvent = function(info) {
  this.emit("DeviceEvent", info.pathname, info.query);
}

Web.prototype.handleSocketConnection = function(socket) {
  //this.emit("DeviceEvent", "ClientConnected");
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
  //this.emit("DeviceEvent", "ClientDisconnected");
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
