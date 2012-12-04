var EventEmitter = require('events').EventEmitter;
var http = require('http');
var url = require('url');
var fs = require('fs');
var util = require('util');

function Web(data) {
  this.indexFileContent = '';
  this.indexFileName = __dirname + "/web.html";
  fs.watch(this.indexFileName, this.refreshIndex.bind(this));
  this.refreshIndex(__dirname + "/web.html");

  this.server = http.createServer(this.handleReq.bind(this)).listen(data.port ? data.port : 8080);
  console.log("Web Connected");
};util.inherits(Web, EventEmitter);

Web.prototype.refreshIndex = function() {
  fs.readFile(this.indexFileName, "ascii", (function(error, file) {
    if (file) this.indexFileContent = file;
  }).bind(this));
};

Web.prototype.handleReq = function(req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  var query = url.parse(req.url);
  var path = query.pathname.split("/");

  // Emit requests to /event/pie as 'Web.pie'
  if (path.length > 2 && path[1] == 'event' && path[2] != "") {
    this.emit("DeviceEvent", path[2]);
  } else {
    switch(query.pathname) {
      case "/":
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write(this.indexFileContent, "ascii");
        break;
      default:
        break;
    }
  }

  res.end('');
};

exports.Web = Web;