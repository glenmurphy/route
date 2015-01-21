function Stereo(components, socket, parentNode) {
  this.components = components;
  this.socket = socket;

  if (Stereo.CSS_APPENDED == false) {
    var css = document.createElement("style");
    css.type = "text/css";
    css.innerHTML = Stereo.CSS
    document.body.appendChild(css);
    Stereo.CSS_APPENDED = true;
  }

  this.node = createElement('div', 'stereo', parentNode);

  // Components highlight based on activation of their 'on' command
  // however, getState causes old messages to arrive. We figure out
  // which was the most recent based on the data, which is the time
  // the item was activated. TODO: make all states have time.
  this.lastUpdated = 0;
  for (var i = 0, component; component = components[i]; i++) {
    var c = new Component(component, i, this);
    this.node.appendChild(c.node);
    component.component = c;
  }
}

Stereo.CSS = " \
.stereo { \
  position:relative; \
  z-index:1; \
  display:inline-block; \
  width: 300px; \
  height: 64px; \
  transition:all 0.1s; \
  background-color:#222; \
  margin-bottom:1px; \
} \
.stereo-component { \
  position:absolute; \
  top:0px; \
  height: 64px; \
  box-sizing:border-box; \
  padding-top:8px; \
  color:#666; \
  font-family: helvetica, arial, sans-serif; \
  font-size:14px; \
  font-weight:bold; \
  text-align:center; \
  background-repeat:no-repeat; \
  background-position: center center; \
  opacity:0.2; \
  -webkit-transition:all 0.15s; \
  cursor:pointer; \
} \
.stereo-component:hover { \
  opacity:0.4; \
} \
.stereo-component.on { \
  opacity:1; \
  background-color:#333; \
} \
.stereo-component.on:hover { \
  opacity:1; \
} \
";
Stereo.CSS_APPENDED = false;

Stereo.prototype.handleOn = function(component, time) {
  if (time < this.lastUpdated) return;

  this.focus(component);
  this.lastUpdated = time;
};

Stereo.prototype.focus = function(component) {
  if (this.focused) this.focused.unfocus();

  this.focused = component;
  this.focused.focus();
};

Stereo.prototype.handleClick = function(component) {
  this.socket.emit("DeviceEvent", [component.action].join("."));
};

function Component(data, index, parent) {
  this.node = createElement("div", "stereo-component", parent.node, "");
  this.action = data.action;
  this.parent = parent;
  this.on = data.on;
  this.socket = parent.socket;

  if (this.on)
    this.socket.on(this.on, this.handleOn.bind(this));
  this.socket.emit("getState", this.on);

  var width = (100 / parent.components.length);
  this.node.style.width = width + '%';
  this.node.style.left = index * width + '%';
  if (data.image)
    this.node.style.backgroundImage = 'url('+data.image+')';
  else
    this.node.appendChild(document.createTextNode(data.name));
  this.node.addEventListener("click", this.handleClick.bind(this), false);
};

Component.prototype.handleClick = function() {
  this.parent.handleClick(this);
};

Component.prototype.handleOn = function(data) {
  this.parent.handleOn(this, data.stateUpdatedTime);
};

Component.prototype.focus = function() {
  this.node.classList.add('on');
};

Component.prototype.unfocus = function() {
  this.node.classList.remove('on');
};
