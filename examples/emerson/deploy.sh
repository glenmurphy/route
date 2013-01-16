#!/bin/bash
sudo stop emerson_upstart
sudo cp emerson_upstart.conf /etc/init/
sudo start emerson_upstart
