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

String.prototype.camelcase = function() {
    return this.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); }).replace(/ /g, "");
};

var EventEmitter = require('events').EventEmitter;
var util = require('util');

function Location(data) {
  this.host = data.host;
  this.users = {};
};
util.inherits(Location, EventEmitter);

Location.prototype.exec = function(command, params) {
  if (command == "Update") {
    this.users[params.user] = params;
    this.emit("StateEvent", {locationUsers : this.users});
    var eventDescription = params.user + " " + params.event + " " + params["location"];
    this.emit("DeviceEvent", eventDescription.camelcase());
  }
};

exports.Location = Location;