var EventEmitter = require('events').EventEmitter;
var http = require('http');
var util = require('util');
var xml2js = require('xml2js');
var crypto = require('crypto');
var Colors = require("./colors.js").Colors;

try { // SSDP is optional. If present, will scan.
  var ssdp = require('node-ssdp');
} catch (e) {}

// Control for the Philips Hue (and LivingColors) lights
//
// To update the registration state, press the hub button, then run the 
// following in the terminal:
// 
// # Determine the IP address of your hub, set it here.
// $ export HUB_ADDRESS=http://192.168.1.4
//
// # Create a unique client ID
// $ export CLIENT_ID=$(uuidgen | sed -e s/\-//g)
// $ echo $CLIENT_ID
// 
// # Register the username with the Philips Hub. Use this for the 'UUID' field when adding the device. 
// $ curl -d "{\"devicetype\": \"Automaton\"}" ${HUB_ADDRESS}/api
// 
// Alternatively, uncomment the updateRegistrationState below in the Hue constructor.
//
function Hue(data) {
  this.host = data.host;
  this.uuid = data.uuid || "13268bf5d1c8d6712b58ac1d342c93"; //crypto.createHash('md5').update(data.uuid).digest("hex");
  this.lightNames = {};
  this.lightStates = {};
  this.requestQueue = [];
  this.debug = data.debug;
  this.discoveredIps = [];

  if (data.host) {
    this.addBridge(data.host);
  } else {
    this.scanForBridges();
  }
  //this.updateRegistrationState();
};
util.inherits(Hue, EventEmitter);

Hue.prototype.addBridge = function(host) {
  console.log("*  Adding Hue:", host)
  this.host = host;
  this.updateLightsList();
}

Hue.UPNP_URN = 'upnp:rootdevice';
Hue.prototype.scanForBridges = function() {
  if (!ssdp) return;
  console.log("Scanning for hue");
  var client = new ssdp.Client();
  var timeout;
  client.on('response', function (headers, statusCode, rinfo) {
    var host = rinfo.address;
    if (this.discoveredIps.indexOf(host) == -1) {
      this.discoveredIps.push(host);
      var location = headers["LOCATION"];

      var req = http.get(location, function(res) {
        res.on('data', function (data) {res.data = (res.data || "") + data}), 
        res.on('end', function() {
          var parser = new xml2js.Parser();
          parser.parseString(res.data, function (err, result) {
            var modelName = result.root.device[0].modelName[0];
            var isHue = modelName.indexOf("Philips hue bridge") > -1;
            if (isHue) this.addBridge(host);
          }.bind(this));
        }.bind(this));
      }.bind(this));
      req.on('error', function(e) {
        console.log('! Hue', this.name, e.message);
      }.bind(this));
    }
  }.bind(this));

  // search periodcally
  function scanDevices() {
    console.log("Scanning for players");
    client.search(Hue.UPNP_URN);
    clearTimeout(timeout);
    // timeout = setTimeout(scanDevices, 5 * 60 * 1000);
  }
  scanDevices()
}



// Register the uuid as a new user of the Philips Hub.
Hue.prototype.updateRegistrationState = function() {
  var request = http.request({
    host : this.host,
    path : "/api",
    method: 'POST'
    }, function(res) {
      var body = ''
      res.on('data', function (d) {body += d;});
      res.on('end', function () {
        var response = JSON.parse(body)[0];
        if (response.success) {
          console.log("*  Connected to Hue: authorized username (" + response.success.username + ")");
          this.updateLightsList();
        } else if (response.error.type == 101) {
          console.log("!  Could not connect to HUE: Unauthorized. Press button and run again.");
        }
      }.bind(this));   
    }.bind(this));
  request.write(JSON.stringify({username:this.uuid, devicetype: "Automaton"}));
  request.on('error', function(e) {console.log("!  Could not connect to HUE (" + e + ")")});
  request.end();
}

