logStr = '';
function print(str){
    logStr = logStr.concat(''+str+'\n');

    var place = document.getElementById("console");
    $(place.childNodes[0]).remove()
    editor = createCodeMirror2(place, {}, logStr);
}

function clear(){
    logStr = '';
    $(document.getElementById("console").childNodes[0]).remove()
}

if(logStr.length == 0)
    clear();
