#!/bin/bash
cd "$(dirname "$0")"
sudo stop emerson_upstart
sudo cp emerson_upstart.conf /etc/init/
sudo start emerson_upstart
