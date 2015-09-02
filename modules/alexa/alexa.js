
// Very simple Alexa Skill Kit for Amazon Echo
// Triggers the Intent name as an event, passing slots as parameters
// Example: "Alexa.GetZodiacHoroscopeIntent" {ZodiacSign:'virgo'}

// To use:
// * Forward port 443 to the port defined below.
// * Generate a SSL certificate 
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

// Create a device with standard values defined
Alexa.createDevice = function(id, name, description, details, isReachable) {
 var device = {"manufacturerName": "n/a", "modelName": "n/a", "version": "1", "isReachable": true, "additionalApplianceDetails": {}};
  device.friendlyName = name;
  device.friendlyDescription = description;
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
  if (namespace === "Discovery" && name === "DiscoverAppliancesRequest") {
    var deviceArray = this.getDevices();
     response = {"header":{"namespace":"Discovery","name":"DiscoverAppliancesResponse","payloadVersion":"1"},
        "payload":{"discoveredAppliances": deviceArray}};
  }
  if (namespace === "Control") {
    if (name === "SwitchOnOffRequest") {
      var action = event.payload.switchControlAction;
      var appliance = event.payload.appliance;
      var applianceId = appliance.applianceId.replace("#", ".");
      var params = appliance.additionalApplianceDetails;
      if (this.debug) console.log("AlexaOnOff:", action, appliance);
      if (action === "TURN_ON") {
        this.emit("DeviceEvent", applianceId + ".On", params);
      } else if (action === "TURN_OFF") {
        this.emit("DeviceEvent", applianceId + ".Off", params);
      }
      response = {"header":{"namespace":"Control","name":"SwitchOnOffResponse","payloadVersion":"1"},"payload":{"success":true}};
    } 
    if (name === "AdjustNumericalSettingRequest") {
      var type = event.payload.adjustmentType;
      var value = event.payload.adjustmentValue;
      var appliance = event.payload.appliance;
      var applianceId = appliance.applianceId.replace("#", ".");
      var params = appliance.additionalApplianceDetails;
      params.value = value;
      if (type === "ABSOLUTE") {
        this.emit("DeviceEvent", applianceId + ".Set." + value, params);
      } else if (type === "RELATIVE") {
        this.emit("DeviceEvent", applianceId + ".Adjust." + value, params);
      }
      if (this.debug) console.log("AlexaNumerical:", applianceId, type, value);
      response = {"header":{"namespace":"Control","name":"AdjustNumericalSettingResponse","payloadVersion":"1"},"payload":{"success":true}}
    }
  }
  if (namespace === "System" && name === "HealthCheckRequest") {
    response = {"header":{"namespace":"System","name":"HealthCheckResponse","payloadVersion":"1"},"payload":{"isHealthy":true,"description":"The system is currently healthy"}};
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

  if (type == "IntentRequest") {
    var eventType = body.request.intent.name;
    var slots = body.request.intent.slots;

    var params = {}
    for (var key in slots) {
       var obj = slots[key];
       params[obj.name] = obj.value;
    }
    params.device = "AmazonEcho"; // Hardcoded for now. There are no unique ids per device
    params.speechCallback = this.speechCallback.bind(this);
    if (this.alexa.debug) console.log("params.RawVoiceString", params.RawVoiceString)
    if (params.RawVoiceString) {
      params.string = params.RawVoiceString;
      this.alexa.voice.handleVoiceInput(params);
    } else {
      this.alexa.emit("DeviceEvent", eventType, params);
    }
  } else if (type == "LaunchRequest") {
      this.alexa.emit("DeviceEvent", "LaunchRequest", {});
  } else if (type == "SessionEndedRequest") {
    this.alexa.endSession(this);
  }
  this.responseTimeout = setTimeout(this.sendResponse.bind(this), 3000);
};

AlexaSession.prototype.speechCallback = function(string, complete) {
  if (this.responseStrings) this.responseStrings.push(string);
  if (complete) this.sendResponse();
}

AlexaSession.prototype.sendResponse = function() {
  clearTimeout(this.responseTimeout);
  var responseJson = {}
  if (this.testRes) responseJson = this.testRes;
  this.sendResponseJson(true, this.responseStrings.join("\n"));
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
  this.res.writeHead(200, {
    'Content-Length': responseJson.length,
    'Content-Type': 'text/plain' });
  this.res.end(responseJson);
  delete this.res;
  if (shouldEndSession) this.alexa.endSession(this);
}


module.exports = Alexa;