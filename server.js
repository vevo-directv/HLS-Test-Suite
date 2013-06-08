var express = require('express');
var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server, { log: false });
var url = require('url');

server.listen(8081, '0.0.0.0'); 

var masterUri = ""
var baseRemoteUri = "";
var masterLines = new Array();
var currentLine = "";
var socket;

//Stream definition
/*
uri: 
status: 
*/
var streams = {};


function clearAllData() {
	masterUri = "";
	baseRemoteUri = "";
	masterLines = new Array();
	currentLine = "";
	streams = {};
}

  
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/html/admin2.html');
});

app.get('/master.m3u8', function(req, res) {
	
	if (masterLines.length == 0) {
		res.send(404, "Not found");
	} else {
	
		res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
		res.setHeader("Cache-Control", "no-cache");
		
		var masterFile = "";
		for (var i=0; i<masterLines.length; ++i) {
			masterFile += masterLines[i] + "\n";
		}
		
		res.send(200, masterFile);
		console.log("Accessing master");
	}
});

//This is where the proxy server forwards the requests to the real servers.
app.use('/streams', function(req, res) {
	console.log("Client requested URL: " + req.url);
	var tokens = url.parse(req.url).path.split("/");
	
	var streamId;
	var file;
	
	//First identify the streamId to which we are connecting
	if (tokens.length == 2) {
		//We are getting the sub stream playlist, not a .ts
		streamId = tokens[1].split(".")[0];
	} else {
		//Getting a ts, .aac, or whatever.
		streamId = tokens[1];
		
		file = "";
		//Concatenate all the rest together to form the file name
		for (var i=2; i<tokens.length-1; ++i) {
			file += tokens[i];
			file += "/"
		}
		file += tokens[tokens.length-1];
	}

	
	if (typeof streams[streamId] === 'undefined') {
		console.log("Attempting to access non existing stream: " + streamId);
		res.send(404, "Not found");
	} else if (!streams[streamId].status) {
		console.log("Attempting to access a disabled stream: " + streamId);
		res.send(404, "Not found");
	} else {
	
		var uriToGet;
		var isGettingPlaylist = (typeof file === 'undefined'); 
	
		//Determine what uri we must connect to
		if (isGettingPlaylist) {
			//We are getting a playlist so we just have to take the uri we already know
			uriToGet = streams[streamId].uri;
		} else {
			if (file.search(/:\/\//) >= 0) {
				//We have absolute file url
				uriToGet = file;
			} else {
				//We have relative file url so we must concatenate it with the baseUrl of the remote host
				uriToGet = streams[streamId].uri.substr(0, streams[streamId].uri.lastIndexOf("/")) + "/" + file;
			}
		}
		
		//console.log("Uri to get: " + uriToGet);
		
		//Get the requested file and send it back to the client
		http.get(uriToGet, function(subRes) {
		
			var fileContent = "";
			var currentLine = "";
		
			if (isGettingPlaylist) {
				subRes.setEncoding("utf8");
				res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
				//res.statusCode = 200;
			} else {
				for (var header in subRes.headers) {
					if (header.toUpperCase() != "ETAG") {
						res.setHeader(header, subRes.headers[header]);
						//console.log(header + ": " + subRes.headers[header]);
					}	
				}
				
				res.setHeader("Cache-Control", "no-cache");
				//console.log("Cache-Control" + ": " + "no-cache");
			}
			
			subRes.on('data', function(chunk) {
				
				if (isGettingPlaylist) {
					//If we are getting a playlist, we must modify the uri's inside
					for (var i=0; i<chunk.length; ++i) {
						if (chunk[i].search(/[^\r\n]/) >= 0) {
							currentLine += chunk[i];
						} else if (chunk[i].search(/$/) >= 0 && currentLine.length != 0) {
							if (currentLine[0] != "#") {
								currentLine = streamId + "/" + currentLine;
							}
							fileContent += currentLine;
							fileContent += "\n"
							currentLine = "";
						}
					}
				} else {
					res.write(chunk);
				}
			}).on('end', function() {
				if (isGettingPlaylist) {
					fileContent += currentLine;
					res.setTimeout(2000);
					res.setHeader("Connection" , "Keep-Alive");
					res.send(200, fileContent);
				} else {
					res.end();
				}
			}).on('error', function() {
				console.log("Error while fetching: " + uriToGet );
				res.send(404, "Not found");
			});
		});
	}
	
});

app.use(express.static(__dirname + '/html'));

io.sockets.on('connection', function (s) {
  socket = s;

  //Star/stop stream
  s.on('startStream', startStream);
  s.on('stopStream', stopStream);
  
  //Stream status
  s.on('getStreamStatus', function(streamId) {
	s.emit('updateStreamStatus', { id : streamId, status : streams[streamId].status});
  });
  
  //Master playlist load
  s.on('loadMasterPlaylist', loadMasterPlaylist);
  s.on('getStreamList', function() {
	s.emit('updateStreamList', streams);
  });
  s.on('getLoadedMasterUri', function() {
	s.emit('updateLoadedMasterUri', masterUri);
  });
});

function stopStream(streamId) {
	console.log("" + streamId + "...DOWN");
	streams[streamId].status = false;
}

function startStream(streamId) {
	console.log("" + streamId + "...UP");
	streams[streamId].status = true;
}

function loadMasterPlaylist(uri) {
	clearAllData();
	masterUri = uri;
	
	var lastSlash = masterUri.lastIndexOf('/');
	baseRemoteUri = masterUri.substr(0, lastSlash+1);
	console.log("Base URI: " + baseRemoteUri);
	
	http.get(masterUri, function(res) {
	  res.setEncoding('utf8');
	  res.on('data', function(chunk) {
	  
		//Seperate lines
		for (var i=0; i<chunk.length; ++i) {
			if (chunk[i].search(/[^\r\n]/) >= 0) {
				currentLine += chunk[i];
			} else if (chunk[i].search(/$/) >= 0 && currentLine.length != 0) {
				console.log("Line: " + currentLine);
				masterLines.push(currentLine);
				currentLine = ""
			}
		}
	  }).on('end', function() {
		if (currentLine.length > 0) masterLines.push(currentLine);
		detectStreams();
	  });
	}).on('error', function(e) {
	  console.log("Got error: " + e.message);
	});
	
}

function detectStreams() {
	for (var i=0; i<masterLines.length; ++i) {
	
		var line = masterLines[i];
	
		if (line[0] == '#') {
			continue;
		}
		
		var stream = {};
		var streamId = "stream" + (Object.keys(streams).length + 1);
		
		if (line.search(/:\/\//) >= 0) {
			stream.uri = line; //absolute uri, use as is
		} else {
			stream.uri = baseRemoteUri + line;
		}
		stream.status = false;
		
		
		streams[streamId] = stream;
		
		console.log("Creating new stream at URI: " + stream.uri);
		
		masterLines[i] = "streams/" + streamId + ".m3u8";
	}
	
	socket.emit('updateStreamList', streams);
}
