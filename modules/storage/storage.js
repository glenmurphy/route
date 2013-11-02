var persist = require('node-persist');
persist.initSync({dir:process.cwd() + "/storage/"});

function Storage(prefix) {
  if (prefix) this.prefix = prefix;
};

Storage.prototype.setItem = function(key, value) {
  persist.setItem(this.realKey(key), value);
}

Storage.prototype.getItem = function(key) {
  return persist.getItem(this.realKey(key));
}

Storage.prototype.realKey = function(key) {
  return this.prefix ? this.prefix + ":" + key : key;
}

exports.Storage = Storage;
