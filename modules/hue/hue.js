/*
Copyright 2012 Google Inc. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

var EventEmitter = require('events').EventEmitter;
var http = require('http');
var util = require('util');
var Colors = require("./hue/colors.js").Colors;

function Hue(data) {
  this.host = data.host;
  this.uuid = "13268bf5d1c8d6712b58ac1d342c93";
  this.updateLightsList();
  //this.updateRegistrationState();
};
util.inherits(Hue, EventEmitter);


Hue.prototype.exec = function(command, params) {
    console.log("*  Hue Executing: [" + command + "] : ");
  if (command == "SetLightColor") {
    var colorHex = Colors.name2hex(params.toValue.replace(/ /g,''));
    if (colorHex == 'Invalid Color Name') colorHex = params.toValue;
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
    var h = null, s = null, v = null, ct = params.ct;
    var state = params.state == null ? true : params.state;
    var bulbs = [];
    v = params.bri;
    if (params.toValue) {
      var colorHex = Colors.name2hex(params.toValue.replace(/ /g,''));
      if (colorHex == 'Invalid Color Name') colorHex = params.toValue;
      var hsv = Colors.hex2hsv(colorHex);
      if (!isNaN(hsv.S)) {
        h = hsv.H;
        s = hsv.S/100;
        v = hsv.V/100;
      } else if (params.toValue == "candlelight"){
        ct = 0;
      } else if (params.toValue == "incandescent"){
        ct = 0.4;
      } else if (params.toValue == "florescent"){
        ct = 0.8;
      } else if (params.toValue == "daylight"){
        ct = 1.0;
      }
    }

    if (params.bulbName) {
      for(var key in this.lightNames){
        if(key.match(params.bulbName)) {
          var bulbID = this.lightNames[key];
          if (bulbID) this.setBulbState(bulbID, state, h, s, v, ct, params.duration);
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

Hue.prototype.setBulbState = function(bulbID, state, hue, sat, bri, temp, time) {
  //console.log("*  Hue Executing: [" + bulbID + "] : " + state + hue + sat + bri + temp + time);


 var request = http.request({
      host : this.host,
      path : "/api/" + this.uuid + "/lights/" + bulbID + "/state",
      method: 'PUT'
    }, function(res){
      res.setEncoding('utf8');

      res.on('data', function (chunk) {console.log(chunk);}.bind(this));
  }.bind(this));
  var data = {};

  if (hue != null) data.hue = Math.round(hue * 182.04);
  if (sat != null) data.sat = Math.round(sat * 254);
  if (bri != null) data.bri = Math.round(bri * 254);
  if (time != null) data.transitiontime = Math.round(time * 10);

  // The colour temperature (white only) 154 is the coolest, 500 is the warmest this appears to be measured in Mireds, equivilent to 1000000/T (where T is the temperature in Kelvin) corresponding to around 6500K (154) to 2000K (500)

  if (temp != null) data.ct = Math.round(154 + (1.0 - temp) * 346); // 154 - 500
  if (state != null) data.on = state;
  data = JSON.stringify(data);
  request.write(data);
  request.on('error', function(e) {console.log("Error:" + e.message)});
  request.end();
}

Hue.prototype.updateRegistrationState = function() {
  var request = http.request({
    host : this.host,
    path : "/api",
    method: 'POST'
    }, function(res){
      res.on('data', function (chunk) {
        console.log(JSON.parse(chunk));
        }.bind(this));
      res.on('end', function () {
        }.bind(this));
  }.bind(this));
  request.write(JSON.stringify({username:this.uuid, devicetype: "Automaton"}));
  request.on('error', function(e) {console.log("Error:" + e.message)});
  request.end();

}

Hue.prototype.updateLightsList = function() {
  var request = http.request({
    port : 80,
    host : this.host,
    path : "/api/" + this.uuid + "/lights",
    method: 'GET'
    }, function(res){
      res.on('data', function (chunk) {
        var lights = JSON.parse(chunk);
        this.lightNames = {};
        for (var key in lights) {
          this.lightNames[lights[key].name] = key;
        }
      }.bind(this));
      res.on('end', function () {
  }.bind(this));
  }.bind(this));
  //console.log(request.path)
  request.on('error', function(e) {console.log("Error:" + e.message)});
  request.end();
}


exports.Hue = Hue;