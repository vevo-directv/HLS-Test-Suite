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
	var resource = req.HlsMetadata.resource;
	
	//Determine if we are dealing with a Media Playlist or a Media Segment
	if (resource == "") {
		//We are getting a playlist so we just have to take the uri we already know
		uriToGet = this.streamRegistry[req.HlsMetadata.streamId].uri;
		req.HlsMetadata.isMediaPlaylist = true;
		req.HlsMetadata.isMediaSegment = false;
		
		http.get(uriToGet, function(incomingResponse) {
			that.getMediaPlaylist(req, outgoingResponse, incomingResponse, next);
		});
	} else {
		//We are getting a Media Segment. Determine if its uri is relative or absolute
		if (resource.search(/:\/\//) < 0) {
			//We have relative file url so we must concatenate it with the baseUrl of the remote host of our stream
			uriToGet = this.streamRegistry[req.HlsMetadata.streamId].uri.substr(0, this.streamRegistry[req.HlsMetadata.streamId].uri.lastIndexOf("/")) + "/" + resource;
		} else {
			uriToGet = resource; //Nothing to do in case of absolute, we leave the uri as is.
		}
		
		req.HlsMetadata.isMediaPlaylist = false;
		req.HlsMetadata.isMediaSegment = true;
		
		http.get(uriToGet, function(incomingResponse) {
			that.getMediaSegment(req, outgoingResponse, incomingResponse, next);
		});
	}
	
	//console.log("ResourceHandler: URI to get: " + uriToGet);
}

ResourceHandler.prototype.getMediaPlaylist = function(req, outgoingResponse, incomingResponse, next) {
	var fileContent = "";
	var currentLine = "";
	var lines = new Array();

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
				lines.push(currentLine);
				currentLine = "";
			}
		}
		
	}).on('end', function() {
		lines.push(currentLine);
		outgoingResponse.setHeader("Connection" , "Keep-Alive");
		req.HlsMetadata.data = lines;
		next();
		
	}).on('error', function() {
		console.log("Error while fetching: " + uriToGet );
		outgoingResponse.send(404, "Not found");
	});
}

ResourceHandler.prototype.getMediaSegment = function(req, outgoingResponse, incomingResponse, next) {
	
	var currentLine = "";
	var bufferList = new Array();
	var totalBufferLength = 0;
	
	//Use the same headers from the request to the real server, but remove ETAG do prevent caching
	for (var header in incomingResponse.headers) {
		if (header.toUpperCase() != "ETAG") {
			outgoingResponse.setHeader(header, incomingResponse.headers[header]);
			//console.log("ResourceHandler: "header + ": " + incomingResponse.headers[header]);
		}	
	}
	outgoingResponse.setHeader("Cache-Control", "no-cache");
	
	incomingResponse.on('data', function(chunk) {
		bufferList.push(chunk);
		totalBufferLength += chunk.length;
		
	}).on('end', function() {
		req.HlsMetadata.data = Buffer.concat(bufferList, totalBufferLength);
		next();
		
	}).on('error', function() {
		console.log("Error while fetching: " + uriToGet );
		outgoingResponse.send(404, "Not found");
	});
}