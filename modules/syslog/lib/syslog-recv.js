/*
 * syslog-server.js
 *
 * @version 0.1.0
 * @author Frank Grimm (http://frankgrimm.net)
 *
 */

exports.getServer = function(bind_port, bind_ip, callback) {

  // bind parameters
  var bindip = bind_ip || undefined;
  var bindport = bind_port || 514;
  
  // default callback
  var callthis = function(msgobject) {
  	console.log(require("sys").inspect(msgobject));
  }
  
  if (typeof callback == "function") {
  	callthis = callback;
  }
  
  var dgram = require("dgram");
  var syslog = require("./syslog-messages");
  var server = dgram.createSocket("udp4");
  
  server.on("message", function (msg, rinfo) {
  	syslog.decodeMessage(msg.toString('ascii'), function(receivedMsg) {
  		// attach connection information to the received message
  		receivedMsg.rinfo = rinfo;
  		callthis(receivedMsg);
  	});
  }).on("listening", function () {
    var address = server.address();
  }).bind(bindport, bindip); // bind 514:UDP on all interfaces
}
