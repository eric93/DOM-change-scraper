var http = require('http');
var fs = require('fs');
http.createServer(function(req, res) {
    if(req.url == '/collector.js') {
        console.log('Got js request');
        res.writeHead(200,{'Content-type': 'text/javascript'});
        fs.readFile('collector.base.js', function(err,data) {
            if(err) {
                console.log(err);
                res.end('\n');
            } else {
                console.log('Sending file');
                res.end(data + '\n');
            }
        });
    } else {
        console.log('Unknown url: ' + req.url);
    }
}).listen(8080,"127.0.0.1");

console.log("Server running");
