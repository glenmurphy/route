function Switch(name, socket, parentNode) {
  this.name = name;
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
  this.nodeOn = createElement("div", "switch-on", this.node, "On");
  this.nodeName = createElement("div", "switch-name", this.node, name);
  this.nodeOff = createElement("div", "switch-off", this.node, "Off");

  this.nodeOn.addEventListener("click", this.handleOn.bind(this));
  this.nodeOff.addEventListener("click", this.handleOff.bind(this));
}

Switch.CSS = " \
.switch { \
  position:relative; \
  width:50px; \
  height:100px; \
  background-color:#555; \
  font-family: helvetica, arial, sans-serif; \
  font-size:12px; \
} \
.switch.on { \
  background-color:red; \
} \
";
Switch.CSS_APPENDED = false;

Switch.prototype.handleBrightness = function(details) {
  console.log(details);
  var brightness = parseInt(details.brightness);
  if (isNaN(brightness)) return;
  if (brightness > 10)
    this.node.classList.add("on");
  else
    this.node.classList.remove("on");
};

Switch.prototype.handleOn = function() {
  console.log("emitting");
  this.socket.emit("DeviceEvent", this.name + ".On");
};

Switch.prototype.handleOff = function() {
  console.log("emitting");
  this.socket.emit("DeviceEvent", this.name + ".Off");
};
