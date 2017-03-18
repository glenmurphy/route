/**
 * This is what Glen uses to run his house
 */
var http = require('http');
var Route = require('../../core/route.js');

var Lutron = require('../../modules/lutron-radiora2/lutron-radiora2.js');
var Sonos = require('../../modules/sonos/sonos.js');
//var Denon = require('route.io-denon');
var Web = require('../../modules/web/web.js');
var Telnet = require('../../modules/telnet/telnet.js');

// Map of commands to routers that service that command.
var route = Route.create();

var sonos = route.addDevice({
  type : Sonos,
  name : "Sonos",
  init : {
    components : {
      "Kitchen" : "10.1.10.15",
      "DiningRoom" : "10.1.10.16",
      "MasterBedroom" : "10.1.10.18",
      "MasterBathroom" : "10.1.10.17",
      "RumpusRoom" : "10.1.10.19",
      "LegoRoom" : "10.1.10.11",
      //"Office" : "10.0.1.14",
      //"Lanai" : "10.0.1.17",
      //"Landscape" : ???
    }
  }
});

var lutron = route.addDevice({
  type : Lutron,
  name : "Lutron",
  init : {
    host : "10.1.10.32",
    username : "lutron",
    password: "integration",
    devices : {
      "FrontPorchPendants" : { id : 14, type : Lutron.TYPE_LIGHT },
      "FrontDoorSconces" : { id : 15, type : Lutron.TYPE_LIGHT },
      "FamilyRoomRecessed" : { id : 19, type : Lutron.TYPE_LIGHT },
      "FamilyRoomChandelier" : { id : 20, type : Lutron.TYPE_LIGHT },
      "DiningRoomChandelier" : { id : 21, type : Lutron.TYPE_LIGHT },
      "DiningRoomRecessed" : { id : 22, type : Lutron.TYPE_LIGHT },
      "DiningRoomCove" : { id : 25, type : Lutron.TYPE_LIGHT },
      "KitchenSinkAndNook" : { id : 26, type : Lutron.TYPE_LIGHT },
      "KitchenRecessed" : { id : 27, type : Lutron.TYPE_LIGHT },
      "KitchenIslandPendants" : { id : 28, type : Lutron.TYPE_LIGHT },
      "FoyerPendants" : { id : 31, type : Lutron.TYPE_LIGHT },
      "FoyerSconces" : { id : 32, type : Lutron.TYPE_LIGHT },
      "HallwayPendant" : { id : 33, type : Lutron.TYPE_LIGHT },
      "HallwayWallWashers" : { id : 34, type : Lutron.TYPE_LIGHT },
      "HallwayRecessed" : { id : 35, type : Lutron.TYPE_LIGHT },
      "KitchenCabinets" : { id : 36, type : Lutron.TYPE_LIGHT },
      "MasterBedroomRecessed" : { id : 37, type : Lutron.TYPE_LIGHT },
      "MasterBedroomCove" : { id : 38, type : Lutron.TYPE_LIGHT },
      "MasterBedroomChandelier" : { id : 39, type : Lutron.TYPE_LIGHT },
      "MasterBathroomSconces" : { id : 40, type : Lutron.TYPE_LIGHT },
      "MasterBathroomRecessed" : { id : 41, type : Lutron.TYPE_LIGHT },
      "MasterBathroomShower" : { id : 42, type : Lutron.TYPE_LIGHT },
      "MasterBathroomFan" : { id : 43, type : Lutron.TYPE_LIGHT },
      "MudRoomRecessed" : { id : 45, type : Lutron.TYPE_LIGHT },

      "FamilyRoomRearPatioKeypad" : { id : 48, type : Lutron.TYPE_KEYPAD },
      "MudRoomGarageDoorKeypad" : { id : 49, type : Lutron.TYPE_KEYPAD },
      "DiningRoomChinaCabinetKeypad" : { id : 50, type : Lutron.TYPE_KEYPAD },
      "DiningRoomKitchenKeypad" : { id : 51, type : Lutron.TYPE_KEYPAD },
      "MasterBathKeypad" : { id : 52, type : Lutron.TYPE_KEYPAD },
      "HallwayMiddleKeypad" : { id : 53, type : Lutron.TYPE_KEYPAD },
      "HallwayEndKeypad" : { id : 54, type : Lutron.TYPE_KEYPAD },
      "MasterBedroomMainKeypad" : { id : 55, type : Lutron.TYPE_KEYPAD },
      "MasterBedroomBesideKeypad" : { id : 56, type : Lutron.TYPE_KEYPAD },
      "FoyerFrontDoorKeypad" : { id : 57, type : Lutron.TYPE_KEYPAD },
      "FoyerFamilyRoomKeypad" : { id : 58, type : Lutron.TYPE_KEYPAD },
      "FoyerStairsKeypad" : { id : 59, type : Lutron.TYPE_KEYPAD },
      "KitchenMudRoomKeypad" : { id : 60, type : Lutron.TYPE_KEYPAD },
      "KitchenLanaiKeypad" : { id : 61, type : Lutron.TYPE_KEYPAD },
      "MasterBedroomDeckKeypad" : { id : 63, type : Lutron.TYPE_KEYPAD },
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
  //"Sonos.Kitchen.Started" : "Denon.Switch.Sonos",

  //  Hard-coded web switches for media (TV/Speakers)
  //"Web.Kitchen.Sonos" : "Denon.Switch.Sonos",
  "Web.LivingRoom.ChromeCast" : [
    "Sonos.Kitchen.Pause",
    "Sonos.DiningRoom.Pause",
  ],
  "Web.Livingroom.PS3" : [
//    "Denon.Switch.HDMI",
    "Sonos.Kitchen.Pause",
    "Sonos.DiningRoom.Pause",
  ],

//  "Web.MasterBedroom.ChromeCast" : "IR.B-ChromeCast",
//  "Web.Masterbed.PS3" : "IR.B-PS3",

/*
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
  */
});

route.map("Web.Lutron.*", function(eventname, data) {
  lutron.exec(eventname.substring(11)); // chop off "Web.Lutron."
});

route.map("Web.Sonos.*", function(eventname, data) {
  sonos.exec(eventname.substring(10)); // chop off "Web.Sonos."
});

/*
route.map("Web.Denon.*", function(eventname, data) {
  denon.exec(eventname.substring(10)); // chop off "Web.Denon."
});

*/