/**
 * This is what Glen uses to run his house
 */

var PATH_TO_ROUTE = "../../";
var PATH_TO_MODULES = "../../modules/";
var Insteon = require(PATH_TO_MODULES + 'insteon').Insteon;
var Sonos = require(PATH_TO_MODULES + 'sonos').Sonos;
var RedEye = require(PATH_TO_MODULES + 'redeye').RedEye;
var Web = require(PATH_TO_MODULES + 'web').Web;
var Route = require(PATH_TO_ROUTE).Route;

// Map of commands to routers that service that command.
var route = new Route();

var insteon = route.addDevice({
  type : Insteon,
  name : "Insteon",
  init : {
    host : "10.0.1.120",
    commands : {
    },
    devices : {
      "StudyLamp" : "1AD883",
      "StudyLights" : "01",
      "BedRoomLights" : "1FC81E",
      "LivingRoomLights" : "21",
      "DiningRemote" : "1C483B",
      "FrontDoorRemote" : "1C4C33",
      "StudyRemote" : "1C4943",
      "BedRoomRemote" : "1C5418",
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
  // Front door
  "Insteon.FrontDoorRemote.Off.2" : ["Sonos.Pause"],
  "Insteon.FrontDoorRemote.Off.4" : [
    "Sonos.Pause",
    "Insteon.LivingRoomLights.Off",
    "Insteon.BedRoomLights.Off",
    "Insteon.StudyLights.Off",
  ],

  // Bedroom
  "Insteon.BedRoomRemote.On" : "Insteon.BedRoomLights.On",
  "Insteon.BedRoomRemote.Off" : "Insteon.BedRoomLights.Off",

  // Dining room
  "Insteon.DiningRemote.On.2" : [
    "Sonos.Play",
    "RedEye.InputSonos"
  ],
  "Insteon.DiningRemote.Off.2" : ["Sonos.Pause"],

  // Study
  "Insteon.StudyRemote.On" : "Insteon.StudyLights.On",
  "Insteon.StudyRemote.Off" : "Insteon.StudyLights.Off",
  "Insteon.StudyRemote.On.2" : "Insteon.StudyLamp.On",
  "Insteon.StudyRemote.Off.2" : "Insteon.StudyLamp.Off",

  "Sonos.Started" : ["RedEye.InputSonos"],
  "Web.PlayPause" : ["Sonos.PlayPause"],
  "Web.Play" : ["Sonos.Play"],
  "Web.Pause" : ["Sonos.Pause"],
  "Web.LivingRoomLightsOn" : ["Insteon.LivingRoomLights.On"],
  "Web.LivingRoomLightsOff" : ["Insteon.LivingRoomLights.Off"],
  "Web.BedRoomLightsOn" : ["Insteon.BedRoomLights.On"],
  "Web.BedRoomLightsOff" : ["Insteon.BedRoomLights.Off"],
  "Web.StudyLightsOn" : ["Insteon.StudyLights.On"],
  "Web.StudyLightsOff" : ["Insteon.StudyLights.Off"],
  "Web.StudyLampOn" : ["Insteon.StudyLamp.On"],
  "Web.StudyLampOff" : ["Insteon.StudyLamp.Off"],
  "Web.MediaPCStarted" : [
    "Insteon.LivingRoomLights.Off",
    "Sonos.Pause",
    [
      "RedEye.ProjectorPower",
      "Wait.500",
      "RedEye.ProjectorCancel",
      "RedEye.InputPC"
    ]
  ],
  "Web.MediaPCEnded" : [
    "Insteon.LivingRoomLights.On",
    [
      "RedEye.ProjectorPower",
      "Wait.500",
      "RedEye.ProjectorOK",
      "RedEye.InputSonos"
    ]
  ],
});

// Programmatically added listeners
route.map("Insteon.FrontDoorRemote.On.2", function() {
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

route.map("Web.GlenHome", function() {
  state.GlenHome = new Date();
})

route.map("Insteon.025014DEDD000001C71101", function() {
  var date = new Date();
  // If it's the afternoon and the livingroom hasn't seen motion in over four hours
  if (date.getHours > 16 && date.getHours < 20 && (date - motion.LivingRoom.ended > 1000 * 60 * 60 * 5)) {
    insteon.exec("LivingRoomLightsOn");
    sonos.exec("Play");
  }
  motion.LivingRoom.started = new Date();
});

route.map("Insteon.025014DEDD000001C71301", function() {
  motion.LivingRoom.ended = new Date();
});
*/
