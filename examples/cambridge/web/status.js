function Status(states, socket, parentNode) {
  /*
    {
      "Proximity.Present" : "Here"
      "Proximity.Away" : "Away" 
    }
   */
  this.states = states;
  this.socket = socket;
  this.lastUpdated = 0;

  for (var state in this.states) {
    this.socket.on(state, this.handleState.bind(this, state));
    this.socket.emit("getState", state);
  }

  if (Status.CSS_APPENDED == false) {
    var css = document.createElement("style");
    css.type = "text/css";
    css.innerHTML = Status.CSS
    document.body.appendChild(css);
    Status.CSS_APPENDED = true;
  }

  setInterval(this.updateTime.bind(this), 5000);
  this.node = createElement("div", "status", parentNode);
  this.nodeName = createElement("div", "status-name", this.node, "");
  this.nodeTime = createElement("div", "status-time", this.node, "");
}

Status.CSS = " \
.status { \
  position:relative; \
  z-index:1; \
  display:inline-block; \
  width: 300px; \
  height: 48px; \
  border-radius: 3px; \
  margin-bottom: 3px; \
  background-clip: padding-box; \
  background-color: #2b3e52; \
  box-sizing:border-box; \
  font-family: helvetica, arial, sans-serif; \
  font-size:14px; \
  transition:all 0.1s; \
} \
.status:last-child { \
  margin-right:0px; \
} \
.status:hover { \
  background-color: #2b3e52; \
} \
.status:active { \
  margin-top:2px; \
  height: 47px; \
} \
.Status.on { \
} \
.Status.on:hover { \
} \
.status-on { \
  position:absolute; \
  top:0px; \
  left:0px; \
  width:100px; \
} \
.status-name { \
  position:absolute; \
  top:10px; \
  left:0px; \
  font-weight:bold; \
  width:100%; \
  font-size:14px; \
  color:rgba(255, 255, 255, 0.75); \
  text-shadow:0px 1px 3px rgba(0, 0, 0, 0.75); \
  text-align:center; \
} \
.status-time { \
  position:absolute; \
  top:26px; \
  width:100%; \
  text-align:center; \
  font-size:10px; \
  color:rgba(255, 255, 255, 0.75); \
} \
.Status.on .status-name { \
} \
";
Status.CSS_APPENDED = false;

Status.prototype.handleState = function(state, details) {
  console.log(details);
  if (details.stateUpdatedTime < this.lastUpdated) return;
  if (!(state in this.states)) return;

  this.nodeName.innerHTML = this.states[state];
  this.lastUpdated = details.stateUpdatedTime;
  this.updateTime();
};


Status.prototype.updateTime = function() {
  var diff = -(this.lastUpdated - (new Date()).getTime()) / 1000;
  var num_unit = (diff < 60 && [Math.max(diff, 0), 'seconds']) ||
    ((diff/=60) < 60 && [diff, 'minutes']) ||
    ((diff/=60) < 72 && [diff, 'hours']) ||
    [diff/=24, 'days'];

  // Round down
  num_unit[0] = Math.floor(num_unit[0]);
  // Singularize unit
  if (num_unit[0] == 1) { num_unit[1] = num_unit[1].replace(/s$/,""); }

  this.nodeTime.innerHTML = num_unit.join(" ") + " ago";
};