var EventEmitter = require('events').EventEmitter;
var https = require('https');
var url = require('url');
var util = require('util');
var CryptoJS = require("crypto-js");
var uuid = require('node-uuid');
var querystring = require('querystring');

function GMusic(config) {
	var that = this;
  this._email = config.email;
  this._password = config.password;
	this._authToken = config.authToken;
	this.debug = config.debug;

	// Load signing keys
	var s1 = CryptoJS.enc.Base64.parse('VzeC4H4h+T2f0VI180nVX8x+Mb5HiTtGnKgH52Otj8ZCGDz9jRWyHb6QXK0JskSiOgzQfwTY5xgLLSdUSreaLVMsVVWfxfa8Rw==');
  var s2 = CryptoJS.enc.Base64.parse('ZAPnhUkYwQ6y5DdQxWThbvhJHN8msQ1rqJw0ggKdufQjelrKuiGGJI30aswkgCWTDyHkTGK9ynlqTkJ5L4CiGGUabGeo8M6JTQ==');
  for(var idx = 0; idx < s1.words.length; idx++) {
      s1.words[idx] ^= s2.words[idx];
  }
  this._key = s1;

	that._getXt(function(xt) {
    that._xt = xt;
    that.getSettings(function(response) {
      that._allAccess = response.settings.isSubscription;

      var devices = response.settings.devices.filter(function(d) {
          return d.type === "PHONE" || d.type === "IOS";
      });

      if(devices.length > 0) {
        that._deviceId = devices[0].id.slice(2);
        that.emit("DeviceEvent", "Connected");
      } else {
      	console.log("!  GMusic - Unable to find a usable device on your account, access from a mobile device and try again");
      }
    }, function(message, data, err, res) {
    	console.log("!  GMusic - Login Failed, unable to get settings: " + message);
    });
	}, function(message, data, err, res) {
		console.log("!  GMusic - Login Failed, unable to get xt (part of google auth): " + message);
	});
};
util.inherits(GMusic, EventEmitter);

GMusic.prototype._baseURL = 'https://www.googleapis.com/sj/v1.5/';
GMusic.prototype._webURL = 'https://play.google.com/music/';
GMusic.prototype._mobileURL = 'https://android.clients.google.com/music/';
GMusic.prototype._accountURL = 'https://www.google.com/accounts/';

// Utility functions
var pmUtil = {};

pmUtil.parseKeyValues = function(body) {
  var obj = {};
  body.split("\n").forEach(function(line) {
    var pos = line.indexOf("=");
    if(pos > 0) obj[line.substr(0, pos)] = line.substr(pos+1);
  });
  return obj;
};

pmUtil.Base64 = {
  _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
  stringify: CryptoJS.enc.Base64.stringify,
  parse: CryptoJS.enc.Base64.parse
};

pmUtil.salt = function(len) {
  return Array.apply(0, Array(len)).map(function() {
    return (function(charset){
        return charset.charAt(Math.floor(Math.random() * charset.length));
    }('abcdefghijklmnopqrstuvwxyz0123456789'));
  }).join('');
};

GMusic.prototype.request = function(options) {
    var opt = url.parse(options.url);
    opt.headers = {};
    opt.method = options.method || "GET";
    if(typeof options.options === "object") {
        Object.keys(options.options).forEach(function(k) {
            opt[k] = options.options[k];
        });
    }
		opt.headers.Authorization = "GoogleLogin auth=" + this._authToken;
    opt.headers["Content-type"] = options.contentType || "application/x-www-form-urlencoded";

    var req = https.request(opt, function(res) {
        res.setEncoding('utf8');
        var body = "";
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            if(res.statusCode === 200) {
                options.success(body, res);
            } else {
                options.error(body, null, res);
            }
        });
        res.on('error', function() {
            options.error(null, Array.prototype.slice.apply(arguments), res);
        });
    });
    if(typeof options.data !== "undefined") req.write(options.data);
    req.end();
};

