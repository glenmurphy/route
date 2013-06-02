String.prototype.camelcase = function() {
    return this.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); }).replace(/ /g, "");
};

// Very simple Pebble processor
// Converts input of "bake a pie" to "Pebble.BakeAPie"
// "the" is discarded
// synonyms are remapped 

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var url = require('url');
var http = require('http');

function Pebble(data) {
  this.port = data.port || 9002
  this.server = http.createServer(this.httpReq.bind(this)).listen(this.port);
};
util.inherits(Pebble, EventEmitter);


Pebble.prototype.httpReq = function(req, res) {
  var info = url.parse(req.url, true);

  if (req.method == "POST") {
    req.setEncoding('utf8');
    var data = "";
    req.on('data', function(chunk) { data += chunk; });
    req.on('end', function(chunk) {

      this.emit("DeviceEvent", "Button", JSON.parse(data));

      res.writeHead(200);
      res.end();
    }.bind(this));
  }
};

Pebble.prototype.exec = function(command, params) {
};

exports.Pebble = Pebble;