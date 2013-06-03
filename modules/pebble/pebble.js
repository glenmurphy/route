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
  this.ids = data.ids;
  this.server = http.createServer(this.httpReq.bind(this)).listen(this.port);
};
util.inherits(Pebble, EventEmitter);


Pebble.prototype.httpReq = function(req, res) {
  var id = req.headers['x-pebble-id'];
  var device = this.ids[id];
  if (device) {
    var info = url.parse(req.url, true);
    var action = info.path.substring(1);

    if (req.method == "POST") {
      req.setEncoding('utf8');
      req.data = "";
      req.on('data', function(chunk) { req.data += chunk; });
      req.on('end', function() {
        this.emit("DeviceEvent", device + "." + action, JSON.parse(req.data));
        var resData = {1 : "Success"};
        res.writeHead(200);
        res.write(JSON.stringify(resData));
        console.log(JSON.stringify(resData));
        res.end();
      }.bind(this));
    }
  } else {
    res.writeHead(200);
    res.end();
  }
};

Pebble.prototype.exec = function(command, params) {
};

exports.Pebble = Pebble;