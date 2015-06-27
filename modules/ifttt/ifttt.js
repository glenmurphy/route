var EventEmitter = require('events').EventEmitter;
var util = require('util');
var http = require("http");
var url = require("url");
var Deserializer = require("xmlrpc/lib/deserializer");
var Serializer = require("xmlrpc/lib/serializer");
var querystring = require("querystring");

// Provides a webhook to the WordPress module of IFTTT. Title is emitted as an event
// All other fields are passed as parameters.
// The listening port must be mapped to port 80 on the external ip address
// Use the blog URL http://IP_ADDR/xmlrpc.php


function IFTTT(data) {
  this.port = data.port || 8080;
  this.debug = data.debug;
  this.key = data.key;
  this.server = http.createServer(this.handleRequest.bind(this));
  this.server.once("listening", function () {
    if (this.debug) ("*  IFTTT: listening on port", this.server.address().port);
  }.bind(this));
  this.server.listen(this.port);
}
util.inherits(IFTTT, EventEmitter);


//   curl -X POST -H "Content-Type: application/json" -d '{"value1":"hi","value2":"there","value3":"you"}' https://maker.ifttt.com/trigger/pony/with/key/b6O5Jey3VGLt7c-0z8UIw3
// IFTTT.prototype.exec = function(command, params) {
//   console.log("*  IFTTT Executing: [" + command + "] : " + JSON.stringify(params));
//   var baseURL = "https://maker.ifttt.com/trigger/" + command + "/with/key/" + this.key;
//   var opt = url.parse(options.url);
//   opt.headers = {};
//   opt.method = "GET";
//   opt.contentType = "application/json";
//   opt.data = JSON.stringify(params),
//   opt.success =  function(data, res) {
//       that.success(success, JSON.parse(data), res);
//   };
//   opt.error =  function(data, err, res) {
//       that.error(error, "error adding a playlist", data, err, res);
//   };
  
//   var req = https.request(opt, function(res) {
//         res.setEncoding('utf8');
//         var body = "";
//         res.on('data', function(chunk) {
//             body += chunk;
//         });
//         res.on('end', function() {
//             if(res.statusCode === 200) {
//                 opt.success(body, res);
//             } else {
//                 opt.error(body, null, res);
//             }
//         });
//         res.on('error', function() {
//             opt.error(null, Array.prototype.slice.apply(arguments), res);
//         });
//     });
//     if(typeof opt.data !== "undefined") req.write(options.data);
//     req.end();
// }


IFTTT.prototype.handleRequest = function (request, response) {
  var deserializer = new Deserializer();
  deserializer.deserializeMethodCall(request, function(error, methodName, params) {
    var xml = null;
    if (!error) {
      if (this.debug) ("*  IFTTT deserialized: %s(%s)", methodName, JSON.stringify(params));
      var statusCode = 200, xml = null;
      switch (methodName) {
        case 'mt.supportedMethods': // codex.wordpress.org/XML-RPC_MovableType_API#mt.supportedMethods
          // this is used by IFTTT to verify the site is actually a wordpress blog ;-)
          xml = Serializer.serializeMethodResponse(['metaWeblog.getRecentPosts', 'metaWeblog.newPost']);
          break;
        case 'metaWeblog.getRecentPosts': // codex.wordpress.org/XML-RPC_MetaWeblog_API#metaWeblog.getRecentPosts
          // this is the authentication request from IFTTT
          // send a blank blog response
          // this also makes sure that the channel is never triggered
          xml = Serializer.serializeMethodResponse([]);
          break;
        case 'metaWeblog.newPost': // codex.wordpress.org/XML-RPC_WordPress_API/Posts#wp.newPost
          // This is the actual webhook.  Parameters are provided via fields in IFTTT's GUI.  By convention
          // we put the target URL in the Tags field (passed as mt_keywords).  e.g. params
          // [0, "user", "password", {"title":"...","description":"...","categories":[...],mt_keywords":[webhook url]}]
          params.shift();  // blogid? 
          var username = params.shift();
          var password = params.shift();
          var params = params.shift();
          params.username = username;
          params.password = password;

          this.emit("DeviceEvent", params.title, params);
          xml = Serializer.serializeMethodResponse(Date.now().toString(32)); // a "postid", presumably ignored by IFTTT
          break;
        default:
          error = { faultCode: -32601, faultString: "server error. requested method not found" };
          break;
      }
    }
    if (error) {
      xml = Serializer.serializeFault(error);
    }
    if (xml && statusCode) response.writeHead(statusCode, {'Content-Type': 'text/xml', 'Content-Length': xml.length});
    response.end(xml);
  }.bind(this));
}


module.exports = IFTTT;
