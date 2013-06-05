# BTProximity

Bluetooth 4 proximity detection module for route.io

## Setup

On a Raspberry PI, you can get Bluetooth working by buying the IOGear GBU521 and following [these instructions](http://www.ioncannon.net/linux/1570/bluetooth-4-0-le-on-raspberry-pi-with-bluez-5-x/) (these also show how to get the MAC address).

## Notes

When the dbus issues are fixed so that it can work on more recent versions of NodeJS, it would be good to use [Noble](https://github.com/sandeepmistry/noble), though it's also just driving the gatttool command-line tool, so it might not be worth it.
