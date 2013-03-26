/* 
 * syslog-messages.js
 * 
 * Encoding and decoding of CentOS syslog messages.
 *
 * @version: 0.1.0
 * @author Frank Grimm (http://frankgrimm.net)
 *
 */

// returns textual representation for a severity level (0-9), otherwise "N/A"
exports.getSeverityDescription = function (severity) {
  switch(severity) {
    case 0: return "Emergency";
    case 1: return "Alert";
    case 2: return "Critical";
    case 3: return "Error";
    case 4: return "Warning";
    case 5: return "Notice";
    case 6: return "Informational";
    case 7: return "Debug";
    default: return "N/A";
  }
}

// returns facility names according to RFC3164
exports.facilityIdToName = function (id) {
  switch(id) {
    case 0: return "kernel messages";
    case 1: return "user-level messages";
    case 2: return "mail system";
    case 3: return "system daemons";
    case 4: return "security/authorization messages";
    case 5: return "messages generated internally by syslogd";
    case 6: return "line printer subsystem";
    case 7: return "network news subsystem";
    case 8: return "UUCP subsystem";
    case 9: return "clock daemon";
    case 10: return "security/authorization messages";
    case 11: return "FTP daemon";
    case 12: return "NTP subsystem";
    case 13: return "log audit";
    case 14: return "log alert";
    case 15: return "clock daemon";
    case 16: return "local use 0";
    case 17: return "local use 1";
    case 18: return "local use 2";
    case 19: return "local use 3";
    case 20: return "local use 4";
    case 21: return "local use 5";
    case 22: return "local use 6";
    case "23": return "local use 7";
    default:
      return "UNKNOWN";
  }
}

exports.encodeMessage = function (msgobject, callback) {
  // only act on valid facility & severity
  if (msgobject.facility_id == -1 || msgobject.severity_id == -1)
    callback(null);

  // recalculate pri part to make sure it matches facility and severity
  msgobject.pri = msgobject.facility_id * 8 + msgobject.severity_id;

  var msgstring = "<" + msgobject.pri + ">" + msgobject.tag;
  if (msgobject.pid != "") {
    msgstring += "[" + msgobject.pid + "]";
  }
  msgstring += ": " + msgobject.content + "\n";

  callback(msgstring);
}

exports.decodeMessage = function (msg, callback) {
  var result = {"original": msg,
    "received": new Date(),
    "pri": -1,  
    "facility_id": -1,
    "facility": "UNKNOWN",
    "severity_id": -1, 
    "severity": "N/A",
    "tag": "",
    "pid": "",
    "content": ""};

    // preserve original message
    result.original = msg;

  var vcharExp = new RegExp("[a-zA-Z0-9 \t\/]");
  var partStart = -1, partEnd = -1;
  partStart = msg.indexOf('<');

  if (partStart > -1) {
    partEnd = msg.indexOf('>', partEnd);
    if (partEnd > -1) {
      result.pri = parseInt(msg.substring(partStart+1, partEnd));

      // decode pri part into facility# and severity
      result.severity_id = result.pri % 8;
      result.facility_id = (result.pri - result.severity_id) / 8;

      // lookup facility identifier
      result.facility = exports.facilityIdToName(result.facility_id);
      // lookup textual description for severity
      result.severity = exports.getSeverityDescription(result.severity_id);

      // seperate content, tag and optionally pid
      msg = msg.substr(partEnd + 1);
      for(var i = 0; i < msg.length; i++) {
        if (!vcharExp.test(msg.substr(i, 1))) {
          result.tag = msg.substring(0, i);
          msg = msg.substr(i);
          break;
        }
      }

      if (msg.substr(0, 1) == "[") {
        partEnd = msg.indexOf("]");
        if (partEnd > -1) {
          result.pid = msg.substring(1, partEnd);
          result.content = msg.substr(partEnd + 1);
        } else {
          result.content = msg;
        }
      } else {
        result.content = msg;
      }

      // remove ":", ": " at the start and "\n" at the end
      if (result.content.substr(0, 1) == ":") {
        result.content = result.content.substr(1);
        if (result.content.substr(0, 1) == " ")
          result.content = result.content.substr(1);
      }
      if (result.content.substr(result.content.length - 1, 1) == "\n")
        result.content = result.content.substr(0, result.content.length - 1);
      }
    }

    // invoke the callback
    callback(result);
}
