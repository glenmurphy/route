var EventEmitter = require('events').EventEmitter;
var http = require('http');
var util = require('util');
var crypto = require('crypto');
var Colors = require("./colors.js").Colors;


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
// # Register the username with the Philips Hub.
// $ curl -d "{\"username\": \"${CLIENT_ID}\", \"devicetype\": \"Automaton\"}"" ${HUB_ADDRESS}/api
// 
// Alternatively, uncomment the updateRegistrationState below in the Hue constructor.
//
function Hue(data) {
  this.host = data.host;
  this.uuid = data.uuid; //crypto.createHash('md5').update(data.uuid).digest("hex");
  this.lightNames = {};
  this.lightStates = {};
  this.updateLightsList();
  //this.updateRegistrationState();
};
util.inherits(Hue, EventEmitter);

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
          console.log("* Connected to Hue: authorized username (" + response.success.username + ")");
          this.updateLightsList();
        } else if (response.error.type == 101) {
          console.log("! Could not connect to HUE: Unauthorized. Press button and run again.");
        }
      }.bind(this));   
    }.bind(this));
  request.write(JSON.stringify({username:this.uuid, devicetype: "Automaton"}));
  request.on('error', function(e) {console.log("! Could not connect to HUE (" + e + ")")});
  request.end();
}

Hue.prototype.exec = function(command, params) {
    console.log("*  Hue Executing: [" + command + "] : ");
  if (command == "SetLightColor") {
    var colorHex = Colors.name2hex(params.color.replace(/ /g,''));
    if (colorHex == 'Invalid Color Name') colorHex = params.color;
    console.log("*  Hue Executing: " + command + " : " + colorHex);
    var hsv = Colors.hex2hsv(colorHex);
    console.log(hsv);
      for (var i = 1; i < 4; i++) {
        this.setBulbState(i, true, hsv.H, hsv.S/100, hsv.V/100, null);
      };
  } else if (command == "SimulateSunrise") {

    this.simulateSunrise("2");
  } else if (command == "AllOff") {

    this.allOff();
  } else if (command == "SetLightState") {
    console.log(params);
    var color = null;
    var h = null, s = null, v = params.bri, ct = params.ct;
    var on = params.state == null ? true : params.state;
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

    if (params.bulbName) {
      for(var key in this.lightNames){
        if(key.match(params.bulbName)) {
          var bulbID = this.lightNames[key];
          if (bulbID) this.setBulbState(bulbID, on, h, s, v, ct, params.duration);
        }
      }
    }
  }
};

Hue.prototype.allOff = function () {
  for (var key in this.lightNames) {
    var bulbID = this.lightNames[key];
    this.setBulbState(bulbID, false, null, null, null, null);
  }
}

Hue.prototype.simulateSunrise = function (bulbID) {
  var steps = 500;
  var duration = 20 * 60 * 1000;
  for (var i = 0; i <= 1; i+= 1/steps) {
  setTimeout(function (f){
    console.log("running " + f);
    this.setBulbState(bulbID, true, null, null, f * 1.0, (0.5 - f/2));
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

// hue, sat, brightness, colorTemp are defined from 0.0 to 1.0.
Hue.prototype.setBulbState = function(bulbID, on, hue, sat, brightness, colorTemp, time) {
 var request = http.request({
      host : this.host,
      path : "/api/" + this.uuid + "/lights/" + bulbID + "/state",
      method: 'PUT'
    }, function(res){
      res.setEncoding('utf8');

      res.on('data', function (chunk) {console.log(chunk);}.bind(this));
      this.updateBulbState(bulbID);
  }.bind(this));
  var data = {};

  if (hue != null) data.hue = Math.round(hue * 182.04);
  if (sat != null) data.sat = Math.round(sat * 254);
  if (brightness != null) data.bri = Math.round(brightness * 254);
  if (time != null) data.transitiontime = Math.round(time * 10);

  // The colour temperature (white only) 154 is the coolest, 500 is the warmest this appears to
  // be measured in Mireds, equivilent to 1000000/T (where T is the temperature in Kelvin) 
  // corresponding to around 6500K (154) to 2000K (500)
  if (colorTemp != null) data.ct = Math.round(154 + (1.0 - colorTemp) * 346); // 154 - 500

  if (on != null) data.on = on == 'true';
  console.log(hue);
  data = JSON.stringify(data);
  request.write(data);
  request.on('error', function(e) {console.log("Error:" + e.message)});
  request.end();
}

Hue.prototype.updateLightsList = function() {
  var request = http.request({
    port : 80,
    host : this.host,
    path : "/api/" + this.uuid + "/lights",
    method: 'GET'
    }, function(res) {
      if (res.statusCode == 200) {
        console.log(res.statusCode);
        var body = '';
        res.on('data', function (d) {body += d;});
        res.on('end', function () {
          try {
            var lights = JSON.parse(body);
            var isArray = Object.prototype.toString.apply(lights) === '[object Array]'

            if (isArray && lights[0].error) {
              console.log("* Trying to connect to HUE");
              this.updateRegistrationState();
            } else {
              this.lightNames = {};
              var count = 0;
              for (var key in lights) {
                this.lightNames[lights[key].name] = key;
                this.updateBulbState(key);                
                count++;
              }
              console.log("* HUE connected: " + count + " lights");
            }
           
          } catch (e) {
            console.log("! Hue parse error: " + e);
          }
        }.bind(this));
    }
  }.bind(this));

  request.on('error', function(e) {console.log("! Hue Error: " + e.message)});
  request.end();
}

exports.Hue = Hue;