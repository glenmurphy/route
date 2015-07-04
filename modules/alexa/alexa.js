
// Very simple Alexa Skill Kit for Amazon Echo
// Triggers the Intent name as an event, passing slots as parameters
// Example: "Alexa.GetZodiacHoroscopeIntent" {ZodiacSign:'virgo'}

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var url = require('url');
var fs = require('fs');
var https = require('https');

function Alexa(data) {
  this.mappings = [];
  this.port = data.port || 9099;
  this.testBody = data.IntentRequestTest;
  this.testRes = data.ResponseTest;
  this.voice = data.voice;
  this.responseStrings = ["Test"];
  this.sessions = {};
  var options = {
      key: fs.readFileSync(data.key || __dirname + "/key.pem"),
      cert: fs.readFileSync(data.cert || __dirname + "/cert.pem"),
  }
  this.secureServer = https.createServer(options, this.httpReq.bind(this)).listen(this.port);    
};

util.inherits(Alexa, EventEmitter);

Alexa.prototype.httpReq = function(req, res) { 
  var headers = req.headers;
  var body = "";
  req.on('data', function (chunk) { body += chunk; });
  req.on('end', function () {
    body = JSON.parse(body);
    var sessionId = body.session.sessionId;
    var session = this.sessions[sessionId];
    if (!session) session = this.sessions[sessionId] = new AlexaSession(sessionId, this);
    session.handleReq(req, res, headers, body);
  }.bind(this));
}; 

Alexa.prototype.endSession = function(session) {
  delete this.sessions[session.sessionId];
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
    console.log("params.RawVoiceString", params.RawVoiceString)
    if (params.RawVoiceString) {
      params.string = params.RawVoiceString;
      this.voice.handleVoiceInput(params);
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
  this.sendResponseJson(false, this.responseStrings.join("\n"));
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