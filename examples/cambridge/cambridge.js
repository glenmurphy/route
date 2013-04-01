/**
 * This is what Glen uses to run his house
 */

var PATH_TO_ROUTE = "../../";
var PATH_TO_MODULES = "../../modules/";
var Lutron = require(PATH_TO_MODULES + 'lutron-radiora2').LutronRadioRA2;
var Sonos = require(PATH_TO_MODULES + 'sonos/sonos_experimental.js').Sonos;
var Denon = require(PATH_TO_MODULES + 'denon').Denon;
var Web = require(PATH_TO_MODULES + 'web').Web;
var Route = require(PATH_TO_ROUTE).Route;

// Map of commands to routers that service that command.
var route = new Route();

var sonos = route.addDevice({
  type : Sonos,
  name : "Sonos",
  init : {
    components : {
      "LivingRoom" : "10.0.1.4",
      "MasterBed" : "10.0.1.12"
    }
  }
});

var Denon = route.addDevice({
  type : Denon,
  name : "Denon",
  init : {
    host : "10.0.1.20",
    sources : {
      "MacMini" : "GAME",
      "Sonos" : "DVR"
    }
  }
});

var lutron = route.addDevice({
  type : Lutron,
  name : "Lutron",
  init : {
    host : "10.0.1.21",
    devices : {
      "OfficeMainKeypad" : "22",
      "OfficeMainLight" : "21",
      
      "PathLights" : "23",
      
      "LivingKeypad" : "18",
      "LivingPendantLight" : "24",
      "LivingDiningLight" : "19",

      "KitchenKeypad" : "14",
      "KitchenCounterLight" : "2",
      "KitchenOverheadLight" : "16",
      "KitchenCabinetLight" : "15",

      "KitchenHall" : "17",
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
  // Livingroom
  "Web.Switch.Sonos" : "Denon.Switch.Sonos",
  "Web.Switch.MacMini" : [
    "Denon.Switch.MacMini",
    "Sonos.LivingRoom.Pause"
  ],
  "Web.LivingRoom.Play" : [
    "Sonos.LivingRoom.Play",
    "Denon.Switch.Sonos"
  ],
  "Web.LivingRoom.Pause" : ["Sonos.LivingRoom.Pause"],
  "Sonos.LivingRoom.TrackInfo" : "Web.LivingRoom.TrackInfo?name=$Name&album=$Album&artist=$Artist&artwork=$Artwork",
  "Sonos.LivingRoom.PlayingState" : "Web.LivingRoom.PlayingState?state=$state",

  "Web.LivingDiningLight.On" : ["Lutron.LivingDiningLight.1.100"],
  "Web.LivingDiningLight.Off" : ["Lutron.LivingDiningLight.1.0"],
  "Lutron.LivingDiningLight.*" : "Web.LivingDiningLight?brightness=$brightness",

  "Web.LivingPendantLight.On" : "Lutron.LivingPendantLight.1.100",
  "Web.LivingPendantLight.Off" : "Lutron.LivingPendantLight.1.0",
  "Lutron.LivingPendantLight.*" : "Web.LivingPendantLight?brightness=$brightness",

  // Kitchen
  "Web.KitchenOn" : [
    "Lutron.KitchenOverheadLight.1.100",
    "Lutron.KitchenCounterLight.1.100",
    "Lutron.KitchenCabinetLight.1.100"
  ],
  "Web.KitchenOff" : [
    "Lutron.KitchenCounterLight.1.0",
    "Lutron.KitchenOverheadLight.1.0",
    "Lutron.KitchenCabinetLight.1.0"
  ],

  // Master Bedroom
  "Web.MasterBedPlay" : ["Sonos.MasterBed.Play"],
  "Web.MasterBedPause" : ["Sonos.MasterBed.Pause"],
  "Sonos.MasterBed.TrackInfo" : "Web.MasterBed.TrackInfo?name=$Name&album=$Album&artist=$Artist&artwork=$Artwork",
  "Sonos.MasterBed.PlayingState" : "Web.MasterBed.PlayingState?state=$state",

  // Office
  "Web.OfficeMainLight.On" : "Lutron.OfficeMainLight.1.100",
  "Web.OfficeMainLight.Off" : "Lutron.OfficeMainLight.1.0",
  "Lutron.OfficeMainLight.*" : "Web.OfficeMainLight?brightness=$brightness",
});
