function Switch(name, desc, socket, parentNode) {
  this.name = name;
  this.desc = desc;
  this.socket = socket;

  this.socket.on(name, this.handleBrightness.bind(this));
  this.socket.emit("getState", name);

  if (Switch.CSS_APPENDED == false) {
    var css = document.createElement("style");
    css.type = "text/css";
    css.innerHTML = Switch.CSS
    document.body.appendChild(css);
    Switch.CSS_APPENDED = true;
  }

  this.node = createElement("div", "switch", parentNode);
  this.nodeOn = createElement("div", "switch-on", this.node, "");
  this.nodeName = createElement("div", "switch-name", this.node, this.desc);
  this.nodeOff = createElement("div", "switch-off", this.node, "");

  this.node.addEventListener("click", this.handleClick.bind(this), false);
}

Switch.CSS = " \
.switch { \
  position:relative; \
  z-index:1; \
  display:inline-block; \
  width: 96px; \
  margin-right:6px; \
  height: 48px; \
  border-radius: 5px; \
  margin-bottom: 3px; \
  background-clip: padding-box; \
  background-color: #1f579a; \
  box-sizing:border-box; \
  box-shadow: inset 0 -4px 0 rgba(0,0,0,.35); \
  background-image: \
    -webkit-linear-gradient(bottom, rgba(0,0,0,.1) 0%, rgba(255,255,255,.16) 100%), \
    url(noise1.png); \
  font-family: helvetica, arial, sans-serif; \
  font-size:14px; \
  cursor:pointer; \
  transition:all 0.1s; \
} \
.switch:last-child { \
  margin-right:0px; \
} \
.switch:hover { \
} \
.switch.on { \
  background-color:#f7a03c; \
} \
.switch-on { \
  position:absolute; \
  top:0px; \
  left:0px; \
  width:100px; \
} \
.switch-name { \
  position:absolute; \
  top:14px; \
  left:0px; \
  font-weight:bold; \
  width:100%; \
  font-size:14px; \
  color:white; \
  text-shadow:0px 1px 3px rgba(0, 0, 0, 0.3); \
  text-align:center; \
} \
.switch.on .switch-name { \
} \
";
Switch.CSS_APPENDED = false;

Switch.prototype.handleBrightness = function(details) {
  console.log(details);
  var brightness = parseInt(details.brightness);
  if (isNaN(brightness)) return;
  this.brightness = brightness;
  if (brightness > 10)
    this.node.classList.add("on");
  else
    this.node.classList.remove("on");
};

Switch.prototype.handleClick = function() {
  var state = (this.brightness > 10) ? "Off" : "On";
  this.socket.emit("DeviceEvent", [this.name, state].join("."));
};
