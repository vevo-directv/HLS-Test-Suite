//This module is the main proxy for the Media Playlists.
//It answers HTTP requests for them and makes sure access rules (firewall)
//are respected.

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new MediaPlaylistHandler(expressApp, streamRegistry);
	}
};

var http = require('http');
var url = require('url');

function MediaPlaylistHandler(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP redirections
	this.app.use('/streams', function(req, res) {
		that.mediaPlaylistProxy(req, res);
	});
}

MediaPlaylistHandler.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
} 

//This function is just SO ugly. Needs refactoring...
MediaPlaylistHandler.prototype.mediaPlaylistProxy = function(req, res) {

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

	
	if (typeof this.streamRegistry[streamId] === 'undefined') {
		console.log("Attempting to access non existing stream: " + streamId);
		res.send(404, "Not found");
	} else if (!this.streamRegistry[streamId].status) {
		console.log("Attempting to access a disabled stream: " + streamId);
		res.send(404, "Not found");
	} else {
	
		var uriToGet;
		var isGettingPlaylist = (typeof file === 'undefined'); 
	
		//Determine what uri we must connect to
		if (isGettingPlaylist) {
			//We are getting a playlist so we just have to take the uri we already know
			uriToGet = this.streamRegistry[streamId].uri;
		} else {
			if (file.search(/:\/\//) >= 0) {
				//We have absolute file url so just pass it along
				uriToGet = file;
			} else {
				//We have relative file url so we must concatenate it with the baseUrl of the remote host
				uriToGet = this.streamRegistry[streamId].uri.substr(0, this.streamRegistry[streamId].uri.lastIndexOf("/")) + "/" + file;
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

}