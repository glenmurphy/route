
// Very simple Alexa Skill Kit for Amazon Echo
// Triggers the Intent name as an event, passing slots as parameters
// Example: "Alexa.GetZodiacHoroscopeIntent" {ZodiacSign:'virgo'}

// To use:
// * Forward port 443 to the port defined below.
// * Generate a SSL certificate https://goo.gl/A6vi9I
// * Create a skill at https://developer.amazon.com/edw/home.html#/
// * Define a schema like:
//   {"intents": [{"intent": "SearchMusic","slots": [{"name": "toValue", "type": "LITERAL"}]}]}
//   and samples like
//   SearchMusic play {Enya|toValue}
//   This will trigger as "Alexa.SearchMusic" with parameters {toValue:"enya"}
// * Alternatively, {"intent": "Command", "slots": [{"name": "RawVoiceString", "type": "LITERAL"}]}
//   will will pass raw strings to the voice module, if set at this.voice 

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var url = require('url');
var fs = require('fs');
var https = require('https');

function Alexa(data) {
  this.mappings = [];
  this.debug = data.debug;
  this.port = data.port || 9099;
  this.testBody = data.IntentRequestTest;
  this.testRes = data.ResponseTest;
  this.voice = data.voice;
  this.responseStrings = [];
  this.devices = data.devices;
  this.sessions = {};
  this.applications = data.applications || {}
  this.waitForContext = data.waitForContext; // Wait briefly for a context to be set 
  this.context = undefined;
  var options = {
      key:  data.key,
      cert: data.cert,
      ca: data.ca
  }
  this.secureServer = https.createServer(options, this.httpReq.bind(this)).listen(this.port);    
};

util.inherits(Alexa, EventEmitter);

Alexa.prototype.httpReq = function(req, res) { 
  var headers = req.headers;
  var body = "";
  req.on('data', function (chunk) { body += chunk; });
  req.on('end', function () {
    if (body.length) {
      body = JSON.parse(body);

      if (this.debug) console.log("Event:", body)
      if (body.session) {
        var sessionId = body.session.sessionId;
        var session = this.sessions[sessionId];
        if (!session) session = this.sessions[sessionId] = new AlexaSession(sessionId, this);
        session.handleReq(req, res, headers, body);        
      } else if (body.header) {
        this.handleLightsReq(req, res, headers, body);  
      }
    } else {
      res.writeHead(200);
      res.end("{}");
    }
  }.bind(this));
}; 

Alexa.CONTEXT_RESET = 3000;
Alexa.CONTEXT_TIMEOUT = 2000;
Alexa.prototype.getContext = function(callback) {
  var startTime = new Date()
  if (this.context || !this.waitForContext) {
    callback(this.context);
  } else {
    this.once('context', function() {
      if (new Date() - startTime > Alexa.CONTEXT_TIMEOUT) {
        console.log("!  Alexa: could not determine context")
        callback(undefined)
      } else {
        console.log("*  Alexa: using context", this.context)
        callback(this.context)
      }
   }.bind(this));     
  }
}

Alexa.prototype.setContext = function(context) {
  clearTimeout(this.contextTimeout);
  this.contextTimeout = setTimeout(this.clearContext.bind(this), Alexa.CONTEXT_RESET);
  this.context = context
  this.emit("context")
  console.log("* ECHO CONTEXT: ", context, new Date())
}

Alexa.prototype.clearContext = function(context) {
  this.context = undefined
  console.log("* CLEAR CONTEXT: ", context, new Date())

}


// Create a device with standard values defined
Alexa.createDevice = function(id, name, description, details, isReachable) {
 var device = {"manufacturerName": "n/a", "modelName": "n/a", "version": "1", "isReachable": true, "additionalApplianceDetails": {}};
  device.friendlyName = name;
  device.friendlyDescription = description;
  device.actions = ["setPercentage", "incrementPercentage", "decrementPercentage", "turnOff", "turnOn"]
  device.applianceId = id.replace(".", "#"); // Periods are not allowed
  if (details) device.additionalApplianceDetails = details;
  if (typeof isReachable !== 'undefined') device.isReachable = isReachable;
  return device;
}

Alexa.prototype.endSession = function(session) {
  delete this.sessions[session.sessionId];
}

//http://login.amazon.com/website
Alexa.prototype.getDevices = function() {
  var devices = this.devices; // devices can be an array or a function
  if (Object.prototype.toString.call(devices) == '[object Function]') {
    devices = devices();
  }
  return devices;
}

