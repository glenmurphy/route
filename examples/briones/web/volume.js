function Volume(on, socket, parentNode) {
  this.node = createElement("div");
  this.on = on;
  this.socket = socket;

  if (Volume.CSS_APPENDED != true) {
    var css = document.createElement("style");
    css.type = "text/css";
    css.innerHTML = Volume.CSS;
    document.body.appendChild(css);
    Volume.CSS_APPENDED = true;
  }

  this.node = createElement("div", "volume", parentNode);
  this.nodeSlider = createElement("input", "", this.node);
  this.nodeSlider.type = "range";
  this.nodeSlider.min = "0";
  this.nodeSlider.max = "80";
  this.nodeSlider.addEventListener("change", this.handleSlider.bind(this), false);

  this.nodeDB = createElement("div", "volume-db", this.node);

  this.socket.on(this.on, this.handleVolume.bind(this));
  this.socket.emit("getState", this.on);
}

Volume.CSS = " \
.volume { \
  position: relative; \
  margin-bottom:1px; \
  margin-top:0px; \
  padding:0; \
  margin-left:0; \
  width: 300px; \
  text-align: center; \
  overflow:hidden; \
} \
.volume input[type='range'] { \
  -webkit-appearance: none; \
  border-radius:0px; \
  height:42px; \
  background-color:#222; \
  width:300px; \
  padding:0; \
  margin:0; \
} \
.volume input[type='range']:focus { \
  outline: none; \
} \
.volume-db { \
  position:absolute; \
  top:0px; \
  color: #666; \
  padding-right:8px; \
  padding-top:6px; \
  height: 42px; \
  border-right:1px solid #555; \
  font-family:Noto Sans, helvetica, sans-serif; \
  font-size:21px; \
} \
.volume input[type='range']::-webkit-slider-thumb { \
  -webkit-appearance: none; \
  border-radius: 3px; \
  width:64px; \
  height:42px; \
  opacity:0; \
  box-sizing:border-box; \
  box-shadow:inset 0px 0px 1px white, 0px 1px 2px 1px rgba(0, 0, 0, 0.6); \
  background-image:-webkit-linear-gradient(top, #f5f6f6 0%, #c7d3e1 100%); \
} \
";

Volume.prototype.updateStyle = function() {
  value = (this.nodeSlider.value - this.nodeSlider.min) / 
          (this.nodeSlider.max - this.nodeSlider.min);
  this.nodeSlider.style.backgroundImage = [
      '-webkit-gradient(',
        'linear, ',
        'left top, ',
        'right top, ',
        'color-stop(' + value + ', #333), ', // match the inactive stereo controls
        'color-stop(' + value + ', rgba(0, 0, 0, 0))',
      ')'
  ].join('');
  this.nodeDB.style.right = 300 - (300 * value);
  this.nodeDB.innerHTML = -(this.nodeSlider.max - this.nodeSlider.value);//parseInt(value * 100);
};

Volume.prototype.handleVolume = function(data) {
  console.log(data);
  this.nodeSlider.value = data.volume;
  this.updateStyle();
};

Volume.prototype.handleSlider = function() {
  var vol = parseInt(this.nodeSlider.value);
  this.socket.emit("DeviceEvent", this.on + "." + vol);
  this.updateStyle();
};
