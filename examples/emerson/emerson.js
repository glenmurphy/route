/**
 * This is what Glen uses to run his house
 */

var PATH_TO_ROUTE = "../../";
var Insteon = require(PATH_TO_ROUTE + 'modules/insteon').Insteon;
var Sonos = require(PATH_TO_ROUTE + 'modules/sonos').Sonos;
var RedEye = require(PATH_TO_ROUTE + 'modules/redeye').RedEye;
var Web = require(PATH_TO_ROUTE + 'modules/web').Web;
var Route = require(PATH_TO_ROUTE).Route;

// Map of commands to routers that service that command.
var route = new Route();

var insteon = route.addDevice({
  type : Insteon,
  name : "Insteon",
  init : {
    host : "10.0.1.120",
    commands : {
      "LivingRoomLightsOn" : "0261211121",
      "LivingRoomLightsOff" : "0261211321",
      "BedRoomLightsOn" : "0261011101",
      "BedRoomLightsOff" : "0261011301",
      "BedRoomLampOn" : "0261031103",
      "BedRoomLampOff" : "0261031303"
    },
    devices : {
      "BedRoomLamp" : "1AD883",
      "BedRoomLights" : "201697",
      "LivingRoomLights" : "1D23CC",
      "DiningRemote" : "1C483B",
      "LivingRoomRemote" : "1C4C33",
      "BedRoomRemote" : "1C4943",
      "Remote3" : "1C5418",
      "MotionLivingRoom" : "14DEDD"
    }
  }
});

var sonos = route.addDevice({
  type : Sonos,
  name : "Sonos",
  init : {
    host : "10.0.1.16",
  }
});

var redeye = route.addDevice({
  type : RedEye,
  name : "RedEye",
  init : {
    host : "10.0.1.19",
    commands : {
      "ProjectorPower" : "/devicedata/1189-99999-02.isi",
      "ProjectorCancel" : "/devicedata/1189-99999-10.isi",
      "ProjectorOK" : "/devicedata/1189-99999-05.isi",
      "InputSonos" : "/devicedata/CaptubELVo4",
      "InputPC" : "/devicedata/1377-99999-05.isi"
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
  "Insteon.LivingRoomRemote.Off.2" : ["Sonos.Pause"],

  "Insteon.DiningRemote.On.2" : [
    "Sonos.Play",
    "RedEye.InputSonos"
  ],
  "Insteon.DiningRemote.Off.2" : ["Sonos.Pause"],

  "Insteon.BedRoomRemote.On" : "Insteon.BedRoomLightsOn",
  "Insteon.BedRoomRemote.Off" : "Insteon.BedRoomLightsOff",
  "Insteon.BedRoomRemote.On.2" : "Insteon.BedRoomLampOn",
  "Insteon.BedRoomRemote.Off.2" : "Insteon.BedRoomLampOff",

  "Sonos.Started" : ["RedEye.InputSonos"],
  "Web.PlayPause" : ["Sonos.PlayPause"],
  "Web.Play" : ["Sonos.Play"],
  "Web.Pause" : ["Sonos.Pause"],
  "Web.LivingRoomLightsOn" : ["Insteon.LivingRoomLightsOn"],
  "Web.LivingRoomLightsOff" : ["Insteon.LivingRoomLightsOff"],
  "Web.BedRoomLightsOn" : ["Insteon.BedRoomLightsOn"],
  "Web.BedRoomLightsOff" : ["Insteon.BedRoomLightsOff"],
  "Web.BedRoomLampOn" : ["Insteon.BedRoomLampOn"],
  "Web.BedRoomLampOff" : ["Insteon.BedRoomLampOff"],
  "Web.MediaPCStarted" : [
    "Insteon.LivingRoomLightsOff",
    "Sonos.Pause",
    [
      "RedEye.ProjectorPower",
      "Wait.500",
      "RedEye.ProjectorCancel",
      "RedEye.InputPC"
    ]
  ],
  "Web.MediaPCEnded" : [
    "Insteon.LivingRoomLightsOn",
    [
      "RedEye.ProjectorPower",
      "Wait.500",
      "RedEye.ProjectorOK",
      "RedEye.InputSonos"
    ]
  ],
});

// Programmatically added listeners
route.on("Insteon.LivingRoomRemote.On.2", function() {
  sonos.exec("Play");
  redeye.exec("InputSonos");
});

/*
// Motion detection.
var state = {
  "LivingRoomMotion" : {
    started : 0,
    ended : 0,
  },
  "GlenHome" : {
    arrived : 0
  }
}

route.on("Web.GlenHome", function() {
  state.GlenHome = new Date();
})

route.on("Insteon.025014DEDD000001C71101", function() {
  var date = new Date();
  // If it's the afternoon and the livingroom hasn't seen motion in over four hours
  if (date.getHours > 16 && date.getHours < 20 && (date - motion.LivingRoom.ended > 1000 * 60 * 60 * 5)) {
    insteon.exec("LivingRoomLightsOn");
    sonos.exec("Play");
  }
  motion.LivingRoom.started = new Date();
});

route.on("Insteon.025014DEDD000001C71301", function() {
  motion.LivingRoom.ended = new Date();
});
*/