GMusic.prototype._getXt = function (success, error) {
    var that = this;
    this.request({
        method: "HEAD",
        url: this._webURL + "listen",
        success: function(data, res) {
            // @TODO replace with real cookie handling
            var cookies = {};
            res.headers['set-cookie'].forEach(function(c) {
                var pos = c.indexOf("=");
                if(pos > 0) cookies[c.substr(0, pos)] = c.substr(pos+1, c.indexOf(";")-(pos+1));
            });

            if (typeof cookies.xt !== "undefined") {
                success(cookies.xt);
            } else {
                that.error("xt cookie missing", data, null, res);
                return;
            }
        },
        error: function(data, err, res) {
            that.error("request for xt cookie failed", data, err, res);
        }
    });
};

GMusic.prototype.exec = function(command, params) {
  console.log("*  GMusic Executing: " + command);
  console.log(params);
  
  if (command == "search") {
  	this.search(params.text, params.maxResults, params.callback);
  }

  // if (command == "Listen") {
  //   this.listenTo(params.query, params.context);
  // } else {
  //   this.bridge.exec("Spotify." + command);
  // }
};

/**
 * Returns settings / device ids authorized for account.
 *
 * @param success function(settings) - success callback
 * @param error function(data, err, res) - error callback
 */
GMusic.prototype.getSettings = function(success, error) {
    var that = this;

    this.request({
        method: "POST",
        url: this._webURL + "services/loadsettings?" + querystring.stringify({u: 0, xt: this._xt}),
        contentType: "application/json",
        data: JSON.stringify({"sessionId": ""}),
        success: function(body, res) {
            var response = JSON.parse(body);
            that.success(success, response, res);
        },
        error: function(body, err, res) {
            that.error(error, "error loading settings", body, err, res);
        }
    });
};

/**
 * Returns list of all tracks
 *
 * @param success function(trackList) - success callback
 * @param error function(data, err, res) - error callback
 */
GMusic.prototype.getLibrary = GMusic.prototype.getAllTracks = function(success, error) {
    var that = this;
    this.request({
        method: "POST",
        url: this._baseURL + "trackfeed",
        success: function(data, res) {
            that.success(success, JSON.parse(data), res);
        },
        error: function(data, err, res) {
            that.error("error retrieving all tracks", data, err, res);
        }
    });
};

/**
 * Returns stream URL for a track.
 *
 * @param id string - track id, hyphenated is preferred, but "nid" will work for all access tracks (not uploaded ones)
 * @param success function(streamUrl) - success callback
 * @param error function(data, err, res) - error callback
 */
GMusic.prototype.getStreamUrl = function (id, success, error) {
    var that = this;
    var salt = pmUtil.salt(13);
    var sig = CryptoJS.HmacSHA1(id + salt, this._key).toString(pmUtil.Base64);
    var qp = {
        u: "0",
        net: "wifi",
        pt: "e",
        targetkbps: "8310",
        slt: salt,
        sig: sig
    };
    if(id.charAt(0) === "T") {
        qp.mjck = id;
    } else {
        qp.songid = id;
    }

    var qstring = querystring.stringify(qp);
    this.request({
        method: "GET",
        url: this._mobileURL + 'mplay?' + qstring,
        options: { headers: { "X-Device-ID": this._deviceId } },
        success: function(data, res) {
            that.error(error, "successfully retrieved stream urls, but wasn't expecting that...", data, err, res);
            console.log(data);
        },
        error: function(data, err, res) {
            if(res.statusCode === 302) {
                that.success(success, res.headers.location, res);
            } else {
                that.error(error, "error getting stream urls", data, err, res);
            }
        }
    });
};

/**
 * Searches for All Access tracks.
 *
 * @param text string - search text
 * @param maxResults int - max number of results to return
 * @param success function(searchResults) - success callback
 */
GMusic.prototype.search = function (text, maxResults, success) {
    var that = this;
    var qp = {
        q: text,
        "max-results": maxResults
    };
    var qstring = querystring.stringify(qp);
    this.request({
        method: "GET",
        url: this._baseURL + 'query?' + qstring,
        success: function(data, res) {
          that.success(success, JSON.parse(data), res);
        },
        error: function(data, err, res) {
          console.log("!  GMusic: Error getting search results");
        }
    });
};

