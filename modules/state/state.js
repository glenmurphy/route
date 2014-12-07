var EventEmitter = require('events').EventEmitter;
var util = require('util');

function State(debug) {
  if (debug) this.debug=true;
  this.values = {};
};
util.inherits(State, EventEmitter);

State.prototype.allValues = function () {
	return this.values; 
}

function setValueForKeyPath(object, value, keypath) {
  // All keys are treated as keypaths, allowing sub-element
  // modification for highly noisy sources
  var components = keypath.split(".");
  var parent = object;
  var component;
  while (component = components.shift()) {      
    if (components.length) {
      if (!parent[component]) parent[component] = {};
      parent = parent[component];
    } else if (value != undefined) {
      parent[component] = value;
    } else {
      delete parent[component];
    }
  }
}

State.prototype.setValueForKeyPath = function(value, keypath) {
    setValueForKeyPath(this.values, value, keypath);
}

State.prototype.addValues = function(values) {
  for (var keypath in values) {
    var value = values[keypath];
    this.setValueForKeyPath(value, keypath);
    //this.values[keypath] = value;
  }
  if (this.debug) {
    this.emit("StateEvent", this.allValues());
  } else {
    this.emit("StateEvent", values);
  }

}

module.exports = State;