Alexa.prototype.handleLightsReq = function(req, res, headers, body) {
  var event = body; 
  var namespace = event.header.namespace;
  var name = event.header.name;
  var response = null;
  if (namespace === "Alexa.ConnectedHome.Discovery" && name === "DiscoverAppliancesRequest") {
    var deviceArray = this.getDevices();
     response = {"header":{"namespace":"Alexa.ConnectedHome.Discovery","name":"DiscoverAppliancesResponse","payloadVersion":"2"},
        "payload":{"discoveredAppliances": deviceArray}};
  }

 if (namespace === "Alexa.ConnectedHome.System" && name === "HealthCheckRequest") {
    response = {"header":{"namespace":"System","name":"HealthCheckResponse","payloadVersion":"2"},"payload":{"isHealthy":true,"description":"The system is currently healthy"}};
  } else if (namespace === "Alexa.ConnectedHome.Control") {
      var appliance = event.payload.appliance;
      var applianceId = appliance.applianceId.replace("#", ".");
      var params = appliance.additionalApplianceDetails;
      if (this.context) params.context = this.context

      var confirmName = undefined
      switch (name) {
        case "TurnOnRequest":
          this.emit("DeviceEvent", applianceId + ".On", params);
          confirmName = "TurnOnConfirmation";
          break;
        case "TurnOffRequest":
          this.emit("DeviceEvent", applianceId + ".Off", params);
          confirmName = "TurnOffConfirmation";
          break;
        case "SetPercentageRequest":
          var value = event.payload.percentageState
          this.emit("DeviceEvent", applianceId + ".Set." + value, params);
          confirmName = "SetPercentageConfirmation";
          break;
        case "IncrementPercentageRequest": 
          var value = event.payload.deltaPercentage.value
          this.emit("DeviceEvent", applianceId + ".Adjust." + value, params);
          confirmName = "IncrementPercentageConfirmation";
          break;
        case "DecrementPercentageRequest": 
          var value = -event.payload.deltaPercentage.value
          this.emit("DeviceEvent", applianceId + ".Adjust." + value, params);
          confirmName = "DecrementPercentageConfirmation";
      }

      response = { "header": {
        "messageId": "a0c739b9-4c12-48c9-88c7-fc2e1f051b0b",
        "name": confirmName,
        "namespace": "Alexa.ConnectedHome.Control",
        "payloadVersion": "2"
    }, "payload": {} }

  }

  var responseJson = JSON.stringify(response);

  if (this.debug) console.log("response", responseJson)
  res.writeHead(200, {
    'Content-Length': responseJson.length,
    'Content-Type': 'text/plain' });
  res.end(responseJson);
}

// Alexa sessions handle most of the logic, usually one or more requests

function AlexaSession(sessionId, alexa) {
  this.sessionId = sessionId;
  this.alexa = alexa;
};

AlexaSession.prototype.handleReq = function(req, res, headers, body) { 
  this.res = res;

  if (this.alexa.debug) console.log("Alexa Request:", body, headers);
  if (!body) {
    this.sendResponse();
    return;
  }

  this.responseStrings = [];
  var type = body.request.type;

  var params = {}
  params.speechCallback = this.speechCallback.bind(this);

  var applicationId = body.session.application.applicationId;
  var applicationName = undefined;
  if (this.alexa.applications) {
    applicationName = this.alexa.applications[applicationId]
  }

  var eventType
  if (type == "IntentRequest") {
    eventType = body.request.intent.name;
    var slots = body.request.intent.slots;
    for (var key in slots) {
       var obj = slots[key];
       params[obj.name] = obj.value;
    }
  } else if (type == "LaunchRequest") {
    eventType = applicationName + ".LaunchRequest";
  } else if (type == "SessionEndedRequest") {
    this.alexa.endSession(this);
  }

  if (eventType) {
    this.alexa.getContext(function(context) {
      if (context) {
        params.device = context;
        params.context = context;
      }
      if (params.RawVoiceString) {
        params.string = params.RawVoiceString;
        this.alexa.voice.handleVoiceInput(params);
      } else {
        this.alexa.emit("DeviceEvent", eventType, params);
      } 
    }.bind(this));
  }

  this.responseTimeout = setTimeout(this.sendResponse.bind(this), 3000);
};



AlexaSession.prototype.speechCallback = function(string, complete) {
  if (this.responseStrings && string) this.responseStrings.push(string);
  if (complete) this.sendResponse();
}

AlexaSession.prototype.sendResponse = function() {
  clearTimeout(this.responseTimeout);
  var responseJson = {}
  if (this.testRes) responseJson = this.testRes;
  var responses = this.responseStrings || []
  this.sendResponseJson(true, responses.join("\n"));
  this.responseStrings = null;
}

AlexaSession.prototype.sendResponseJson = function(shouldEndSession, speech, reprompt, cardTitle, cardContent) {
  var responseJson = { "version": "1.0", response: {}}
  if (speech) responseJson.response.outputSpeech = { "type": "PlainText", "text": speech };
  if (reprompt) responseJson.response.reprompt = {outputSpeech: {"type": "PlainText", "text": reprompt }};
  if (cardTitle & cardContent) responseJson.response.card = {"type": "Simple", "title": cardTitle, "content": cardContent };
  responseJson.response.shouldEndSession = shouldEndSession == true;

  if (this.alexa.debug) console.log("Alexa response:", responseJson);

  responseJson = JSON.stringify(responseJson);
  if (!this.res) {
    "!  Alexa: No response object"
    return;
  }
  this.res.writeHead(200, {
    'Content-Length': responseJson.length,
    'Content-Type': 'text/plain' });
  this.res.end(responseJson);
  delete this.res;
  if (shouldEndSession) this.alexa.endSession(this);
}


module.exports = Alexa;