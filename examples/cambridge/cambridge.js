/**
 * This is what Glen uses to run his house
 */
var http = require('http');
var Route = require('route.io');

var Lutron = require('route.io-lutron-radiora2');
var Sonos = require('route.io-sonos');
var Denon = require('route.io-denon');
var Web = require('route.io-web');
var Telnet = require('route.io-telnet');

// Map of commands to routers that service that command.
var route = Route.create();

var sonos = route.addDevice({
  type : Sonos,
  name : "Sonos",
  init : {
    components : {
      "Livingroom" : "10.0.1.3",
      "Ethanbed" : "10.0.1.7",
      "Masterbed" : "10.0.1.14"
    }
  }
});

var IR = route.addDevice({
  type : Telnet,
  name : "IR",
  init : {
    host : "10.0.1.56", // iTach IP2IR
    port: "4998",
    commands : {
      "A-PC" : "sendir,1:1,1,38109,1,1,342,170,22,21,21,21,22,21,22,21,21,21,22,21,22,21,21,21,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,64,22,21,21,21,22,64,21,21,22,21,22,21,21,21,22,21,22,63,22,64,21,21,22,64,21,64,22,63,22,64,21,64,22,1518,342,85,22,3810",
      "A-AppleTV" : "sendir,1:1,1,38226,1,1,341,171,21,21,22,21,22,21,21,21,22,21,22,21,21,21,22,21,22,63,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,21,22,21,22,21,21,21,22,21,22,21,21,21,22,21,22,63,22,64,21,64,22,63,22,64,21,4892",
      "A-ChromeCast" : "sendir,1:1,1,38226,1,1,342,171,22,21,22,21,21,21,22,21,22,21,21,21,22,21,22,21,21,64,22,63,22,64,21,64,22,63,22,64,21,64,22,63,22,21,22,21,21,21,22,64,21,21,22,21,22,21,21,21,22,64,21,64,22,63,22,21,22,63,22,64,21,64,22,63,22,1523,341,85,22,3822",
      "A-PS3" : "sendir,1:1,1,38226,1,1,342,170,22,21,21,21,22,21,22,21,21,21,22,21,22,21,21,21,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,21,22,64,21,21,22,21,22,21,21,21,22,21,22,21,21,64,22,21,21,64,22,63,22,64,21,64,22,1522,342,85,22,3822",
      "B-PC" : "sendir,1:1,1,38109,1,1,342,170,22,21,21,21,22,21,22,21,21,21,22,21,22,21,21,21,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,64,22,21,21,21,22,64,21,21,22,64,21,21,22,21,22,21,21,64,22,63,22,21,22,63,22,21,22,63,22,64,21,64,22,1517,342,85,22,3810",
      "B-AppleTV" : "sendir,1:1,1,38226,1,1,342,170,22,21,21,21,22,21,22,21,21,21,22,21,22,21,21,21,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,64,22,21,21,64,22,21,21,21,22,21,22,21,21,21,22,21,22,63,22,21,22,63,22,64,21,64,22,1522,342,85,22,3822",
      "B-ChromeCast" : "sendir,1:1,1,38226,1,1,341,171,21,21,22,21,22,21,21,21,22,21,22,21,21,21,22,21,22,63,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,21,22,21,22,21,21,64,22,63,22,21,22,21,21,21,22,64,21,64,22,63,22,21,22,21,21,64,22,63,22,64,21,1523,342,85,21,3822",
      "B-PS3" : "sendir,1:1,1,38226,1,1,341,171,21,21,22,21,22,21,21,21,22,21,22,21,21,21,22,21,22,63,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,64,22,63,22,21,22,63,22,64,21,21,22,21,22,21,21,21,22,21,22,63,22,21,22,21,21,64,22,63,22,64,21,1523,342,85,21,3822",
      "POWER" : "sendir,1:1,1,38226,1,1,341,171,21,21,22,21,22,21,21,21,22,21,22,21,21,21,22,21,22,63,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,64,22,21,21,21,22,21,22,21,21,21,22,21,22,21,21,21,22,64,21,64,22,63,22,64,21,64,22,63,22,64,21,1523,342,85,21,3822",
    }
  }
});

var denon = route.addDevice({
  type : Denon,
  name : "Denon",
  init : {
    host : "10.0.1.20",
    sources : {
      "HDMI" : "GAME",
      "Sonos" : "DVR"
    }
  }
});

