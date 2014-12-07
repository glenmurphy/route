var EventEmitter = require('events').EventEmitter;
const xmpp = require('node-xmpp');
const request_helper = require('request');
const util = require('util');
//const process = require('process');

function Talk(data) {
  this.host = data.host;
  this.status_message = data.status_message,
  this.jid = data.jid
  this.password = data.password || process.env.bot_password,
  this.host = data.host || "talk.google.com",
  this.port = data.port || 5222,
  this.reconnect = data.reconnect || true
  // this.allow_auto_subscribe = data.allow_auto_subscribe || false,
  this.command_argument_separator = /\s*\;\s*/

  this.conn = new xmpp.Client(this);
  this.conn.socket.setTimeout(0);
  this.conn.socket.setKeepAlive(true, 10000);

  this.conn.on('online', function() {
    this.setStatusMessage(this.status_message);
  }.bind(this));
  this.conn.on('error', function(stanza) { 
      util.log('[error] ' + stanza.toString());
  });

  this.conn.addListener('stanza', this.handleMessage.bind(this));
  process.on('exit', function () {
    console.log("Terminating talk");
    this.conn.end();
  }.bind(this));
};
util.inherits(Talk, EventEmitter);

Talk.prototype.handleMessage = function (stanza) {
  if('error' === stanza.attrs.type) {
      util.log('[error] ' + stanza.toString());
  } else if(stanza.is('message')) {
    var body = stanza.getChildText('body');
    var from = stanza.attrs.from.split("/").shift();

    this.sendMessage(from, "Got it. (" + body + ")");
    this.emit("DeviceEvent", "TextInput", {string:body, from:from});

  }
}

Talk.prototype.sendMessage = function(to, message) {
  var elem = new xmpp.Element('message', { to: to, type: 'chat' })
           .c('body').t(message);
  this.conn.send(elem);
}


Talk.prototype.setStatusMessage = function(status_message) {
   var presence_elem = new xmpp.Element('presence', { })
                               .c('show').t('chat').up()
                               .c('status').t(status_message);
   this.conn.send(presence_elem);
}


Talk.prototype.exec = function(command, data) {
  this.log(command);
};

Talk.prototype.log = function(data) {
  console.log("Talk LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

module.exports = Talk;