/**
 * Returns list of all playlists.
 *
 * @param success function(playlists) - success callback
 */
GMusic.prototype.getPlayLists = function (success) {
  var that = this;
  this.request({
    method: "POST",
    url: this._baseURL + 'playlistfeed',
    success: function(data, res) {
        that.success(success, JSON.parse(data), res);
    },
    error: function(data, err, res) {
        that.error(error, "error getting playlist results", data, err, res);
    }
  });
};

/**
 * Returns list of all playlists.
 *
 * @param query String - playlist name
 * @param success function(playlists) - success callback
 */
GMusic.prototype.getPlayListId = function (query, success) {
  var that = this;
  this.request({
    method: "POST",
    url: this._baseURL + 'playlistfeed',
    success: function(data, res) {
        
        var json = JSON.parse(data);
        var playlists = json.data.items;
        for(key in playlists) {
        	if (playlists[key].name == query) {
        		that.success(success, playlists[key].id, res);
        	}
        }
    },
    error: function(data, err, res) {
        that.error(error, "error getting playlist results", data, err, res);
    }
  });
};

/**
 * Returns trackId for given playlist name
 *
 * @param success function(trackId Array) - success callback
 * TODO: Return a json with nid and track id etc - to ask for album art later
 */
GMusic.prototype.getPlayListSongs = function (query, success, error) {

	console.log("*  GMusic: Getting song nids for playlist " + query);

	this.getPlayListId(query, function(playlistId) {
		if (this.debug) console.log("*  GMusic: Getting song nids for playlist id " + playlistId);	
		this.getPlayListEntries(function(playlistEntries) {
			var matchingEntries = [];
			for(key in playlistEntries.data.items) {
				if (playlistEntries.data.items[key].playlistId == playlistId) {
					matchingEntries.push(playlistEntries.data.items[key].trackId);
				}
			}
			this.success(success, matchingEntries);
		}.bind(this));
	}.bind(this));
};

/**
 * Returns tracks on all playlists.
 *
 * @param success function(playlistEntries) - success callback
 * @param error function(data, err, res) - error callback
 */
GMusic.prototype.getPlayListEntries = function (success, error) {
    var that = this;
    this.request({
        method: "POST",
        url: this._baseURL + 'plentryfeed',
        success: function(data, res) {
            that.success(success, JSON.parse(data), res);
        },
        error: function(data, err, res) {
            that.error(error, "error getting playlist results", data, err, res);
        }
    });
};

/**
* Creates a new playlist
*
* @param playlistName string - the playlist name
* @param success function(mutationStatus) - success callback
* @param error function(data, err, res) - error callback
*/
GMusic.prototype.addPlayList = function (playlistName, success, error) {
    var that = this;
    var mutations = [
    {
        "create": {
            "creationTimestamp": -1,
            "deleted": false,
            "lastModifiedTimestamp": 0,
            "name": playlistName,
            "type": "USER_GENERATED"
        }
    }
    ];
    this.request({
        method: "POST",
        contentType: "application/json",
        url: this._baseURL + 'playlistbatch?' + querystring.stringify({alt: "json"}),
        data: JSON.stringify({"mutations": mutations}),
        success: function(data, res) {
            that.success(success, JSON.parse(data), res);
        },
        error: function(data, err, res) {
            that.error(error, "error adding a playlist", data, err, res);
        }
    });
};

/**
* Adds a track to end of a playlist.
*
* @param songId int - the song id
* @param playlistId int - the playlist id
* @param success function(mutationStatus) - success callback
* @param error function(data, err, res) - error callback
*/
GMusic.prototype.addTrackToPlayList = function (songId, playlistId, success, error) {
    var that = this;
    var mutations = [
        {
            "create": {
                "clientId": uuid.v1(),
                "creationTimestamp": "-1",
                "deleted": "false",
                "lastModifiedTimestamp": "0",
                "playlistId": playlistId,
                "source": (songId.indexOf("T") == 0 ? "2" : "1"),
                "trackId": songId
            }
        }
    ];
    this.request({
        method: "POST",
        contentType: "application/json",
        url: this._baseURL + 'plentriesbatch?' + querystring.stringify({alt: "json"}),
        data: JSON.stringify({"mutations": mutations}),
        success: function(data, res) {
            that.success(success, JSON.parse(data), res);
        },
        error: function(data, err, res) {
            that.error(error, "error adding a track into a playlist", data, err, res);
        }
    });
};

