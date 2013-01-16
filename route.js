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

var url = require('url');

function Route() {
  this.devices = {};
  this.event_map = {};
}

Route.prototype.addDevice = function(data) {
  if (data.name in this.devices) {
    console.log("ERROR: A device of that type already exists");
    return;
  }

  var obj = new data.type(data.init);
  this.devices[data.name] = obj;
  obj.on("DeviceEvent", this.handleEvent.bind(this, data.name));
  return obj;
};

Route.prototype.handleEvent = function(device_name, event, params) {
  var event_name = device_name + '.' + event;

  // Log the event
  var date = new Date();
  var date_string = date.toLocaleTimeString();
  function pad(str, char, len) {
    return str + new Array(Math.max(len - str.length, 0)).join(char);
  }
  console.log("\n" + pad("-- Event: " + event_name + ", " + date_string + " ", "-", "70"));

  // If we don't have anything that can handle the event, check for wildcard
  if (!(event_name in this.event_map)) {
    var items = event_name.split(".");
    event_name = null;
    for (var other_event in this.event_map) {
      if (other_event.indexOf("*") == -1) continue;
      var other_items = other_event.split(".");
      if (other_items.length != items.length) continue;
      for (var i = 0, valid = true; valid && i < other_items.length && i < items.length; i++)
        valid = other_items[i] == items[i] || other_items[i] == "*";
      if (valid) event_name = other_event;
    }
    if (!event_name) return;
  }

  // Spew off commands attached to this event
  var commands = this.event_map[event_name];
  this.execCommands(commands, params);
};


/**
 * Takes an array of commands, and executes them. Commands can be
 * strings, functions, or more arrays of commands. Within any given
 * array, the special command "Wait.#" will cause a delay of execution
 * of the subsequent commands in that array, which is useful for IR 
 * macros.
 */
Route.prototype.execCommands = function(commands, params) {
  if (!commands) return;

  var command;
  var remaining = [];
  var delay = 1;

  if (typeof commands == 'string' || typeof commands == 'function') {
    command = commands;
  } else {
    command = commands[0];
    if (commands) {
      for (var i = 1; i < commands.length; i++) {
        remaining.push(commands[i]);
      }
    }
  }

  // Figure out what type of command we're getting - if it's a string,
  // or function, we just execute it, if it's an array, we want to
  // fire off an execCommands chain.
  if (typeof command == "function") {
    try {
      command(params);
    } catch(e) {
      console.log("!! Error executing custom function: " + e);
    }
  } else if (typeof command == "string") {
    var command_info = url.parse(command, true);
    var newparams = command_info.query;
    command = command_info.pathname;

    // Insert passed in parameters for $values in command string.
    for (var key in newparams) {
      if (newparams[key].charAt(0) == "$") {
        newparams[key] = params[newparams[key].substring(1)];
      }
    }

    var dot_index = command.indexOf(".");
    if (dot_index == -1 || dot_index == command.length - 1) return;
    var components = command.split(".");
    var device_name = components[0];
    var command = components.splice(1).join(".");

    // Special-case commands.
    if (device_name == "Wait") {
      console.log("*  Waiting: " + command);
      delay = command;
    } else if ((device_name in this.devices)) {
      this.devices[device_name].exec(command, newparams);
    } else {
      console.log("!! Error: "+device_name+" doesn't exist ("+command+")");
    }
  } else if (command.length) {
    console.log(">  Recursing:");
    this.execCommands(command, params);
  }

  if (remaining.length)
    setTimeout(this.execCommands.bind(this, remaining, params), delay);
};

/**
 * Batch load a bunch of event > commands mappings.
 */
Route.prototype.addEventMap = function(map) {
  for (var event_name in map) {
    this.on(event_name, map[event_name]);
  }
};

/**
 * Map an event to a command array - will append to existing command
 * arrays if they exist.
 */
Route.prototype.on = function(event_name, command) {
  if (event_name in this.event_map) {
    if (typeof this.event_map[event_name] == 'string' ||
        typeof this.event_map[event_name] == 'function') {
      this.event_map[event_name] = [this.event_map[event_name], command];
    } else {
      this.event_map[event_name].push(command);
    }
  } else {
    this.event_map[event_name] = command;
  }
}

exports.Route = Route;