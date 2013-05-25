var EventEmitter = require('events').EventEmitter;
var util = require('util');
var apns = require('apn');

function APN(data) {
  this.host = data.host;

  this.options = {
    cert: data.cert,                  /* Certificate file path */
    certData: null,                   /* String or Buffer containing certificate data, if supplied uses this instead of cert file path */
    key:  data.key,                   /* Key file path */
    keyData: null,                    /* String or Buffer containing key data, as certData */
    passphrase: this.passphrase,      /* A passphrase for the Key file */
    ca: null,                         /* String or Buffer of CA data to use for the TLS connection */
    gateway: data.gateway || 'gateway.push.apple.com',/* gateway address */
    port: 2195,                       /* gateway port */
    enhanced: true,                   /* enable enhanced format */
    errorCallback: this.connectionError,         /* Callback when error occurs function(err,notification) */
    cacheLength: 100                  /* Number of notifications to cache for error purposes */
  };

  this.apnsConnection = new apns.Connection(this.options);
  this.users = data.users;
  //Next, create a notification object and set parameters. See the payload documentation for more details.

};

util.inherits(APN, EventEmitter);
APN.prototype.connectionError = function(err, notification) {
  console.log("!  ERROR sending APN", err, notification);
}

APN.prototype.exec = function(command, params) {
  if (command == "Push") {
    var token = this.users[params.user];
    var note = new apns.Notification();
    note.device = new apns.Device(token);
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
    if (params.sound) note.sound = params.sound;
    if (params.msg) note.alert = params.msg;
    if (params.url) note.payload = {'url': params.url};
    this.apnsConnection.sendNotification(note);
  } else {
    this.log(command);    
  }
};

APN.prototype.log = function(data) {
  console.log("DUMMY LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

exports.APN = APN;