Hue.prototype.exec = function(command, params) {
  console.log("*  Hue Executing: [" + command + "] : " + JSON.stringify(params));
  if (command == "SetLightColor") {
    var colorHex = Colors.name2hex(params.color.replace(/ /g,''));
    if (colorHex == 'Invalid Color Name') colorHex = params.color;
    console.log("*  Hue Executing: " + command + " : " + colorHex);
    var hsv = Colors.hex2hsv(colorHex);
    for (var i = 1; i < 4; i++) {
      this.setBulbState(i, {on:true, hue:hsv.H, sat:hsv.S/100, bri:hsv.V/100});
    };
  } else if (command == "SimulateSunrise") {

    this.simulateSunrise("2");
  } else if (command == "AllOff") {

    this.allOff();
  } else if (command == "SetLightState") {
    var color = null;
    var h = null, s = null, v = params.bri, ct = params.ct;
    var on = params.state == null ? true : params.state;
    var effect = params.effect;
    var alert = params.alert;
    var bulbs = [];
    if (params.color) {
      var colorHex = Colors.name2hex(params.color.replace(/ /g,''));
      if (colorHex == 'Invalid Color Name') colorHex = params.color;
      var hsv = Colors.hex2hsv(colorHex);
      if (!isNaN(hsv.S)) {
        h = hsv.H;
        s = hsv.S/100;
        v = hsv.V/100;
      } else if (params.color == "candlelight"){
        ct = 0;
      } else if (params.color == "incandescent"){
        ct = 0.4;
      } else if (params.color == "florescent"){
        ct = 0.8;
      } else if (params.color == "daylight"){
        ct = 1.0;
      }
    }

    var matches = this.bulbsMatchingName(params.bulbName);

    for (var i = 0; i < matches.length; i++) {
      var bulbID = matches[i];
      if (bulbID) this.setBulbState(bulbID, {on:on, hue:h, sat:s, bri:v, colorTemp:ct, time:params.duration, effect:effect, alert:alert});
    };
  } else if (command == "ToggleLightState") {
    var matches = this.bulbsMatchingName(params.bulbName);

    for (var i = 0; i < matches.length; i++) {
      var bulbID = matches[i];
      if (bulbID) this.toggleBulbState(bulbID, {});
    };
  }
};

Hue.prototype.bulbsMatchingName = function(name) {
  var matches = [];
  if (name) {
    for(var key in this.lightNames){
      if(key.match(name)) {
        var bulbID = this.lightNames[key];
      matches.push(bulbID);
      }
    }
  }
  return matches;
}

Hue.prototype.allOff = function () {
  for (var key in this.lightNames) {
    var bulbID = this.lightNames[key];
    this.setBulbState(bulbID, {on:false});
  }
}

Hue.prototype.simulateSunrise = function (bulbID) {
  var steps = 500;
  var duration = 20 * 60 * 1000;
  for (var i = 0; i <= 1; i+= 1/steps) {
  setTimeout(function(f){
    this.setBulbState(bulbID, {on:true, bri:f * 1.0, colorTemp:(0.5 - f/2)});
    }.bind(this,i), i * duration);
  console.log(i * duration);
  }
}

Hue.prototype.log = function(data) {
  console.log("HUE LOG:" + data);
  this.emit("DeviceEvent", "Logged");
}

// Updates the bulb state and emits a state change event.
//
// {
//     "state": {
//         "on": false,                 // true if the light is on, false if off
//         "bri": 240,                  // brightness between 0-254 (NB 0 is not off!)
//         "hue": 15331,                // hs mode: the hue (expressed in ~deg*182) - see note below
//         "sat": 121,                  // hs mode: saturation between 0-254
//         "xy": [0.4448, 0.4066],      // xy mode: CIE 1931 colour co-ordinates
//         "ct": 343,                   // ct mode: colour temp (expressed in mireds range 154-500)
//         "alert": "none",             // 'select' flash the lamp once, 'lselect' repeat flash
//         "effect": "none",            // not sure what this does yet
//         "colormode": "ct",           // the current colour mode (see above)
//         "reachable": true            // whether or not the lamp can be seen by the hub
//     },
//     "type": "Extended color light",  // type of lamp (all "Extended colour light" for now)
//     "name": "Hue Lamp 1",            // the name as set through the web UI or app
//     "modelid": "LCT001",             // the model number of the lamp (all are LCT001)
//     "swversion": "65003148",         // the software version of the lamp
//     "pointsymbol": { }               // not sure what this does yet
//     }
// }
Hue.prototype.updateBulbState = function(bulbID) {
  var request = http.request({
    host: this.host,
    path: '/api/' + this.uuid + '/lights/' + bulbID,
    method: 'GET',
  }, function(res) {
    var body = '';
    res.on('data', function (d) {body += d;});
    res.on('end', function () {
      try {
        this.lightStates[bulbID] = JSON.parse(body);        
      } catch (e) {
        console.log('! Unable to parse bulb state for ' + bulbID + ' ' + body);
      }
      this.emit("StateEvent", {"hueLights": this.lightStates});        
    }.bind(this));
  }.bind(this));

  request.on('error', function(e) {console.log("Error:" + e.message)});
  request.end();
};

Hue.prototype.sendRequest = function(request) {
  this.requestQueue.push(request);
  if (this.requestQueue.length == 1)
    process.nextTick(this.sendNextRequest.bind(this));
};