/**
* Removes given entry id from playlist entries
*
* @param entryId int - the entry id. You can get this from getPlayListEntries
* @param success function(mutationStatus) - success callback
* @param error function(data, err, res) - error callback
*/
GMusic.prototype.removePlayListEntry = function (entryId, success, error) {
    var that = this;
    var mutations = [ { "delete": entryId } ];

    this.request({
        method: "POST",
        contentType: "application/json",
        url: this._baseURL + 'plentriesbatch?' + querystring.stringify({alt: "json"}),
        data: JSON.stringify({"mutations": mutations}),
        success: function(data, res) {
            that.success(success, JSON.parse(data), res);
        },
        error: function(data, err, res) {
            that.error(error, "error removing a playlist entry", data, err, res);
        }
    });
};

/**
 * Returns info about an All Access album.  Does not work for uploaded songs.
 *
 * @param albumId string All Access album "nid" -- WILL NOT ACCEPT album "id" (requires "T" id, not hyphenated id)
 * @param includeTracks boolean -- include track list
 * @param success function(albumList) - success callback
 * @param error function(data, err, res) - error callback
 */
GMusic.prototype.getAlbum = function (albumId, includeTracks, success, error) {
    var that = this;
    this.request({
        method: "GET",
        url: this._baseURL + "fetchalbum?" + querystring.stringify({nid: albumId, "include-tracks": includeTracks, alt: "json"}),
        success: function(data, res) {
            that.success(success, JSON.parse(data), res);

        },
        error: function(data, err, res) {
            that.error(error, "error getting album tracks", data, err, res);
        }
    });
};

/**
 * Returns info about an All Access track.  Does not work for uploaded songs.
 *
 * @param trackId string All Access track "nid" -- WILL NOT ACCEPT track "id" (requires "T" id, not hyphenated id)
 * @param success function(trackInfo) - success callback
 * @param error function(data, err, res) - error callback
 */
GMusic.prototype.getAllAccessTrack = function (trackId, success, error) {
    var that = this;
    this.request({
        method: "GET",
        url: this._baseURL + "fetchtrack?" + querystring.stringify({nid: trackId, alt: "json"}),
        success: function(data, res) {
            that.success(success, JSON.parse(data), res);

        },
        error: function(data, err, res) {
            that.error(error, "error getting album tracks", data, err, res);
        }
    });
};

/**
 * Returns Artist Info, top tracks, albums, related artists
 *
 * @param artistId string - not sure which id this is
 * @param includeAlbums boolean - should album list be included in result
 * @param topTrackCount int - number of top tracks to return
 * @param relatedArtistCount int - number of related artists to return
 * @param success function(artistInfo) - success callback
 * @param error function(data, err, res) - error callback
 */
GMusic.prototype.getArtist = function (artistId, includeAlbums, topTrackCount, relatedArtistCount, success, error) {
  var that = this;
  this.request({
    method: "GET",
    url: this._baseURL + "fetchartist?" + querystring.stringify({nid: artistId, "include-albums": includeAlbums, "num-top-tracks": topTrackCount, "num-related-artists": relatedArtistCount, alt: "json"}),
    success: function(data, res) {
        that.success(success, JSON.parse(data), res);
    },
    error: function(data, err, res) {
        that.error("error getting album tracks", data, err, res);
    }
  });
};

GMusic.prototype.success = function (success, data) {
  success = typeof success === "function" ? success : function(data) {
      console.log(util.inspect(data, {depth: null, colors: true}));
  };
  success(data);
};
GMusic.prototype.error = function (error, data, err, res) {
  error = typeof success === "function" ? success : function() {
      console.error(error, util.inspect(err, {depth: 2, colors: true}));
  };
  error(error, data, err, res);
};

exports.GMusic = GMusic;