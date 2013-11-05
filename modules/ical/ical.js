var EventEmitter = require('events').EventEmitter;
var util = require('util');
var exec = require('child_process').exec;

function iCal(data) {
  this.listenPort = data.port || 9011;
  this.calendars = data.calendars;
  this.updateCalendar();
  setInterval(this.updateCalendar.bind(this), 60 * 60 * 1000);
};
util.inherits(iCal, EventEmitter);

iCal.prototype.updateCalendar = function(probe) {

  var command = "icalBuddy -std -ea -n -ps '|\t|' -b '' -npn -ic '" + this.calendars.join(",") + "' -nrd -iep 'datetime,title,location' -po 'datetime, title' -df '%B %d, %Y' -tf '%H:%M:%S' eventsToday+1"
  exec(command, function(error, stdout, stderr) {
    var lines = stdout.split("\n");
    var events = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      try {
        var info = {}
        var fields = line.split("\t");

        var when = fields[0].match(/(.*) at (.*) - (.*)/);
        info.start = new Date(when[1] + " " + when[2]);
        info.end = new Date(when[1] + " " + when[3]);

        var what = fields[1].match(/(.*) \((.*)\)/);
        info.title = what[1];
        info.calendar = what[2];
        if (fields[2]) info.location = fields[2];
        events.push(info);
      } catch (e) {
        //console.log("!  Ignoring", line)
      }

      this.emit("StateEvent", {calendar: events});
    };
  }.bind(this));
}

exports.iCal = iCal;
