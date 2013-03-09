var EventEmitter = require('events').EventEmitter;
var util = require('util');
var snmp = require('net-snmp');

function SNMP(data) {
  this.host = data.host;
  this.traps = data.traps;
  this.session = snmp.createSession ("127.0.0.1", "public");


  var oids = ["1.3.6.1.2.1.1.5.0", "1.3.6.1.2.1.1.6.0"];

  this.session.get (oids, function (error, varbinds) {
    if (error) {
        console.error (error);
    } else {
      for (var i = 0; i < varbinds.length; i++) {
        if (snmp.isVarbindError(varbinds[i])) {
          console.error (snmp.varbindError (varbinds[i]));         
        } else {
          console.log (varbinds[i].oid + " = " + varbinds[i].value);          
        }
      }
    }
  });


  this.session.trap (snmp.TrapType.LinkDown, function (error) {
    if (error)
      console.error (error);
  });
};
util.inherits(SNMP, EventEmitter);

SNMP.prototype.exec = function(command, data) {
  this.log(command);
};

SNMP.prototype.log = function(data) {
  console.log("SNMP LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

exports.SNMP = SNMP;