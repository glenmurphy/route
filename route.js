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

Route.prototype.handleEvent = function(device_name, event, data) {
  var event_name = device_name + '.' + event;

  // Log the event
  var date = new Date();
  var date_string = date.toLocaleTimeString();
  function pad(str, char, len) {
    return str + new Array(Math.max(len - str.length, 0)).join(char);
  }
  console.log("\n" + pad("-- Event: " + event_name + ", " + date_string + " ", "-", "70"));

  // If we don't have anything that can handle the event, exit
  if (!(event_name in this.event_map)) return;

  // Spew off commands attached to this event
  var commands = this.event_map[event_name];
  this.execCommands(commands);
};

/**
 * Takes an array of commands, and executes them. Commands can be
 * strings, functions, or more arrays of commands. Within any given
 * array, the special command "Wait.#" will cause a delay of execution
 * of the subsequent commands in that array, which is useful for IR 
 * macros.
 */
Route.prototype.execCommands = function(commands) {
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
      command();
    } catch(e) {
      console.log("!! Error executing custom function: " + e);
    }
  } else if (typeof command == "string") {
    var dot_index = command.indexOf(".");
    if (dot_index == -1 || dot_index == command.length - 1) return;
    var components = command.split(".");
    var device_name = components[0];
    var command = components[1];

    // Special-case commands.
    if (device_name == "Wait") {
      console.log("*  Waiting: " + command);
      delay = command;
    } else if ((device_name in this.devices)) {
      this.devices[device_name].exec(command, components.splice(2));
    } else {
      console.log("!! Error: "+device_name+" doesn't exist ("+command+")");
    }
  } else if (command.length) {
    console.log(">  Recursing:");
    this.execCommands(command);
  }

  if (remaining.length)
    setTimeout(this.execCommands.bind(this, remaining), delay);
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