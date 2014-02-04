var EventEmitter = require('events').EventEmitter;
var util = require('util');
var feed = require('feed-read');

function RSS(data) {
  this.debug = data.debug;
  this.url = data.url;
  this.feedname = data.feedname;
  this.keyname = data.name;
  this.maxArticles = data.maxArticles;
  this.fetchRss();
};
util.inherits(RSS, EventEmitter);

RSS.prototype.fetchRss = function() {
  feed(this.url, function(err, articles) { this.onRssFetched(err, articles);}.bind(this));
}

RSS.prototype.onRssFetched = function(err, articles) {
  console.log("RSS Fetched " + this.feedname);
  if (articles.length > this.maxArticles) {
    articles = articles.slice(0, this.maxArticles);
  }
  data = {}
  data[this.keyname] = articles;
  this.emit("StateEvent", data);
  nextCheck = 60 * 60;
  if (this.debug) console.log("RSS checking in", nextCheck);
  setTimeout(this.fetchRss.bind(this), nextCheck * 1000);
}

RSS.prototype.exec = function(command, data) {
  console.log("RSS:" + command);
};

exports.RSS = RSS;