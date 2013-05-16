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

  this.node = createElement("a", "switch", parentNode);
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
  border-radius: 3px; \
  margin-bottom: 3px; \
  background-clip: padding-box; \
  background-color: #2b3e52; #1f579a; \
  box-sizing:border-box; \
  box-shadow: inset 0 -2px 0 rgba(0,0,0,.2), 0px 1px 7px 3px rgba(0, 0, 0, 0.15); \
  background-image: \
    -webkit-linear-gradient(bottom, rgba(0,0,0,.1) 0%, rgba(255,255,255,.1) 100%), \
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
  background-color:#30465e; #235fa7; \
} \
.switch:active { \
  margin-top:2px; \
  height: 47px; \
  box-shadow: inset 0 -1px 0 rgba(0,0,0,.2), 0px 1px 5px 2px rgba(0, 0, 0, 0.2); \
} \
.switch.on { \
  background-color:#cc8635; \
} \
.switch.on:hover { \
  background-color:#d39043; \
} \
.switch-on { \
  position:absolute; \
  top:0px; \
  left:0px; \
  width:100px; \
} \
.switch-name { \
  position:absolute; \
  top:15px; \
  left:0px; \
  font-weight:bold; \
  width:100%; \
  font-size:14px; \
  color:rgba(255, 255, 255, 0.75); \
  text-shadow:0px 1px 3px rgba(0, 0, 0, 0.75); \
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
