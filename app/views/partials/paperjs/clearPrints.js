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

function convertToRealCoord(p){
    var temp = p.clone();
    temp *= 50;
    temp += new Point(0, 0);

    return temp;
}

if(logStr.length == 0)
    clear();
