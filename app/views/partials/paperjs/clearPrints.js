logStr = '';
function printLog(str){
    logStr = logStr.concat(''+str+'\n');

    var place = document.getElementById("console");
    $(place.childNodes[0]).remove()
    editor = createCodeMirror2(place, {}, logStr);
}

function clearLog(){
    logStr = '';
    $(document.getElementById("console").childNodes[0]).remove()
}

if(logStr.length == 0)
    clearLog();
