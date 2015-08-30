var EventEmitter = require('events').EventEmitter;
var express = require('express');
var io = require('socket.io');
var https = require('https');
var http = require('http');
var util = require('util');
var url = require('url');

function Web(data) {
  this.app = express();

  // Redirect root requests
  if (data.rootRedirect) this.app.all('/', function (req, res) {
    res.redirect(data.rootRedirect);
  }.bind(this));

  // Override handlers and directories
  for (var path in data.handlers) this.app.all(path, data.handlers[path]);
  for (var path in data.dirs) this.app.use(path, express.static(data.dirs[path]));

  this.app.use('/event', this.handleEventReq.bind(this));
  this.app.use('/state', this.handleStateReq.bind(this));
  this.app.use(express.static(data.dir)); // Default directory

  // Set up HTTP
  this.server = http.createServer(this.app).listen(data.port || 8080);
  this.socket = io.listen(this.server, { log: false });
  this.socket.on('connection', this.handleSocketConnection.bind(this));
  this.socket.on('error', this.handleSocketError.bind(this));
  // TODO: Set up Event-only port, if auth doesn't work out. // if (data.eventPort) this.eventServer = http.createServer(this.handleEventReq.bind(this)).listen(data.eventPort);

  // Set up HTTPS if requested
  if (data.securePort && data.key && data.cert) {
    var options = { key: data.key, cert: data.cert, ca: data.ca }
    this.password = data.password;
    this.secureServer = https.createServer(options, this.app).listen(data.securePort);    
    this.secureSocket = io.listen(this.secureServer, { log: false });
    this.secureSocket.on('connection', this.handleSocketConnection.bind(this));
    this.secureSocket.on('error', this.handleSocketError.bind(this));
  }

  this.clients = [];
};
util.inherits(Web, EventEmitter);

// Emit requests to /event/pie?params as 'Web.pie?params'
Web.prototype.handleEventReq = function(req, res) {
  var info = url.parse(req.url, true);
  info.pathname = info.pathname.substring(1);
  this.handleEvent(info);
  res.sendStatus(200);
}

Web.prototype.handleEvent = function(info) {
  this.emit("DeviceEvent", info.pathname, info.query);
}

Web.prototype.handleSocketConnection = function(socket) {
  this.clients.push(socket);
  if (this.state) socket.emit('state', this.state.allValues());    
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
  this.clients = this.clients.filter(function(c) { return c != socket; });
};

// State Changes

Web.prototype.handleStateReq = function (req, res) {
  res.json(this.state.allValues());
}

Web.prototype.setStateObject = function(object) {
  this.state = object;
  this.state.addListener('StateEvent', this.stateChanged.bind(this));
};

Web.prototype.stateChanged = function(newState) {
  this.clients.forEach(function(c) { c.emit('state', newState); });
};

Web.prototype.customStateChanged = function(stateName, newState) {
  this.clients.forEach(function(c) { c.emit(stateName, newState); });
};

module.exports = Web;