Hue.prototype.sendNextRequest = function() {
  if (!this.requestQueue.length) return;
  var requestInfo = this.requestQueue.shift();
  if (this.debug) console.log("D  Hue sending event:", JSON.stringify(requestInfo));
  //setTimeout(this.sendNextRequest.bind(this), 200); 
  if (!requestInfo.bulbID) {
    console.log("!  Hue: missing bulb id");
    return;
  }
  var request = http.request({
      host : this.host,
      path : "/api/" + this.uuid + "/lights/" + requestInfo.bulbID + "/state",
      method: 'PUT'
    }, function(res){
      res.setEncoding('utf8');
      res.data = "";
      res.on('data', function (chunk) {res.data += chunk;}.bind(this));
      res.on('end', function () {
        var response = res.data;
        if (this.debug) console.log("D  Hue <", response);
        response = JSON.parse(response);
        var retry = false;
        for (var i in response) {
          var item = response[i];
          if (item.error) {
            if (item.error.type == "201") continue; // Bulb is off
            console.log("!  Hue error " + item.error.type + ":", item.error.description, "\n  ", item.error.address);
            if (item.error.type == "901") retry = true; // Bridge error
          } else {
            
          }
        }
        if (retry && !(requestInfo.tries > 5)) {
          console.log("retrying", requestInfo);
          requestInfo.tries = (requestInfo.tries || 0) + 1;
          this.requestQueue.unshift(requestInfo);
        }
        setTimeout(this.sendNextRequest.bind(this), retry ? 300 : 100); 

      }.bind(this));
      this.updateBulbState(requestInfo.bulbID);
  }.bind(this));
  request.on('error', function(e) {
    console.log("!  Hue error:" + e.message);
  });
  request.write(JSON.stringify(requestInfo.data));
  request.end(); 
};

Hue.prototype.requestSent = function(response) {

};

// Toggle bulb state
Hue.prototype.toggleBulbState = function(bulbID, values) {

  console.log("Toggle: ", bulbID);
 
  if (!Number(bulbID)) bulbID = this.lightNames[bulbID];
  var requestInfo = {};
  requestInfo.bulbID = bulbID;

  // Swap bulb on state
  var data = {};
  data.on = !(this.lightStates[bulbID].state.on);
  requestInfo.data = data;
  
  if (values.delay) {
    setTimeout(this.sendRequest.bind(this, requestInfo), values.delay * 1000);
  } else {
    this.sendRequest(requestInfo);
  }
}

// hue, sat, brightness, colorTemp are defined from 0.0 to 1.0.
Hue.prototype.setBulbState = function(bulbID, values) {
  if (!Number(bulbID)) bulbID = this.lightNames[bulbID];
  var requestInfo = {};
  requestInfo.bulbID = bulbID;

  var data = {};
  if (values.on != null) data.on = (values.on == 'true' || values.on == true);
  if (values.hue != null) data.hue = Math.round((values.hue % 360) * 182.04);
  if (values.sat != null) data.sat = Math.round(values.sat * 254);
  if (values.bri != null) data.bri = Math.round(values.bri * 254);
  if (values.time != null) data.transitiontime = Math.round(values.time * 10);
  if (values.effect != null) data.effect = values.effect;

  // The colour temperature (white only) 154 is the coolest, 500 is the warmest this appears to
  // be measured in Mireds, equivilent to 1000000/T (where T is the temperature in Kelvin) 
  // corresponding to around 6500K (154) to 2000K (500)
  if (values.colorTemp != null) data.ct = Math.round(154 + (1.0 - values.colorTemp) * 346); // 154 - 500

  requestInfo.data = data;

  if (values.delay) {
    setTimeout(this.sendRequest.bind(this, requestInfo), values.delay * 1000);
  } else {
    this.sendRequest(requestInfo);
  }
}

Hue.prototype.updateLightsList = function() {
  var request = http.request({
    port : 80,
    host : this.host,
    path : "/api/" + this.uuid + "/lights",
    method: 'GET'
    }, function(res) {
      if (res.statusCode == 200) {
        var body = ''; 
        res.on('data', function (d) {body += d;});
        res.on('end', function () {
          try {
            var lights = JSON.parse(body);
            var isArray = Object.prototype.toString.apply(lights) === '[object Array]'

            if (isArray && lights[0].error) {
              console.log("*  Trying to connect to HUE");
              this.updateRegistrationState();
            } else {
              this.lightNames = {};
              var count = 0;
              for (var key in lights) {
                this.lightNames[lights[key].name] = key;
                this.updateBulbState(key);                
                count++;
              }
                      if (this.debug) console.log(this.lightNames);

              this.emit("DeviceEvent", "Connected");
            }
           
          } catch (e) {
            console.log("!  Hue parse error: " + e);
          }
        }.bind(this));
    }
  }.bind(this));

  request.on('error', function(e) {console.log("!  Hue:\t\t" + e)});
  request.end();
}

module.exports = Hue;
