function createCodeMirror2(place, options, source) {
	return new CodeMirror(place, $.extend({}, {
		mode: 'javascript',
		tabSize: 4, indentUnit: 2, readOnly: true,
		value: source,
	}, options));
}

logStr = '';
function print(str){
    logStr = logStr.concat(str+'\n');
    
    var place = document.getElementById("console");
    $(place.childNodes[0]).remove()
    editor = createCodeMirror2(place, {}, logStr);   
}

function clear(){
    logStr = '';
    $(document.getElementById("console").childNodes[0]).remove()
}

var origin = new Point(0, 0);

function convertToRealCoord(p){
    var temp = p.clone();
    temp *= 50;
    temp += new Point(0, 0);
    
    return temp;
}

if(logStr.length == 0)
    clear();