var lutron = route.addDevice({
  type : Lutron,
  name : "Lutron",
  init : {
    host : "10.0.1.13",
    username : "route",
    password: "route",
    devices : {
      "KitchenBarLights" : { id : 23, type : Lutron.TYPE_LIGHT },
      "KitchenCabinetLights" : { id : 26, type : Lutron.TYPE_LIGHT },
      "KitchenCeilingLights" : { id : 25, type : Lutron.TYPE_LIGHT },
      "KitchenDiningLights" : { id : 27, type : Lutron.TYPE_LIGHT },
      "KitchenKeypad" : { id : 24, type : Lutron.TYPE_KEYPAD},
      "KitchenCoffeeMachine" : { id : 36, type : Lutron.TYPE_LIGHT },
      "LivingroomEntryLight" : { id : 30, type : Lutron.TYPE_LIGHT },
      "LivingroomLoungeLamp" : { id : 18, type : Lutron.TYPE_LIGHT },
      "LivingroomPathLights" : { id : 31, type : Lutron.TYPE_LIGHT },
      "FrontDoorMotion" : { id : 32, type : Lutron.TYPE_MOTION },
      "LivingroomKeypad" : {
        id : 14, type : Lutron.TYPE_KEYPAD,
        buttons : {
          1 : "AllOn",
          2 : "Pendant",
          3 : "Sonos",
          4 : "LowerShades",
          5 : "Lamp",
          6 : "Goodnight"
        }
      },

      "OfficePendantLight" : { id : 15, type : Lutron.TYPE_LIGHT },
      "OfficeKeypad" : { id : 16, type : Lutron.TYPE_LIGHT },

      "MasterbedRemote" : { id : 29, type : Lutron.TYPE_REMOTE },
      "MasterbedWallLights" : { id : 28, type : Lutron.TYPE_LIGHT },
      "MasterbedKeypad" : {
        id : 4, type : Lutron.TYPE_KEYPAD,
        buttons : {
          1 : "AllOn",
          2 : "Wall",
          3 : "3",
          4 : "4",
          5 : "Sonos",
          6 : "Goodnight"
        }
      },

      "HallwayPendantLights" : { id : 20, type : Lutron.TYPE_LIGHT },
      "HallwayKeypad" : { id : 21, type : Lutron.TYPE_KEYPAD },
    }
  }
});

var web = route.addDevice({
  type : Web,
  name : "Web",
  init : {
    port : 8000,
    dir : __dirname + "/web/"
  }
});

// Simple map of events to commands.
route.addEventMap({
  //
  "Sonos.Livingroom.Started" : "Denon.Switch.Sonos",

  //  Hard-coded web switches for media (TV/Speakers)
  "Web.Livingroom.Sonos" : "Denon.Switch.Sonos",
  "Web.Livingroom.PC" : [
    "IR.A-PC",
    "Denon.Switch.HDMI",
    "Sonos.Livingroom.Pause",
  ],
  "Web.Livingroom.AppleTV" : [
    "IR.A-AppleTV",
    "Denon.Switch.HDMI",
    "Sonos.Livingroom.Pause",
  ],
  "Web.Livingroom.ChromeCast" : [
    "IR.A-ChromeCast",
    "Denon.Switch.HDMI",
    "Sonos.Livingroom.Pause",
  ],
  "Web.Livingroom.PS3" : [
    "IR.A-PS3",
    "Denon.Switch.HDMI",
    "Sonos.Livingroom.Pause",
  ],

  "Web.Masterbed.PC" : "IR.B-PC",
  "Web.Masterbed.AppleTV" : "IR.B-AppleTV",
  "Web.Masterbed.ChromeCast" : "IR.B-ChromeCast",
  "Web.Masterbed.PS3" : "IR.B-PS3",

  "Lutron.LivingroomKeypad.Goodnight.On" : [
    "Sonos.Livingroom.Pause",
    "Sonos.Masterbed.Pause",
    "Denon.Switch.Sonos",
  ],
  "Lutron.LivingroomKeypad.Sonos.On" : "Sonos.Livingroom.PlayPause",
  "Lutron.MasterbedKeypad.Sonos.On" : "Sonos.Masterbed.PlayPause",
  "Web.Livingroom.PlayPause" : "Sonos.Livingroom.PlayPause",
  "Web.Masterbed.PlayPause" : "Sonos.Masterbed.PlayPause",
  "Web.GlenHome" : [
    "Lutron.LivingroomLoungeLamp.On",
    "Lutron.HallwayPendantLights.On",
    "Lutron.KitchenBarLights.On",
    "Lutron.KitchenCabinetLights.On"
  ]
});

route.map("Web.Lutron.*", function(eventname, data) {
  lutron.exec(eventname.substring(11)); // chop off "Web.Lutron."
});

route.map("Web.Sonos.*", function(eventname, data) {
  sonos.exec(eventname.substring(10)); // chop off "Web.Sonos."
});

route.map("Web.Denon.*", function(eventname, data) {
  denon.exec(eventname.substring(10)); // chop off "Web.Denon."
});
