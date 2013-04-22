var url = require('url');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

function Route(data) {
  this.devices = {};
  this.state = {};
  this.eventMap = {};
  this.stateWatchers = {};
}
util.inherits(Route, EventEmitter);

Route.ObjectsEqual = function(x, y) {
  if ( x === y ) return true;
  if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) return false;
  if ( x.constructor !== y.constructor ) return false;
  for ( var p in x ) {
    if ( ! x.hasOwnProperty( p ) ) continue;
    if ( ! y.hasOwnProperty( p ) ) return false;
    if ( x[ p ] === y[ p ] ) continue;
    if ( typeof( x[ p ] ) !== "object" ) return false;
    // if ( ! Object.equals( x[ p ],  y[ p ] ) ) return false;
  }

  for ( p in y ) {
    if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) return false;
  }
  return true;
}

Route.Pad = function(str, char, len) {
  return str + new Array(Math.max(len - str.length, 0)).join(char);
}

Route.prototype.addDevice = function(data) {
  if (data.name in this.devices) {
    console.log("ERROR: A device of that type already exists");
    return;
  }

  var obj = new data.type(data.init);
  this.devices[data.name] = obj;
  obj.on("DeviceEvent", this.handleEvent.bind(this, data.name));
  
  if (data.type.STATEOBSERVER) {
    obj.initStateObserver(this, this.state); // remember, this is a reference
  }

  return obj;
};

Route.prototype.handleEvent = function(deviceName, event, data) {
  var eventName = deviceName + '.' + event;

  // Log the event
  var date = new Date();
  var date_string = date.toLocaleTimeString();
  console.log("\n" + Route.Pad("-- Event: " + eventName + ":" + (JSON.stringify(data) || "") + ", " + date_string + " ", "-", "70"));

  // Spew off commands attached to this event.
  var matchingEvents = this.allEventsMatchingName(eventName);
  for (var i = 0; i < matchingEvents.length; i++) {
    var commands = this.eventMap[matchingEvents[i]];
    this.execCommands(commands, data, eventName);
  };

  // Let any state observers know if anything changed.
  if (!(eventName in this.state) || !Route.ObjectsEqual(this.state[eventName], data)) {
    this.updateState(eventName, data);
  }
};

Route.prototype.updateState = function(name, data) {
  if (!data) 
    var data = {};

  console.log("State Changed: " + name);
  data.stateUpdatedTime = new Date().getTime();
  this.state[name] = data;
  this.emit("StateChanged", name, data);
}

Route.prototype.allEventsMatchingName = function(name) {
  var matches = [];
  if (name in this.eventMap) matches.push(name);
  for (var event in this.eventMap) {
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
Route.prototype.execCommands = function(commands, params, eventName) {
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
      command(eventName, params);
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
    var deviceName = components[0];
    var command = components.splice(1).join(".");

    // Special-case commands.
    if (deviceName == "Wait") {
      console.log("*  Waiting: " + command);
      delay = command;
    } else if ((deviceName in this.devices)) {
      this.devices[deviceName].exec(command, newparams);
    } else {
      console.log("!! Error: "+deviceName+" doesn't exist ("+command+")");
    }
  } else if (command.length) {
    console.log(">  Recursing:");
    this.execCommands(command, params, eventName);
  }

  if (remaining.length)
    setTimeout(this.execCommands.bind(this, remaining, params, eventName), delay);
};

/**
 * Batch load a bunch of event > commands mappings.
 */
Route.prototype.addEventMap = function(map) {
  for (var eventName in map) {
    this.map(eventName, map[eventName]);
  }
};

/**
 * Map an event to a command array - will append to existing command
 * arrays if they exist.
 */
Route.prototype.map = function(eventName, command) {
  if (!command || undefined == command) return;
  if (eventName in this.eventMap) {
    if (typeof this.eventMap[eventName] == 'string' ||
        typeof this.eventMap[eventName] == 'function') {
      this.eventMap[eventName] = [this.eventMap[eventName], command];
    } else {
      this.eventMap[eventName].push(command);
    }
  } else {
    this.eventMap[eventName] = command;
  }
}

exports.Route = Route;
