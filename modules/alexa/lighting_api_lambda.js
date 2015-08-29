//This is a function for use on AWS Lambda to bridge lighting.
//
// You also need to submit a request per https://developer.amazon.com/public/binaries/content/assets/html/alexa-lighting-api.html

// Skill adapter display name
// Route.io

// Skill adapter description
// Control route.io devices

// AWS Lambda function name
// (something like arn:aws:lambda:us-east-1:XXXXXXXXXX:function:automatonBridge)

// OAuth Client ID
// amzn1.application-oa2-client.a119ff41c4074715ae3c7fabb7d8295a

// OAuth Client Secret
// 27672e57489a523f1d8c4b1c2ff918e1cc96f1a5452f2679d32dadab2c368eb2

// OAuth Scope
// profile

// OAuth authorization URL
// https://www.amazon.com/ap/oa

// OAuth token URL
// https://api.amazon.com/auth/o2/token

// Amazon Customer ID
// (get from https://amazon.com/profile (id will be appened))



exports.handler = function(event, context) {
    var eventJson = JSON.stringify(event);
    var options = {
        host: '[IP_ADDR]', port: 443, path: '/alexa-lighting', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(eventJson)},
        rejectUnauthorized: false
    };
    
    var req = require('https').request(options, function(res) {
        res.on('data', function (data) {res.data = (res.data || "") + data});
        res.on('end', function() { context.succeed(JSON.parse(res.data));});
    });
    req.on('error', function(e) { context.fail(e);});
    req.write(eventJson);
    req.end();
};
