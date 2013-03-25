function Sonos(name, socket, parentNode) {
  this.name = name;
  this.socket = socket;
  this.state = "PAUSED";
  // Get current state
  this.socket.emit("getState", name + ".TrackInfo");
  this.socket.emit("getState", name + ".PlayingState");

  // Listen for new states
  this.socket.on(name + ".TrackInfo", this.handleTrackInfo.bind(this));
  this.socket.on(name + ".PlayingState", this.handlePlayingState.bind(this));

  if (Sonos.CSS_APPENDED == false) {
    var css = document.createElement("style");
    css.type = "text/css";
    css.innerHTML = Sonos.CSS
    document.body.appendChild(css);
    Sonos.CSS_APPENDED = true;
  }

  this.node = createElement("div", "sonos", parentNode);

  this.nodeArt = createElement("div", "sonos-art", this.node, "");
  
  this.nodeControls = createElement("div", "sonos-controls", this.node);
  this.nodeName = createElement("div", "sonos-name", this.nodeControls, "-");
  this.nodeArtist = createElement("div", "sonos-artist", this.nodeControls, "-");
  this.nodeAlbum = createElement("div", "sonos-album", this.nodeControls, "-");
  this.nodePlay = createElement("div", "sonos-play", this.nodeControls, "");

  this.node.addEventListener("click", this.handlePlay.bind(this));
};

Sonos.CSS = " \
.sonos { \
  position: relative; \
  width: 240px; \
  height: 240px; \
  font-family: helvetica, arial, sans-serif; \
  font-size: 12px; \
  padding: 0px !important; \
  margin: 5px !important; \
  background-color: #333; \
  color: #ccc; \
  text-shadow:0px 1px 0px #000; \
  border-radius:4px; \
  cursor: pointer; \
  box-sizing:border-box; \
  border-top: 1px solid rgba(255, 255, 255, 0.1); \
  box-shadow:0px 4px 2px rgba(0, 0, 0, 0.4); \
} \
.sonos-art { \
  position:absolute; \
  top: 0px; \
  left: 0px; \
  width: 100%; \
  height: 100%; \
  border-radius:4px; \
  background-position: center center; \
  background-size: cover; \
} \
.sonos-controls { \
  position: absolute; \
  bottom: 5px; \
  left: 5px; \
  width: 230px; \
  height: 50px; \
  background-color: rgba(0, 0, 0, 0.85); \
  border-radius:2px; \
} \
.sonos-name { \
  position: absolute; \
  top: 6px; \
  left: 10px; \
  font-size:14px; \
  width:160px; \
  height:30px; \
  overflow:hidden; \
  text-overflow:ellipsis; \
  white-space:nowrap; \
} \
.sonos-artist { \
  position: absolute; \
  top: 27px; \
  left: 10px; \
} \
.sonos-album { \
  position: absolute; \
  top: 50px; \
  left: 10px; \
  display:none; \
} \
.sonos-play { \
  position: absolute; \
  top: 10px; \
  right: 10px; \
  width: 30px; \
  height: 30px; \
  background-size:cover; \
  background-position:center center; \
  background-image:url(sonos-play.png); \
} \
.sonos-play.playing { \
  background-image:url(sonos-pause.png); \
} \
";
Sonos.CSS_APPENDED = false;

Sonos.prototype.handleTrackInfo = function(details) {
  console.log(details);
  this.nodeArtist.innerHTML = details.artist;
  this.nodeName.innerHTML = details.name;
  this.nodeAlbum.innerHTML = details.album;
  this.nodeArt.style.backgroundImage = (details.artwork) ? 'url(' + details.artwork + ')' : "";
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
