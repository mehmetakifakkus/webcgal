paper.settings.applyMatrix = false;
project.activeLayer.transform( new Matrix(1,0,0,-1, 0, view.size.height) );

console.log('View size height(initials.js) '+view.size.height)
console.log('View size width(initials.js) '+view.size.width)


var origin = new Point(0, 0);
var drawables = [];

var colors = ['red', 'blue', 'yellow', 'magenta', 'green'];
var path = null, polPoint = null, textPoint = null;
polygon = null;
