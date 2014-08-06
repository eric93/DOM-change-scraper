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
    } else if (req.url.split('/').length > 1 && req.url.split('/')[1] == 'store') {
        console.log('Got store request');
        if(req.method == 'POST') {
            var body = ''
            req.on('data', function(m) {
                body += m
            });
            req.on('end', function(m) {
                if(m)
                    body += m
                console.log('Parsing url');

                var parsedUrl = req.url.split('/');
                if (parsedUrl.length == 4) {
                    var domain = parsedUrl[2];
                    var dataType = parsedUrl[3];

                    if((dataType != 'changes' && dataType != 'originaldom') || !domain.match(/^([a-z]+\.[a-z]+)+$/)) {
                        console.log('Catastrophic mission failure: dataType = ' + dataType + ' & domain = ' + domain);
                        return;
                    }

                    fs.mkdir('data/'+domain, 0755, function(err) {
                        if(err && err.code != 'EEXIST') {
                            console.log(err);
                        } else {
                            console.log('Made directory');
                            fs.writeFile('data/' + domain + '/' + dataType, body, function(err) {
                                if(err){
                                    console.log(err);
                                } else {
                                    console.log('Wrote data file: ' + domain + '/' + dataType);
                                }
                            });
                        }
                    });

                    
                } else {
                    console.log("Invalid url: " + req.url);
                }
            });
        } else {
            console.log("Can't do stores without POST");
        }
    }
    else {
        console.log('Unknown url: ' + req.url);
    }
}).listen(8080,"127.0.0.1");

console.log("Server running");
