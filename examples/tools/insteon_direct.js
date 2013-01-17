var net = require('net');
var readline = require('readline');

function InsteonDirect(host) {
  this.host = host;
  this.rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal : true
  });
  this.rl.setPrompt("> ");
  this.rl.on("line", this.handleInput.bind(this));
  this.connect();
}

InsteonDirect.PORT = 9761;

InsteonDirect.prototype.connect = function() {
  this.reconnecting_ = false;
  this.client = net.connect({
    host : this.host,
    port : InsteonDirect.PORT
  }, this.handleConnected.bind(this));
  this.client.on('data', this.handleData.bind(this));
  this.client.on('error', this.handleError.bind(this));
};

InsteonDirect.prototype.reconnect = function() {
  if (this.reconnecting_) return;

  this.reconnecting_ = true;
  setTimeout(this.connect.bind(this), 1000);
}

InsteonDirect.prototype.handleConnected = function() {
  console.log("Insteon Connected\n");
};

InsteonDirect.prototype.handleInput = function(data) {
  try {
    data = new Buffer(data, "hex");
    this.client.write(data);
  } catch(e) {
    console.log("Bad input");
  }
};

InsteonDirect.prototype.handleData = function(data) {
  try {
    data = new Buffer(data).toString("hex").toUpperCase();
  } catch(e) {
    console.log("*** Bad Data");
  }
  console.log("RECV." + data);
};

InsteonDirect.prototype.handleError = function(err) {
  this.rl.write("*** ERROR ***\n");
};

new InsteonDirect("10.0.1.120");