var EventEmitter = require('events').EventEmitter;
var LastFmNode = require('lastfm').LastFmNode;
var util = require('util');

function LastFM(data) {
	this.key = data.key;
  this.secret = data.secret;
  this.username = data.username;

  this.lastfm = new LastFmNode({api_key: this.key, secret: this.secret});
  this.trackStream = this.lastfm.stream(this.username);

  this.trackStream.on('nowPlaying', this.nowPlaying.bind(this));
  this.trackStream.on('stoppedPlaying', this.stoppedPlaying.bind(this));

  this.trackStream.start();

  this.lastPlayedTrack;
}
util.inherits(LastFM, EventEmitter);

LastFM.prototype.nowPlaying = function(track) {
  var currentDate = new Date();

  this.lastPlayedTrack = {
    album: track.album['#text'],
    artist: track.artist['#text'],
    played: currentDate.getTime(),
    track: track.name
  };

  this.emit("DeviceEvent", "NowPlaying", track);
};

LastFM.prototype.stoppedPlaying = function(track) {
  this.emit("DeviceEvent", "StoppedPlaying", track);
};

module.exports = LastFM;
