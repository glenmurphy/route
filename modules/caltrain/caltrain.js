var EventEmitter = require('events').EventEmitter;
var util = require('util');

var caltrain = require("nextcaltrain");

function Caltrain(data) {
  this.debug = data.debug;
  this.nightStation = data.nightStation;
  this.dayStation = data.dayStation;
  setTimeout(this.updateCaltrain.bind(this),2000)
};
util.inherits(Caltrain, EventEmitter);

Caltrain.prototype.updateCaltrain = function() {
  var schedule = caltrain({
    from: this.nightStation,
    to: this.dayStation,
    date: new Date()
  })();
  var state = {"caltrain": schedule}
//  console.log(state)
  this.emit("StateEvent", state);
  //     console.log("this.nightStation", this.nightStation)
  // caltrain(function(err, getSchedule) {
  //   if (err) {
  //     throw err;
  //   }

  //   var getTrip;
  //   try {
  //     getTrip = getSchedule({
  //       from: this.nightStation,
  //       to: this.dayStation,
  //       date: new Date(),
  //     });
  //   }
  //   catch (err) {
  //     if (err.code === "STOP_NOT_FOUND") {
  //       console.error(err.message);
  //       return;
  //     }
  //   }

  //   console.log(format.heading(getTrip.from, getTrip.to));

  //   for (var i = 0; i < args.number; i++) {
  //     if (i !== 0) {
  //       console.log();
  //     }
  //     console.log(format.trip(getTrip()));
  //   }
  // });
  // var nextCheck = (expires - new Date())/1000;


    //   var state = {}
    // state[this.name] = data
    // console.log("*", state)

  // setTimeout(this.fetchRainCaltrain.bind(this), nextCheck * 1000);
}

Caltrain.prototype.exec = function(command, data) {
};

module.exports = Caltrain;