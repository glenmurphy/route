var EventEmitter = require('events').EventEmitter;
var http = require('http');
var url = require('url');
var fs = require('fs');
var util = require('util');
var io = require('socket.io');
var path = require('path');

function Web(data) {
  this.dir = data.dir;
  this.server = http.createServer(this.handleReq.bind(this)).listen(data.port ? data.port : 8080);

  this.socket = io.listen(this.server, { log: false });
  this.socket.on('connection', this.handleSocketConnection.bind(this));
  this.socket.on('error', this.handleSocketError.bind(this));
  this.clients = [];

  this.stateCache = {};

  console.log("Web Connected");
};

util.inherits(Web, EventEmitter);
Web.MIMETYPES = {
  "html": "text/html",
  "jpeg": "image/jpeg",
  "jpg": "image/jpeg",
  "png": "image/png",
  "js": "text/javascript",
  "css": "text/css"
};

Web.prototype.exec = function(command, details) {
  console.log(" Web: storing " + command);
  this.stateCache[command] = details;
  for (var i = 0; i < this.clients.length; i++) {
    this.clients[i].emit(command, details);
  }
};

Web.prototype.handleReq = function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  var query = url.parse(req.url);
  var page = query.pathname.split("/");

  // Emit requests to /event/pie as 'Web.pie'
  if (page.length > 2 && page[1] == 'event' && page[2] != "") {
    this.emit("DeviceEvent", page[2]);
    res.end();
  } else {
    var filename = path.join(this.dir, query.pathname);
    switch(query.pathname) {
      case "/":
        filename = path.join(this.dir, "index.html");
      default:
        var ext = path.extname(filename);
        res.writeHead(200, {'Content-Type': (Web.MIMETYPES[ext] || "text/html")});
        var fileStream = fs.createReadStream(filename);
        fileStream.pipe(res);
        break;
    }
  }
};

Web.prototype.handleSocketConnection = function(socket) {
  this.clients.push(socket);
  this.emit("DeviceEvent", "ClientConnected");
  socket.on('getState', this.handleSocketGetState.bind(this, socket));
  socket.on('error', this.handleSocketError.bind(this, socket));
  socket.on("DeviceEvent", this.handleEvent.bind(this));
  socket.on('disconnect', this.handleSocketClose.bind(this, socket));
};

Web.prototype.handleEvent = function(command, details) {
  this.emit("DeviceEvent", command, details);
};

Web.prototype.handleSocketError = function(socket) {
};

Web.prototype.handleSocketGetState = function(socket, state) {
  if (state in this.stateCache)
    socket.emit(state, this.stateCache[state]);
  else
    console.log(" Web: " + state + " state not available");
};

Web.prototype.handleSocketClose = function(socket) {
  this.emit("DeviceEvent", "ClientDisconnected");
  for (var i = 0; i < this.clients.length; i++) {
    if (this.clients[i] == socket) {
      this.clients.splice(i, 1);
    }
  }
};

exports.Web = Web;
