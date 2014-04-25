var EventEmitter = require('events').EventEmitter;
var fb = require('fb');
var util = require('util');

function Facebook(data) {
	this.app_id = data.app_id;
  this.app_secret = data.app_secret;
  this.accessToken;
}
util.inherits(Facebook, EventEmitter);

Facebook.prototype.auth = function() {
  fb.api('oauth/access_token', {
    client_id: this.app_id,
    client_secret: this.app_secret,
    grant_type: 'client_credentials'
  }, function (res) {
    if(!res || res.error) {
        console.log(!res ? 'error occurred' : res.error);
        return;
    }

    this.accessToken = res.access_token;
    console.log(this.accessToken);
    fb.setAccessToken(this.accessToken);
    this.get();
  }.bind(this));
};

Facebook.prototype.get = function() {
  fb.api('music.listens', function (res) {
    if(!res || res.error) {
      console.log(!res ? 'error occurred' : res.error);
      return;
    }
    console.log(res);
  });
};

Facebook.prototype.post = function() {

  fb.api('me/feed', 'post', {message: "TEST"}, function (res) {
    if(!res || res.error) {
      console.log(!res ? 'error occurred' : res.error);
      return;
    }
    console.log('Post Id: ' + res.id);
  });
};

exports.Facebook = Facebook;
