String.prototype.camelcase = function() {
    return this.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); }).replace(/ /g, "");
};

// Very simple voice processor
// Converts input of "bake a pie" to "Voice.BakeAPie"
// "the" is discarded
// synonyms are remapped 

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var url = require('url');
var http = require('http');

function Voice(data) {
  this.guardPhrase = data.guardPhrase;
  this.listeningTimeout = null;
  this.devices = data.devices;
  this.timeoutDuration = data.timeoutDuration || 10000;
  this.mappings = [];
  this.synonyms = data.synonyms;
  this.route = data.route;
  this.port = data.port || 9001
  this.server = http.createServer(this.httpReq.bind(this)).listen(this.port);
  this.lastEvent = null;
};

util.inherits(Voice, EventEmitter);


Voice.prototype.httpReq = function(req, res) {
  var info = url.parse(req.url, true);
  this.handleVoiceInput(info.query);
  res.writeHead(200);
  res.end();
};


Voice.prototype.addMapping = function(mapping) {
  this.mappings.push(mapping);
}

Voice.prototype.exec = function(command, params) {
  if (command == "VoiceInput") {
    this.handleVoiceInput(params);
  } else {
    switch (command) {
      case "StartedListening":
        this.startedListening(params);
        break;
      case "StoppedListening":
        this.stoppedListening(params);
        break;
    }
  }
};


Voice.prototype.handleVoiceInput = function(params) {
  var context = params.device ? this.devices[params.device] : null;
  delete params.device;
  params.context = context;

  if (params.action == "started"
      || params.string == this.guardPhrase) {
      this.startedListening(params);
    return;
  }

  if (params.action == "stopped") {
    this.stoppedListening(params);
    return;
  }

  var strings = params.string;
  if (typeof strings === 'string') strings = [strings];
  var scores = params.score;
  if (typeof strings === 'string') scores = [scores];

  if (!strings) return;

  // go through each possible voice string (usually only one)
  // and break after the first succeeds

  var matched = false;
  for (var i = 0; i < strings.length; i++) {
    var string = strings[i].toLowerCase();
    var originalString = string;
    var result = this.normalizeString(string);
    var resultParams = result.params;

    string = result.string;
    if (context) {
      string = context + "." + string;
      resultParams.context = context;
    }

    var events = this.route.allEventsMatchingName("Voice." + string);
    console.log("Voice." + string + ":", events);
    var event = events.shift();
    if (event) {
      if (this.lastEvent != string) { // Ignore repeated events within one second (handle multiple listeners)
        this.emit("DeviceEvent", string, resultParams);
        this.lastEvent = string;
        resultParams.recognizedString = originalString;
        if (this.lastEventTimeout) clearTimeout(this.lastEventTimeout);
        this.lastEventTimeout = setTimeout(function (){ this.lastEvent = null }.bind(this), 1000);
      } else {
        console.log('ignoring duplicate event', string);
      }
      matched = true;
      break;
    }
  }

  if (!matched) {
    string = resultParams.recognizedString = strings.shift();
    if (this.lastEvent != string) { // Ignore repeated events within one second (handle multiple listeners)
      this.emit("DeviceEvent", "NoMatch", resultParams);
      this.lastEvent = string;
      if (this.lastEventTimeout) clearTimeout(this.lastEventTimeout);
      this.lastEventTimeout = setTimeout(function (){ this.lastEvent = null }.bind(this), 1000);
    }
  }

  this.emit("StateEvent", {lastVoiceString: resultParams.recognizedString});

  // Any input triggers stoppedListening
  this.stoppedListening(params);
}

Voice.prototype.normalizeString = function(string) {
  var splitWords = ["to", "for"];
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
  this.listening = true;
  this.emit("DeviceEvent", "StartedListening", params);
  this.emit("StateEvent", {listening: true});
  if (!this.listeningTimeout)
    this.listeningTimeout = setTimeout(this.stoppedListening.bind(this),
                                     this.timeoutDuration, params);
}

Voice.prototype.stoppedListening = function(params) {
  if (this.listeningTimeout) {
    clearTimeout(this.listeningTimeout);
    this.listeningTimeout = null;
  }

  if (!this.listening) return;

  this.listening = false;
  this.emit("DeviceEvent", "StoppedListening", params);
  this.emit("StateEvent", {listening: false});
}

exports.Voice = Voice;