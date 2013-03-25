function Switch(name, desc, socket, parentNode) {
  this.name = name;
  this.desc = desc;
  this.socket = socket;

  this.socket.emit("getState", name);
  this.socket.on(name, this.handleBrightness.bind(this));

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

  this.node.addEventListener("click", this.handleClick.bind(this));
}

Switch.CSS = " \
.switch { \
  position:relative; \
  width:240px; \
  height:50px; \
  margin:5px; \
  background-color:#333; \
  font-family: helvetica, arial, sans-serif; \
  font-size:12px; \
  border-radius:4px; \
  cursor:pointer; \
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
  top:16px; \
  left:0px; \
  width:240px; \
  font-size:14px; \
  color:white; \
  text-align:center; \
} \
.switch.on .switch-name { \
  color:black; \
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
