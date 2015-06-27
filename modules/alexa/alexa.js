
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
  console.log(__dirname);
  var options = {
      key: fs.readFileSync(data.key || __dirname + "/key.pem"),
      cert: fs.readFileSync(data.cert || __dirname + "/cert.pem"),
  }
  this.secureServer = https.createServer(options, this.httpReq.bind(this)).listen(this.port);    
};

util.inherits(Alexa, EventEmitter);


Alexa.prototype.httpReq = function(req, res) { 
  var headers = req.headers;
  var sig = headers.Signature;
  var sigCert = headers.SignatureCertChainUrl;

  var body = "";
  req.on('data', function (chunk) { body += chunk; });
  req.on('end', function () {
    if (this.testBody) body = this.testBody;
    var response = this.handleReq(req, res, headers, body);
    res.writeHead(200);
    if (response) response = JSON.stringify(response);
    res.end(response);
  }.bind(this));
}; 

Alexa.prototype.handleReq = function(req, res, headers, body) { 
  var type = body.request.type;

  if (type == "IntentRequest") {
    var eventType = body.request.intent.name;
    var slots = body.request.intent.slots;

    var params = {}
    for (var key in slots) {
       var obj = slots[key];
       params[obj.name] = obj.value;
    }

    this.emit("DeviceEvent", eventType, params);
  }
  var responseJson = {}
  if (this.testRes) responseJson = this.testRes;
  return responseJson;
};

//if (require.main === module) { new Alexa({IntentRequestTest:{"version":"1.0","session":{"new":false,"sessionId":"amzn1.echo-api.session.0000000-0000-0000-0000-00000000000","application":{"applicationId":"amzn1.echo-sdk-ams.app.000000-d0ed-0000-ad00-000000d00ebe"},"attributes":{"supportedHoroscopePeriods":{"daily":true,"weekly":false,"monthly":false}},"user":{"userId":"amzn1.account.AM3B00000000000000000000000"}},"request":{"type":"IntentRequest","requestId":" amzn1.echo-api.request.0000000-0000-0000-0000-00000000000","timestamp":"2015-05-13T12:34:56Z","intent":{"name":"GetZodiacHoroscopeIntent","slots":{"ZodiacSign":{"name":"ZodiacSign","value":"virgo"}}}}},ResponseTest: {"version":"1.0","sessionAttributes":{"supportedHoriscopePeriods":{"daily":true,"weekly":false,"monthly":false}},"response":{"outputSpeech":{"type":"PlainText","text":"Today will provide you a new learning opportunity.  Stick with it and the possibilities will be endless. Can I help you with anything else?"},"card":{"type":"Simple","title":"Horoscope","content":"Today will provide you a new learning opportunity.  Stick with it and the possibilities will be endless."},"reprompt":{"outputSpeech":{"type":"PlainText","text":"Can I help you with anything else?"}},"shouldEndSession":false}}});};

module.exports = Alexa;