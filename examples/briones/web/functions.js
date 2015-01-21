function $(o) { return document.getElementById(o); }

function createElement(type, className, parent, text) {
  var elm = document.createElement(type);
  elm.className = className;
  if (text) elm.appendChild(document.createTextNode(text));
  if (parent) parent.appendChild(elm);
  return elm;
}
