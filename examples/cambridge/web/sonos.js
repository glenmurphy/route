function Sonos(name, socket, parentNode) {
  this.name = name;
  this.socket = socket;
  this.state = "PAUSED";

  // Listen for new states
  this.socket.on(name + ".TrackInfo", this.handleTrackInfo.bind(this));
  this.socket.on(name + ".PlayingState", this.handlePlayingState.bind(this));

  // Get state
  this.socket.emit("getState", name + ".TrackInfo");
  this.socket.emit("getState", name + ".PlayingState");

  if (Sonos.CSS_APPENDED == false) {
    var css = document.createElement("style");
    css.type = "text/css";
    css.innerHTML = Sonos.CSS
    document.body.appendChild(css);
    Sonos.CSS_APPENDED = true;
  }

  this.node = createElement("div", "sonos", parentNode);
  this.nodeBackground = createElement("div", "sonos-background", this.node);  
  this.nodeArtwork = createElement("div", "sonos-artwork", this.node);  
  this.nodeName = createElement("div", "sonos-name", this.node, "-");
  this.nodeArtist = createElement("div", "sonos-artist", this.node, "-");
  this.nodeControls = createElement("div", "sonos-controls", this.node);
  this.nodeAlbum = createElement("div", "sonos-album", this.nodeControls, "-");
  this.nodePlay = createElement("div", "sonos-play", this.node, ""); // temp move out

  this.node.addEventListener("click", this.handlePlay.bind(this), false);
};

Sonos.CSS = " \
.sonos { \
  position: relative; \
  width: 300px; \
  height: 100px; \
  font-family: helvetica, arial, sans-serif; \
  font-size: 12px; \
  padding: 0px !important; \
  color: #fff; \
  text-shadow:0px 1px 0px #000; \
  border-radius:5px; \
  cursor: pointer; \
  box-sizing:border-box; \
  background-color: #2b3e52; \
  border-top: 1px solid rgba(255, 255, 255, 0.3); \
  box-shadow: inset 0 -4px 0 rgba(0,0,0,.6), 0px 1px 7px 3px rgba(0, 0, 0, 0.2); \
  background-image: url(noise1.png); \
  background-clip: padding-box; \
  overflow:hidden; \
  transition: all 0.2s; \
} \
.sonos:hover { \
  background-color:#333; \
} \
.sonos-background { \
  position:absolute; \
  top:-10px; \
  left:-10px; \
  width:320px; \
  height:120px; \
  -webkit-filter: grayscale(10%) blur(5px); \
  opacity:0.4; \
  background-position: center center; \
  background-size: cover; \
} \
.sonos-artwork { \
  position:absolute; \
  top:16px; \
  left:16px; \
  border-radius: 32px; \
  width:64px; \
  height:64px; \
  box-sizing:border-box; \
  border:1px solid white; \
  box-shadow: 0px 0px 0px 5px rgba(255, 255, 255, 0.2); \
  background-position: center center; \
  background-size: cover; \
} \
.sonos-name { \
  position: absolute; \
  top: 30px; \
  left: 94px; \
  font-size:14px; \
  font-weight:bold; \
  width:160px; \
  height:30px; \
  overflow:hidden; \
  text-overflow:ellipsis; \
  white-space:nowrap; \
} \
.sonos-artist { \
  position: absolute; \
  top: 50px; \
  left: 94px; \
  width: 160px; \
  overflow:hidden; \
  text-overflow:ellipsis; \
  white-space:nowrap; \
} \
.sonos-controls { \
  display:none; \
  position: absolute; \
  bottom: 0px; \
  border-radius: 0px 0px 5px 5px; \
  left: 0px; \
  width: 240px; \
  height: 50px; \
  background-color:#1f579a; \
  border-top:1px solid #6c9fdd; \
  border-bottom:1px solid #124888; \
  box-shadow:0px 0px 8px 1px rgba(0, 0, 0, 0.35); \
  background-image: \
    -webkit-linear-gradient(bottom, rgba(0,0,0,.1) 0%, rgba(255,255,255,.16) 100%), \
    url(noise1.png); \
} \
.sonos-album { \
  position: absolute; \
  top: 50px; \
  left: 10px; \
  display:none; \
} \
.sonos-play { \
  position: absolute; \
  -top: 5px; \
  -left: 50%; \
  -margin-left:-20px; \
  -width: 39px; \
  -height: 39px; \
  -border-radius: 20px; \
  top:16px; \
  left:16px; \
  border-radius: 32px; \
  width:64px; \
  height:64px; \
  box-sizing:border-box; \
  box-shadow:inset 0px 0px 1px white, 0px 1px 2px 1px rgba(0, 0, 0, 0.6); \
  background-repeat:no-repeat; \
  background-position:center center; \
  background-image:url(sonos-play.png), -webkit-linear-gradient(top, #f5f6f6 0%, #c7d3e1 100%); \
  transition:all 0.2s; \
} \
.sonos-play.playing { \
  background-image:url(sonos-pause.png), -webkit-linear-gradient(top, #f5f6f6 0%, #c7d3e1 100%); \
  opacity:0; \
} \
.sonos:hover .sonos-play.playing { \
  opacity:1; \
} \
";
Sonos.CSS_APPENDED = false;

Sonos.prototype.handleTrackInfo = function(details) {
  console.log(details);
  this.nodeArtist.innerHTML = details.artist;
  this.nodeName.innerHTML = details.name;
  this.nodeAlbum.innerHTML = details.album;
  this.nodeBackground.style.backgroundImage = "-webkit-linear-gradient(bottom, rgba(255, 0, 0, 0.4) 0%, rgba(255, 255, 255, .2) 100%)" + 
      ((details.artwork) ? ', url(' + details.artwork + ')' : "");
  this.nodeArtwork.style.backgroundImage = (details.artwork) ? 'url(' + details.artwork + ')' : "";
};

Sonos.prototype.handlePlayingState = function(details) {
  this.state = details.state;
  if (this.state == "PLAYING")
    this.nodePlay.classList.add("playing");
  else
    this.nodePlay.classList.remove("playing");
};

Sonos.prototype.handlePlay = function() {
  if (this.state == "PLAYING")
    this.socket.emit("DeviceEvent", this.name + ".Pause");
  else
    this.socket.emit("DeviceEvent", this.name + ".Play");
};
