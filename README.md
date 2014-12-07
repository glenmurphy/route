# Route
Home automation and event router
http://route.io/

### Examples

Getting started with Route is easy if you have JavaScript knowledge and 
the appropriate hardware. For example, here's a script that allows a single
light switch button press to turn on multiple lights and your Sonos.

    var insteon = route.addDevice({
      type : Insteon,
      name : "Insteon",
      init : {
        host : "10.0.1.120",
        devices : {
          "Switch" : "1F5450",
          "KitchenLights" : "1F32AA",
          "BedRoomLights" : "1FC81E",
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

    route.addEventMap({
      "Switch.Remote.On" : [
        "Insteon.BedRoomLights.On",
        "Insteon.KitchenLights.On",
        "Sonos.Play"
      ],
      "Switch.Remote.Off" : [
        "Insteon.BedRoomLights.Off",
        "Insteon.KitchenLights.Off",
        "Sonos.Pause"
      ]
    });

You can see more usages in [the examples](http://github.com/glenmurphy/route/examples/)

### Installation

    npm install route.io
    npm install route.io-sonos
    npm install route.io-web