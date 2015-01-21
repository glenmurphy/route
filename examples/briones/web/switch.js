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
  width: 99px; \
  margin-right:1px; \
  margin-bottom:1px; \
  height: 64px; \
  background-clip: padding-box; \
  background-color: #222; \
  box-sizing:border-box; \
  font-family: Noto Sans, helvetica, arial, sans-serif; \
  font-size:14px; \
  cursor:pointer; \
  transition:all 0.1s; \
} \
.switch:first-child { \
  margin-left:0px; \
} \
.switch:last-child { \
  width:100px; \
  margin-right:0px; \
} \
.switch:hover { \
  background-color:#333; #235fa7; \
} \
.switch:active { \
  margin-top:2px; \
  box-shadow: inset 0 -1px 0 rgba(0,0,0,.2), 0px 1px 5px 2px rgba(0, 0, 0, 0.2); \
} \
.switch.on { \
  background-color:#494; \
  border:1px solid #5b5; \
} \
.switch.on:hover { \
  //background-color:#3a3a3a; \
} \
.switch-on { \
  position:absolute; \
  top:0px; \
  left:0px; \
  width:100px; \
} \
.switch-name { \
  position:absolute; \
  top:22px; \
  left:0px; \
  width:100%; \
  font-size:14px; \
  color:#888; \
  text-align:center; \
} \
.switch.on .switch-name { \
  color:#eee; \
  text-shadow:0px 1px 0px rgba(0, 0, 0, 0.75); \
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
