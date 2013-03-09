String.prototype.camelcase = function() {
    return this.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); }).replace(/ /g, "");
};

// Very simple voice processor
// Converts input of "bake a pie" to "Voice.BakeAPie"
// "the" is discarded
// synonyms are remapped 

var EventEmitter = require('events').EventEmitter;
var util = require('util');

function Voice(data) {
  this.guardPhrase = data.guardPhrase;
  this.listeningTimeout = null;
  this.devices = data.devices;
  this.timeoutDuration = data.timeoutDuration || 10000;
  this.mappings = [];
  this.synonyms = data.synonyms;
  this.route = data.route;
};

util.inherits(Voice, EventEmitter);

Voice.prototype.addMapping = function(mapping) {
  this.mappings.push(mapping);
}

Voice.prototype.exec = function(command, params) {
  if (command == "VoiceInput") {
    this.handleVoiceInput(params);
  }
  else {
    switch (command) {
      case "StartedListening":
        this.startedListening();
        break;
      case "StoppedListening":
        this.stoppedListening();
        break;
    }
  }
};

Voice.prototype.handleVoiceInput = function(params) {
  var context = params.device ? this.devices[params.device] : null;
  delete params.device;
  params.context = context;

  var strings = params.string;
  if (typeof strings === 'string') strings = [strings];
  var scores = params.score;
  if (typeof strings === 'string') scores = [scores];

  if (!strings) return;

  // go through each possible voice string (usually only one)
  // and break after the first succeeds

  for (var i = 0; i < strings.length; i++) {
    var string = strings[i];
    var result = this.normalizeString(string);
    var resultParams = result.params;

    string = result.string;
    if (context) string = context + "." + string; 

    var events = this.route.allEventsMatchingName("Voice." + string);
    console.log(string, events);
    var event = events.shift();
    if (event) {
      this.emit("DeviceEvent", event, resultParams);
      if (params.string == this.guardPhrase) {
        this.startedListening(params);
      } else {
        this.stoppedListening(params);
      }
      break;
    }
  }
}

Voice.prototype.normalizeString = function(string) {
  var splitWords = ["to", "of", "for"];
  var params = {};
  for (var i = 0; i < splitWords.length; i++) {
    var splitString = " " + splitWords[i] + " ";
    var toIndex = string.indexOf(splitString);
    if (toIndex > 0) {
      query = string.substring(toIndex + splitString.length);
      string = string.substring(0, toIndex)
      params[splitWords[i] + "Value"] = query;
    }
  };

    string = string.split(" the ").join(" ") // Ignore "the"

  if (this.synonyms && this.synonyms[string]) {
    string = this.synonyms[string] // Resolve a synonym
    console.log("Using: " + string);
  }
  string = string.camelcase();
  return {string:string, params:params};
}

Voice.prototype.startedListening = function(params) {
  this.emit("DeviceEvent", "StartedListening", params);
  this.emit("StateEvent", {listening: true});
  this.listeningTimeout = setTimeout(this.stoppedListening.bind(this),
                                     this.timeoutDuration);
}

Voice.prototype.stoppedListening = function(params) {
  this.emit("DeviceEvent", "StoppedListening", params);
  this.emit("StateEvent", {listening: false});
  if (this.listeningTimeout) {
    clearTimeout(this.listeningTimeout);
    this.listeningTimeout = null;
  }
}

exports.Voice = Voice;