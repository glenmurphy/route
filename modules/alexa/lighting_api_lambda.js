//This is a function for use on AWS Lambda to bridge lighting.

// Create a home skill
// Create a lambda function (content below) 
// Information: https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/steps-to-create-a-smart-home-skill

// Setup login with amazon: https://developer.amazon.com/lwa/sp/overview.html
// You may have to create one with a valid return URL:
// something like https://pitangui.amazon.com/api/skill/link/M2NVWMSP5HFVG1

// Add the test skill at: http://alexa.amazon.com/spa/index.html#skills/smartHome

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
