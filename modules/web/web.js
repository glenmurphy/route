var EventEmitter = require('events').EventEmitter;
var http = require('http');
var url = require('url');
var fs = require('fs');
var util = require('util');
var io = require('socket.io');
var path = require('path');

function Web(data) {
  this.dir = data.dir;
  this.server = http.createServer(this.handleReq.bind(this)).listen(data.port ? data.port : 8000);

  this.username = data.username;
  this.password = data.password;

  this.socket = io.listen(this.server, { log: false });
  this.socket.on('connection', this.handleSocketConnection.bind(this));
  this.socket.on('error', this.handleSocketError.bind(this));
  this.clients = [];

  this.state = {};

  console.log("Web Connected");
};

util.inherits(Web, EventEmitter);
Web.STATEOBSERVER = true;
Web.MIMETYPES = {
  "html" : "text/html",
  "jpeg" : "image/jpeg",
  "jpg" : "image/jpeg",
  "png" : "image/png",
  "js" : "text/javascript",
  "css" : "text/css"
};

Web.prototype.exec = function(command, details) {

};

Web.prototype.initStateObserver = function(route, state) {
  this.state = state;
  route.on("StateChanged", this.handleStateChanged.bind(this));
};

Web.prototype.handleStateChanged = function(state, data) {
  for (var i = 0; i < this.clients.length; i++) {
    this.clients[i].emit(state, data);
  }
};

Web.prototype.handleReq = function(req, res) {
  var query = url.parse(req.url);
  var page = query.pathname.split("/");

  var header = req.headers['authorization']||'';        // get the header
  var token = header.split(/\s+/).pop()||'';            // and the encoded auth token
  var auth = new Buffer(token, 'base64').toString();    // convert from base64
  var parts = auth.split(/:/);                          // split on colon
  var username = parts[0];
  var password = parts[1];

  if (this.username && (this.username != username || this.password != password)) {
    console.log("Web: failed login");
    res.writeHead(401, {
      'WWW-Authenticate' : 'Basic realm="login"'
    });

    //res.setHeader('WWW-Authenticate', 'Basic realm="need login"');
    res.end('Authorization required');
    return;
  }

  res.writeHead(200, {'Content-Type': 'text/plain'});
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
        var ext = path.extname(filename).substring(1);
        if (fs.existsSync(filename)) {
          res.writeHead(200, {'Content-Type': (Web.MIMETYPES[ext] || "text/html")});
          var fileStream = fs.createReadStream(filename);
          fileStream.pipe(res);
        } else {
          res.end();
        }
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

Web.prototype.handleSocketGetState = function(socket, stateName) {
  if (stateName in this.state)
    socket.emit(stateName, this.state[stateName]);
};

Web.prototype.handleSocketClose = function(socket) {
  this.emit("DeviceEvent", "ClientDisconnected");
  for (var i = 0; i < this.clients.length; i++) {
    if (this.clients[i] == socket) {
      this.clients.splice(i, 1);
    }
  }
};

module.exports = Web;
