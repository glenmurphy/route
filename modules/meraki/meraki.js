var EventEmitter = require('events').EventEmitter;
var util = require('util');
var http = require('http');
var url = require('url');
var brain = require('brain');


function Meraki(data) {
  this.listenPort = data.port || 9011;
  this.secret = data.secret;
  this.validator = data.validator;
  this.devices = data.devices;
  this.coordinates = data.coordinates;
  this.beacons = data.beacons;
  this.dimensions = data.dimensions;
  this.nexii = data.nexii;
  this.pixelsPerMeter = data.pixelsPerMeter;
  this.lastBeacon = {};
  this.updateCount = 0;
  this.info = {};

  for (var nexus in this.nexii) {
    this.nexii[nexus].x = this.nexii[nexus].x / this.dimensions.x;
    this.nexii[nexus].y = this.nexii[nexus].y / this.dimensions.y;
  }
  this.debug = data.debug;
  this.server = http.createServer(this.handleReq.bind(this)).listen(this.listenPort);
  this.net = new brain.NeuralNetwork();
  this.ignoredDevices = [];
};
util.inherits(Meraki, EventEmitter);

Meraki.prototype.handleProbe = function(probe) {
  this.updateCount++;
  // if (this.debug) console.log("Probe info:", new Date());
  for (var item in probe) {
    this.handleProbeItem(probe[item]);
  }
  this.updateLocations();
  // if (this.debug) 
  //   console.log(JSON.stringify(this.info), null, " ");
  
}

Meraki.prototype.handleProbeItem = function(item) {
  var id = this.devices[item.client_mac]; // || item.client_mac;
  if (!id) {
    if (this.ignoredDevices.indexOf(item.client_mac) < 0) {
      if (this.debug) console.log("*  Ignoring", item.client_mac);
      this.ignoredDevices.push(item.client_mac);
    }
    return;
  }
  item.last_seen =  new Date(Date.parse(item.last_seen));


  var record = this.info[id];
  if (!record) {
    record = this.info[id] = {signals : {}};
    var isNexus = this.nexii[id] != undefined;
    //if (!isNexus) this.emit("DeviceEvent", id + ".Appeared");
  }
  if (!record.last_seen || (record.last_seen < item.last_seen)) record.last_seen = item.last_seen;

  var ap_id = this.devices[item.ap_mac];
  record.signals[ap_id] = {rssi: parseInt(item.rssi), date : item.last_seen}

  //if (this.debug && id == "JNJ-iPhone") console.log(">>>>>", id, this.devices[item.ap_mac], item.rssi, (new Date() - item.last_seen)  / 1000);
}

function coordDistance(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}


function estimate_distance_from_rssi(rssi) {
    var d0 = 3.05; // reference distance, meters
    var sig0 = 55; // reference RSSI, dB
    var dist_fact = 25; // magic "signal attenuation factor", ???
    return d0 * Math.pow(10, ((sig0 - rssi)/dist_fact));
}

Meraki.prototype.distanceFromMeters = function(dist_in_meters) {
  return dist_in_meters / this.pixels_per_meter;
}

Meraki.prototype.updateLocations = function() {
  var testData = {};
  var trainingData = [];

  for (var id in this.info) {
    var name = id;
    var record = this.info[name];
    record.neuralInput = {};
    var avgCoords = {x:0, y:0}
    var factorSum = 0;
    var signalCount = 0;
    // Dissapear after 10m
    var lastSeen = Math.round(Math.max(0, (new Date() - record.last_seen)  / 1000));
    if (lastSeen > 600) {
      //this.emit("DeviceEvent", id + ".Disappeared");
      delete this.info[id];
      continue;
    }
    var print = (this.debug && id == "JNJ-iPhone");
    for (var node in record.signals) {
      signalCount++;
      var min_dist = Infinity;
      var signalInfo = record.signals[node];
      var signalCoords = this.coordinates[node];
      var signalAge = Math.round(Math.max(0, (new Date() - signalInfo.date)  / 1000));
      if (signalAge < 300) { 
        var distance = estimate_distance_from_rssi(signalInfo.rssi);
        min_dist = Math.min(min_dist, distance);
        var factor = 1000/distance;
        factorSum += factor;
        //if (print) console.log("calc", factor, signalCoords.x, signalCoords.y, distance);
        avgCoords.x += signalCoords.x * factor;
        avgCoords.y += signalCoords.y * factor;
        record.neuralInput[node] = Math.min(distance / 150, 1.0); //brain requires 0 <---> 1
      } 
    }


    var isNexus = this.nexii[id] != undefined;

    // Use nexii for training
    if (isNexus) { 
      record.neuralTraining = this.nexii[name];
      trainingData.push({input:record.neuralInput, output:record.neuralTraining});
    }   

    // Evaluate Cartesian
    avgCoords.x /= factorSum; // Average coordinates
    avgCoords.y /= factorSum;
    record.cCoordinates = avgCoords;

    // Evaluate based on beacons once we've got at least 4 updates
    if (this.updateCount >= 4) {
      var bestDistance = Infinity;
      var bestBeacon = null;
      for (var beacon in this.beacons) {
        var beaconCoords = this.beacons[beacon];
        var distance = coordDistance(beaconCoords, avgCoords);
        //if (print) console.log("Phone", beacon, distance, avgCoords, beaconCoords);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestBeacon = beacon;
        }
      }
      record.bestBeacon = bestBeacon;

      if (this.lastBeacon[name] != bestBeacon) {
        this.lastBeacon[name] = bestBeacon;
        //if (!isNexus) this.emit("DeviceEvent", id + "." + bestBeacon);
      }
    }
  }

  // Evaluate using Neural
  this.net.train(trainingData,{
    errorThresh: 0.00004,  // error threshold to reach
    //iterations: 90000,   // maximum training iterations
    log: false,           // console.log() progress periodically
    logPeriod: 10        // number of iterations between logging
  });

  var stateRecord = {};
  for (var name in this.info) {
    var record = this.info[name];
    var output = this.net.run(record.neuralInput);
    var x = output.x * this.dimensions.x;
    var y = output.y * this.dimensions.y;
    record.neuralCoordinates = {x:x, y:y};

    // delete output.x;
    // delete output.y;

    var sort_array = [];
    for (var key in output) sort_array.push({key:key,value:output[key]});
    sort_array.sort(function(x,y){return y.value - x.value});
    record.neuralOutput = output;
    record.neuralBeacon = sort_array.shift().key;
    stateRecord["Meraki." + name] = record;

  }
  this.emit("StateEvent", stateRecord);
}

Meraki.prototype.handleReq = function(req, res) {
  var info = url.parse(req.url, true);
  if (req.method == "GET") {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.write(this.validator);
    res.end('');
  } else {

    req.setEncoding('utf8');
    var data = "";
    req.on('data', function(chunk) { data += chunk;});
    req.on('end', function() {
        data = data.substring(5);
        data = decodeURIComponent(data).replace(/\+/g, " ");
        data = JSON.parse(data);
        if (data.secret == this.secret) {
          this.handleProbe(data.probing);
        } else {
          console.log("got post with bad secret", data, data.secret , this.secret);
        }
      }.bind(this));

  }
};


exports.Meraki = Meraki;
