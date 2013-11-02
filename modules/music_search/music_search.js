var util = require('util');
var echonest =  require('echonest');

function MusicSearch(data) {
  this.echonest_api_key = data.echonest_api_key;
  this.spotify_api_key = data.spotify_api_key;

//  if (this.echonest_api_key)
    this.echonest = new echonest.Echonest({ api_key: this.echonest_api_key });
};

MusicSearch.prototype.topArtistForQuery = function(query, callback) {
  this.echonest.artist.search({
    name:query,
    bucket: ["hotttnesss", "familiarity"]
  }, function (error, data) {
    var topArtist = data.artists.shift();
    if (topArtist) console.log(topArtist.name, topArtist.familiarity, topArtist.hotttnesss, topArtist);
    callback(topArtist);
  });
}

MusicSearch.prototype.topTracksForArtist = function(artist, callback) {
  this.echonest.song.search({
    artist_id: artist.id,
    bucket: ['tracks', 'id:spotify-WW', "song_hotttnesss"],
    sort: ["song_hotttnesss-desc"],
    results: 100,
    limit:true,
  }, function (error, data) {
          if (error) console.log(error);

    callback(data.songs);
  });
}


MusicSearch.prototype.topTracksForQuery = function(query, callback) {
  var artist = null;
  if (query.indexOf(" by ") != -1) {
    var components = query.split(" by ");
    query = components[0];
    artist = components[1];
  }
    if (query.indexOf(" artist ") != -1) {
    var components = query.split(" artist ");
    query = components[0];
    artist = components[1];
  }
  var params = {
    bucket: ['tracks', 'id:spotify-WW', "song_hotttnesss"],
    sort: ["song_hotttnesss-desc"],
    results: 10,
    limit:true,
  }

  if (artist) {
    console.log("*  Searching for specific track:", query, "[by]", artist);

    params.artist = artist;
    params.title = query;
  } else {
        console.log("*  Searching for specific track:", query);

    params.title = query;
  }

  this.echonest.song.search(params, function (error, data) {
          if (error) console.log(error);

    callback(data.songs);
  });
}



MusicSearch.prototype.radioForArtist = function(artist, callback) {
  this.echonest.playlist.basic({
    artist_id: artist.id,
    bucket: ['tracks', 'id:spotify-WW', "song_hotttnesss"],
    type:"artist-radio",
    limit:true,
        results: 10,

  }, function (error, data) {
          if (error) console.log(error);

    callback(data);
  });
}


MusicSearch.prototype.radioForTrack = function(song, callback) {
  this.echonest.playlist.basic({
    song_id: song.id,
    bucket: ['tracks', 'id:spotify-WW'],
    type:"song-radio",
    limit:true,
    results: 10,

  }, function (error, data) {
          if (error) console.log(error);

    callback(data);
  });
}

MusicSearch.prototype.tracksForFreeformQuery = function(query, callback) {
  this.topArtistForQuery(query, function (artist) {
    if (artist && artist.familiarity > 0.6) {
      this.topTracksForArtist(artist, function (songs) {
          if (songs.length) {
            this.parseAndReturnTracks(songs, callback);
          } else {
            this.tracksForTrackQuery(query, function (songs) {
              this.parseAndReturnTracks(songs, callback);
            }.bind(this));
          }
        }.bind(this));
    } else { // Perform a track query
      this.tracksForTrackQuery(query, function (songs) {
          this.parseAndReturnTracks(songs, callback);
        }.bind(this));
    }
  }.bind(this));
}


MusicSearch.prototype.tracksForArtistQuery = function(query, callback) {
  this.topArtistForQuery(query, function (artist) {
    this.topTracksForArtist(artist, function (songs) {
        if (songs.length) {
          this.parseAndReturnTracks(songs, callback);
        } else {
          this.tracksForTrackQuery(query, function (songs) {
            this.parseAndReturnTracks(songs, callback);
          }.bind(this));
        }
      }.bind(this));
  }.bind(this));
}

MusicSearch.prototype.tracksForTrackQuery = function(query, callback) {
  console.log("*  Searching for specific track:", query);

  this.topTracksForQuery(query, function (topTracks) {
    //console.log(JSON.stringify(topTracks));

    var topTrack = topTracks.shift();
    if (!topTrack) return callback(undefined);

    this.radioForTrack(topTrack, function (radio) {
      console.log("*  Creating radio for track:", query);

      callback([].concat(topTrack, radio.songs))
    }.bind(this));
  }.bind(this));
}

MusicSearch.prototype.tracksForArtist = function(artist, callback) {
  console.log("*  Searching for artist tracks:", artist);

  this.topTracksForArtist(artist, function (topTracks) {
    callback(topTracks);  
  }.bind(this));
}

MusicSearch.prototype.parseAndReturnTracks = function(songs, callback) {

  var tracks = [];
  var lastSong = undefined;
  for (var i in songs) {
    var song = songs[i];

    if (lastSong && (lastSong.artist_name == song.artist_name)
      && (lastSong.song_hotttnesss == song.song_hotttnesss || lastSong.title == song.title)) continue;
    if (song.tracks && song.tracks.length) {

      var uri = song.tracks[0].foreign_id;
      uri = uri.replace('spotify-WW', 'spotify');
          console.log(song.artist_name, "-",  song.title, song.song_hotttnesss, uri);
      var songInfo = {
        uri: uri,
        artist: song.artist_name,
        title: song.title,
      }
      tracks.push(songInfo);
    }
    lastSong = song;
  }
  callback(tracks);
}




  // echonest.song.search({
  //   title: params.toValue,
  //   bucket: ['id:spotify-WW', 'tracks', "song_hotttnesss"],
  //   sort: ["song_hotttnesss-desc"],
  //   limit: 'true',
  // }, function (error, data) {
  //   var topArtist = data.songs.shift();
  //   console.log(topArtist);

  // });

  // echonest.song.search({
  //   artist: params.toValue,
  //   bucket: ['id:spotify-WW', 'tracks', "song_hotttnesss"],
  //   sort: ["song_hotttnesss-desc"],
  //   limit: 'true',
  // }, function (error, response) {
  //   if (error) {
  //       console.log(error, response);
  //   } else {
  //       // see the whole response
  //       console.log('response:', response);
  //       for (var i in response.songs) {
  //         var song = response.songs[i];
  //         if (song.tracks && song.tracks.length) {
  //                     console.log(song);

  //           var uri = song.tracks[0].foreign_id;
  //           uri = uri.replace('spotify-WW', 'spotify');
  //           console.log(uri);
  //           sonos.components['Main'].playSpotifyTrack(uri);
  //           break;
  //         }
  //       }
  //   }
  // });



exports.MusicSearch = MusicSearch;

