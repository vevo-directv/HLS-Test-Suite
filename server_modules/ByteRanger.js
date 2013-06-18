//This module is in charge of augmenting a regular stream with
//byte range support.

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new ByteRanger(expressApp, streamRegistry);
	}
};

function ByteRanger(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP streams stack
	this.app.use("/streams", function(req, res, next) {
		that.streamObject = that.streamRegistry[req.HlsMetadata.streamId];
		that.applyByteRange(req, res, next);
	});
}

ByteRanger.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
}

ByteRanger.prototype.applyByteRange = function(req, res, next) {
	
	this.streamObject.isByteRangeActivated = false;
	
	//There is only processing to be done for the media playlist. The segment always stays the same
	if (this.streamObject.isByteRangeActivated && req.HlsMetadata.isMediaPlaylist) {
	
		var lines = req.HlsMetadata.data;
		var MSN = this.findMediaSequenceNumber(req);
		var regex = /^#EXTINF:([0-9.]+),/;
		
		console.log("Byte ranger: first MSN = " + MSN);
	
		for (var i=0; i<lines.length; ++i) {
		
			if (lines[i].search(/#EXTINF/) >= 0) {
				this.streamObject.byteRangeSegmentMap[lines[i+1]] = MSN;
				
				
				//Get duration of segment
				var segmentUriLine = lines[i+1];
				var segmentDuration;
				console.log(lines[i]);
				var match = regex.exec(lines[i]);
				if (match != null) {
					segmentDuration = parseFloat(match[1]);
					console.log("segment duration: " + segmentDuration);
					 
					var newDuration = parseInt(Math.ceil(segmentDuration / 2));
					var newExtInfLine = lines[i].replace(match[1], newDuration.toString());
					lines[i] = newExtInfLine;
					
					//Compute the length and offset of the ranges
					//OMFG this can't really be done here... Refactor time!
					
					//Insert the byterange tag for the current segment
					lines.splice(i,0, "#EXT-X-BYTERANGE:");
			
					//Add the other half of the range
					i += 2;
					lines.splice(i,0, newExtInfLine);
					lines.splice(i+1,0, segmentUriLine);
				}
			}
		
		}
	}
	
	next();
}

ByteRanger.prototype.findMediaSequenceNumber = function(req) {
	var lines = req.HlsMetadata.data;
	
	var firstSegmentUri = this.findFirstSegment(req);
	
	//Create a map that will serve to store the association between
	//the segment Uri's and their new media sequence number
	if (typeof this.streamObject.byteRangeSegmentMap === 'undefined') {
		this.streamObject.byteRangeSegmentMap = { };
	}
	
	if (typeof this.streamObject.byteRangeSegmentMap[firstSegmentUri] === 'undefined') {
		//We are just starting to apply byte ranges so take the first media sequence number
		//as indicated by the media playlist
		var regex = /^#EXT-X-MEDIA-SEQUENCE:([0-9]+)/g;
		for (var i=0; i<lines.length; ++i) {
			
			var match = regex.exec(lines[i]);
			if (match != null) {
				return parseInt(match[1]);
			}
		}
	
		return 0;
	} else {
		//Otherwise just forward the modified media sequence number associated to the segment uri
		return this.streamObject.byteRangeSegmentMap[firstSegmentUri];
	}
}

ByteRanger.prototype.findFirstSegment = function(req) {

	var lines = req.HlsMetadata.data;
	
	for (var i=0; i<lines.length; ++i) {
		if (lines[i].search(/#EXTINF/) >= 0) {
			for(i = i+1;i<lines.length; ++i) {
				if (lines[i].search(/#EXT/) < 0) {
					return lines[i];
				}
			}
		}
	}

	return null;
}
