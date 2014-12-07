var EventEmitter = require('events').EventEmitter;
var util = require('util');

function Phone(data) {
  this.numberOfCalls = 0;
};

util.inherits(Phone, EventEmitter);

Phone.prototype.exec = function(command, params) {
  if (command == "PhoneEvent") {
    this.handlePhoneEvent(params);
  }
};

Phone.prototype.handlePhoneEvent = function(params) {
  var state = params.state;
  
  switch(state) {
    case "CallStarted":
      this.CallStarted();
      break;
    case "CallEnded":
      this.CallEnded();
      break;
  }
};

Phone.prototype.CallStarted = function() {
  this.numberOfCalls += 1;
  console.log("Number of calls in progress: " + this.numberOfCalls);
  this.emit("DeviceEvent", "CallStarted");
};

Phone.prototype.CallEnded = function() {
  this.numberOfCalls -= 1;
  console.log("Number of calls in progress: " + this.numberOfCalls);
  this.emit("DeviceEvent", "CallEnded");
};

//Method for call state

//Method for idle state

module.exports = Phone;