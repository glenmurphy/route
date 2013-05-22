var EventEmitter = require('events').EventEmitter;
var util = require('util');
var fs = require('fs');

var asana = require('asana-api');

function Asana(data) {
  this.key = data.key;
  this.workspaces = {};
  this.projects = {};
  this.client = asana.createClient({apiKey: this.key});

  this.client.workspaces.list(function (err, workspaces) {
    if (!workspaces) return;
    for (var i = 0; i < workspaces.length; i++) {
      this.workspaces[workspaces[i].name] = workspaces[i].id;
    };
  }.bind(this));

  this.client.projects.list(function (err, projects) {
    if (!projects) return;
    for (var i = 0; i < projects.length; i++) {
      this.projects[projects[i].name] = projects[i].id;
    };
  }.bind(this));
}
util.inherits(Asana, EventEmitter);

Asana.prototype.exec = function(command, params) {
  if (command == "AddTask") {
    this.addTask(params);
  } else {
    this.log(command);
  }
};

Asana.prototype.addTask = function(params) {

  var workspaceId = this.workspaces[params.workspace] || params.workspace;
  var projectId = this.projects[params.project] || params.project; 
  console.log(params, workspaceId, projectId);
  this.client.tasks.create(workspaceId, projectId, params, function (err, projects) {
    console.log("Added task: ", projects);
  });
}

exports.Asana = Asana;