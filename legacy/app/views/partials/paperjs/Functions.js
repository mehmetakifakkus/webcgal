//////////////// math functions  //////////////////////////

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function range(start, stop, step){
  var a=[start], b=start;
  while(b<stop){b+=step;a.push(b)}
  return a;
};

function shuffle(a) {
    var result = [], j, i, temp = a.slice(0); // copy the content

    for (i = temp.length; i; i--) {
        j = Math.floor(Math.random() * i);
        result.push(temp[j])
        temp.splice(j, 1) //bu eksiltme işlemi burada gerçekleşiyor
    }
    return result;
}

//////////////// Array Functions  ////////////////////////////

// -1 refers last element
Array.prototype.delete = function(n){
    var del = (n < 0) ? del = this.length + n : n;
    return this.slice(0, del).concat(this.slice(del+1)); //delete the middle of the last three points
}


////////////////   vector processes   ////////////////////////

function dotProduct(v1, v2){
    return v1.x * v2.x + v1.y * v2.y;
}

function crossProduct(v1, v2){
    return v1.x * v2.y - v2.x * v1.y;
}
