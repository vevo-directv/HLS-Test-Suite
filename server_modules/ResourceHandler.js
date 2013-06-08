//This module is the main proxy for the Media Playlists.
//It answers HTTP requests for Media Playlists and Media Segments

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new ResourceHandler(expressApp, streamRegistry);
	}
};

var http = require('http');
var url = require('url');

function ResourceHandler(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP redirections
	this.app.use('/streams', function(req, res, next) {
		that.getResource(req, res, next);
	});
}

ResourceHandler.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
} 

ResourceHandler.prototype.getResource = function(req, outgoingResponse, next) {

	var that = this;
	var uriToGet;
	
	//Determine if we are dealing with a Media Playlist or a Media Segment
	if (req.url == "/") {
		//We are getting a playlist so we just have to take the uri we already know
		uriToGet = this.streamRegistry[req.HlsMetadata.streamId].uri;
		req.HlsMetadata.isMediaPlaylist = true;
		req.HlsMetadata.isMediaSegment = false;
		
		http.get(uriToGet, function(incomingResponse) {
			that.getMediaPlaylist(req, outgoingResponse, incomingResponse, next);
		});
	} else {
		//We are getting a Media Segment. Determine if its uri is relative or absolute
		if (req.url.search(/:\/\//) < 0) {
			//We have relative file url so we must concatenate it with the baseUrl of the remote host of our stream
			uriToGet = this.streamRegistry[req.HlsMetadata.streamId].uri.substr(0, this.streamRegistry[req.HlsMetadata.streamId].uri.lastIndexOf("/")) + "/" + req.url;
		} 
		//Nothing to do in case of absolute, we leave the uri as is.
		
		req.HlsMetadata.isMediaPlaylist = false;
		req.HlsMetadata.isMediaSegment = true;
		
		http.get(uriToGet, function(incomingResponse) {
			that.getMediaSegment(req, outgoingResponse, incomingResponse, next);
		});
	}
}

ResourceHandler.prototype.getMediaPlaylist = function(req, outgoingResponse, incomingResponse, next) {
	var fileContent = "";
	var currentLine = "";

	incomingResponse.setEncoding("utf8");
	outgoingResponse.setHeader("Content-Type", "application/vnd.apple.mpegurl");
	outgoingResponse.setHeader("Cache-Control", "no-cache");
	
	incomingResponse.on('data', function(chunk) {
		
		//If we are getting a playlist, we must modify the uri's inside
		for (var i=0; i<chunk.length; ++i) {
			if (chunk[i].search(/[^\r\n]/) >= 0) {
				currentLine += chunk[i];
			} else if (chunk[i].search(/$/) >= 0 && currentLine.length != 0) {
				if (currentLine[0] != "#") {
					currentLine = req.HlsMetadata.streamId + "/" + currentLine; //Modify the URL to the MediaSegment so we can intercept the requests
				}
				fileContent += currentLine;
				fileContent += "\n"
				currentLine = "";
			}
		}
		
	}).on('end', function() {
		fileContent += currentLine;
		outgoingResponse.setHeader("Connection" , "Keep-Alive");
		outgoingResponse.send(200, fileContent);
		
	}).on('error', function() {
		console.log("Error while fetching: " + uriToGet );
		outgoingResponse.send(404, "Not found");
	});
}

ResourceHandler.prototype.getMediaSegment = function(req, outgoingResponse, incomingResponse, next) {
	var fileContent = "";
	var currentLine = "";

	
	//Use the same headers from the request to the real server, but remove ETAG do prevent caching
	for (var header in subRes.headers) {
		if (header.toUpperCase() != "ETAG") {
			outgoingResponse.setHeader(header, subRes.headers[header]);
			//console.log("ResourceHandler: "header + ": " + subRes.headers[header]);
		}	
	}
	outgoingResponse.setHeader("Cache-Control", "no-cache");
	
	subRes.on('data', function(chunk) {
		outgoingResponse.write(chunk); //Just write the data out directly to the client
		
	}).on('end', function() {
		outgoingResponse.end();
		
	}).on('error', function() {
		console.log("Error while fetching: " + uriToGet );
		outgoingResponse.send(404, "Not found");
	});
}