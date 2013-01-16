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

function Voice(data) {
  this.guardPhrase = data.guardPhrase;
  this.timeout = null;
  this.devices = data.devices;
};

util.inherits(Voice, EventEmitter);

Voice.prototype.exec = function(command, params) {
  if (command == "VoiceInput") {
    var context = this.devices[params.device];
    params.device = null;
    
    var string = params.string;
    if (!string) return;
    var arguments = params;
    var toIndex = string.indexOf(" to ");
    if (toIndex > 0) {
      query = string.substring(toIndex + 4);
      string = string.substring(0, toIndex)
      arguments.toValue = query;
    }

    var ofIndex = string.indexOf(" of ");
    if (ofIndex > 0) {
      query = string.substring(ofIndex + 4);
      string = string.substring(0, ofIndex)
      arguments.ofValue = query;
    }

    string = string.camelcase();

    if (context) string = context + "." + string;

    this.emit("DeviceEvent", string, params);

    if (params.string == this.guardPhrase) {
      this.emit("StateEvent", {listening: true});
      // this.timeout = setTimeout(10000, function () {
      //   this.emit("StateEvent", {listening: false});
      // }.bind(this));
    } else {
      this.emit("StateEvent", {listening: false});
      if (this.timeout) {
        cancelTimeout(this.timeout);
        this.timeout = null;
      }
    }
  } else if (command == "VoiceOutput") {
    
 }
};

exports.Voice = Voice;