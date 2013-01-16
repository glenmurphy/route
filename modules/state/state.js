/*
Copyright 2012 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var EventEmitter = require('events').EventEmitter;
var util = require('util');

var values = {};
function State() {
  this.values = {};
};
util.inherits(State, EventEmitter);

State.prototype.allValues = function () {
	return this.values; 
}

State.prototype.addValues = function(newValues) {
	for (var attrname in newValues) {
    //console.log(attrname + " set to " + newValues[attrname]);
		this.values[attrname] = newValues[attrname];
	}
	this.emit("StateEvent", newValues);
}

exports.State = State;