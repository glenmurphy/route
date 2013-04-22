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

  this.socket.on(this.on, this.handleVolume.bind(this));
  this.socket.emit("getState", this.on);
}

Volume.CSS = " \
.volume { \
  position: relative; \
  margin-bottom:14px; \
  width: 300px; \
  text-align: center; \
} \
.volume input[type='range'] { \
  -webkit-appearance: none; \
  border-radius:5px; \
  height:10px; \
  background-color:#1b2229; \
  box-shadow:0 0 1px 1px rgba(255, 255, 255, 0.075); \
  width:300px; \
} \
.volume input[type='range']::-webkit-slider-thumb { \
  -webkit-appearance: none; \
  border-radius: 8px; \
  width:16px; \
  height:16px; \
  box-sizing:border-box; \
  box-shadow:inset 0px 0px 1px white, 0px 1px 2px 1px rgba(0, 0, 0, 0.6); \
  background-image:-webkit-linear-gradient(top, #f5f6f6 0%, #c7d3e1 100%); \
  transition:all 0.2s; \
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
        'color-stop(' + value + ', #686f76), ', // match the inactive stereo controls
        'color-stop(' + value + ', rgba(0, 0, 0, 0))',
      ')'
  ].join('');
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
