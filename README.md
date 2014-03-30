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

### Configuration

To get the redeye commands, you need to download the control database from 
your RedEye <http://[REDEYEIP]/setup/maintenance.html>, then use 
SQLLiteExplorer to find the 'signal' value for the commands you need
in the 'command' table. The final URL is constructed using that value
in the following:

  "/cgi-bin/play_iph.sh?/[SIGNALPATH]%201"

You're meant to be able to use the iOS app to extract these paths, but I could
never get that to work.

### Installation

You can run this as a service on Windows using NSSM <http://nssm.cc>:

  nssm.exe install emerson-node "C:\path\to\node.exe" c:\path\to\emerson.js
  net start emerson-node

To run on Linux, you'll need to modify emerson_upstart.conf to point to the 
right user and directory, then do:

  $ sudo apt-get install upstart
  $ sudo cp ./emerson_upstart.conf /etc/init/
  $ sudo start emerson_upstart

