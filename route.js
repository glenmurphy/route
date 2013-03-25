var url = require('url');
var EventEmitter = require('events').EventEmitter;

function Route() {
  this.devices = {};
  this.state = {};
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
  obj.on("StateEvent", this.handleStateEvent.bind(this, data.name));
  return obj;
};

Route.prototype.isStateUpdated = function(name, params) {
  if (!(name in this.state))
    return true;

  if (typeof params == "string" || typeof params == "boolean") {
    if (this.state[name] != params)
      return true;
  }
  
  for (var key in params) {
    if (this.state[name][key] != params[key])
      return true;
  }
  return false;
};

Route.prototype.handleStateEvent = function(device_name, event, params) {
  var name = device_name + '.' + event;
  
  if (this.isStateUpdated(name, params)) {
    this.state[name] = params;
    this.handleEvent(device_name, event, params);
  }
};

Route.prototype.handleEvent = function(device_name, event, params) {
  var event_name = device_name + '.' + event;

  // Log the event
  var date = new Date();
  var date_string = date.toLocaleTimeString();
  function pad(str, char, len) {
    return str + new Array(Math.max(len - str.length, 0)).join(char);
  }
  console.log("\n" + pad("-- Event: " + event_name + ":" + (JSON.stringify(params) || "") + ", " + date_string + " ", "-", "70"));

  var matchingEvents = this.allEventsMatchingName(event_name);

  // Spew off commands attached to this event
  for (var i = 0; i < matchingEvents.length; i++) {
    var commands = this.event_map[matchingEvents[i]];
    this.execCommands(commands, params, event_name);
  };
};

Route.prototype.allEventsMatchingName = function(name) {
  var matches = [];
  if (name in this.event_map) matches.push(name);
  for (var event in this.event_map) {
    if (event.indexOf("*") == -1) continue; // Skip plain strings
    var components = event.split("*");
    if (name.indexOf(components[0]) !== 0) continue;
    if (name.indexOf(components[1], name.length - components[1].length) === -1) continue;
    matches.push(event);
  }
  return matches;
};

/**
 * Takes an array of commands, and executes them. Commands can be
 * strings, functions, or more arrays of commands. Within any given
 * array, the special command "Wait.#" will cause a delay of execution
 * of the subsequent commands in that array, which is useful for IR 
 * macros.
 */
Route.prototype.execCommands = function(commands, params, event_name) {
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
      command(params, event_name);
    } catch(e) {
      console.log("!! Error executing custom function: ", e, e.stack);
    }
  } else if (typeof command == "string") {
    var command_info = url.parse(command, true);
    var newparams = command_info.query;
    command = command_info.pathname;



    // Insert passed in parameters for $values in command string.
    for (var key in newparams) {
      if (newparams[key].charAt(0) == "$") {
        newparams[key] = params ? params[newparams[key].substring(1)] : undefined;
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
    this.execCommands(command, params, event_name);
  }

  if (remaining.length)
    setTimeout(this.execCommands.bind(this, remaining, params, event_name), delay);
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
  if (!command || undefined == command) return;
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
