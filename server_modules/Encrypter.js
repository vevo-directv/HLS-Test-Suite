//This module is in charge of augmenting a regular stream with
//encryption support.

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new Encrypter(expressApp, streamRegistry);
	}
};

var crypto = require('crypto');
var fs = require('fs');

function Encrypter(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP streams stack
	this.app.use("/streams", function(req, res, next) {
		that.applyEncryption(req, res, next);
	});
	
	//HTTP keys stack
	this.app.use("/keys", function(req, res, next) {
		that.httpKeyRequest(req, res, next);
	});
}

Encrypter.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
}

Encrypter.prototype.storeFragmentRollingKeyIV = function(segment, _key, _iv) {

	var keyIVDictionary = this.streamRegistry[req.HlsMetadata.streamId].keyIVDictionary;
	if (typeof keyIVDictionary === 'undefined') {
		keyIVDictionary = {};
		this.streamRegistry[req.HlsMetadata.streamId].keyIVDictionary = keyIVDictionary;
	}
	
	keyIVDictionary[segment] = { key: key, iv: _iv };
}

Encrypter.prototype.getFragmentRollingKeyIV = function(segment) {

	var keyIVDictionary = this.streamRegistry[req.HlsMetadata.streamId].keyIVDictionary;
	if (typeof keyIVDictionary === 'undefined') {
		return null;
	}
	
	return keyIVDictionary[segment];
}

Encrypter.prototype.applyEncryption = function(req, res, next) {
	//console.log("Encrypter: checking if encryption is necessary");
	
	this.streamRegistry[req.HlsMetadata.streamId].isUsingRollingKeys = true;
	this.streamRegistry[req.HlsMetadata.streamId].keyWindow = 4;
	
	if (this.streamRegistry[req.HlsMetadata.streamId].isUsingRollingKeys ||
		 this.streamRegistry[req.HlsMetadata.streamId].isUsingStaticKeys) {
		 
		if (req.HlsMetadata.isMediaPlaylist) {
		
			this.applyEncryptionToMediaPlaylist(req, res, next);
		
		} else {
			
			this.applyEncryptionToSegment(req, res, next);
		
		}
	}
	
	next();
}

Encrypter.prototype.applyEncryptionToMediaPlaylist = function(req, res, next) {
	var streamObject = this.streamRegistry[req.HlsMetadata.streamId];
	var mediaSequenceNumber = this.findMediaSequenceNumber(req);
	var firstSequenceNumberInThisFetch = mediaSequenceNumber;
	
	//If it is the first time we check for the sequence number, remember it so that rolling keys can be applied consistently
	if (typeof streamObject.firstMediaSequenceNumber === 'undefined') {
		streamObject.firstMediaSequenceNumber = mediaSequenceNumber;
	} 
	
	//Add the key tags where appropriate
	var i=0;
	var lines = req.HlsMetadata.data;
	for (; i<lines.length; ++i) {
		if (lines[i].search(/#EXTINF/) >= 0) {
			var keyIV = this.getKeyIVForMediaSequence(mediaSequenceNumber, lines[i+1], (mediaSequenceNumber == firstSequenceNumberInThisFetch), req);
			if (keyIV != null) {
				lines.splice(i++,0,"#EXT-X-KEY:METHOD=AES-128,URI=\"" + keyIV.uri + "\",IV=0x" + keyIV.iv.toString("hex"));
			}
			++mediaSequenceNumber;
		}
	}
}

Encrypter.prototype.getKeyIVForMediaSequence = function(mediaSequenceNumber, segmentUri, forceFetch, req) {
	var streamObject = this.streamRegistry[req.HlsMetadata.streamId];
	var selectedKeyIV;
	
	//fs.appendFileSync(__dirname + "/log.txt", "Getting key for MSN: " + mediaSequenceNumber +"\n");
	
	//When we are using a static key, we always associate it with the first media sequence number
	var mappedSequenceNumber = streamObject.firstMediaSequenceNumber;
	
	if (streamObject.isUsingRollingKeys) {
		//Map the range of all sequence numbers into a subset of sequence numbers separated by a [keyWindow] interval
		mappedSequenceNumber = parseInt((mediaSequenceNumber - streamObject.firstMediaSequenceNumber) / streamObject.keyWindow) * streamObject.keyWindow + streamObject.firstMediaSequenceNumber;
	}
	
	//fs.appendFileSync(__dirname + "/log.txt", "\tMapped MSN: " + mappedSequenceNumber +"\n");
	
	if (mappedSequenceNumber == mediaSequenceNumber || forceFetch) {
		//forceFetch allows getting the key even though we are not on a keyWindow boundary
		//this is necessary in case the first media segment does not fall onto a keyWindow boundary
		//fs.appendFileSync(__dirname + "/log.txt", "\tMSN Match! Getting key!\n");
		selectedKeyIV = this.getOrCreateKeyIVByMediaSequenceNumber(mappedSequenceNumber, req);
	} else {
		selectedKeyIV = null;
	}
	
	//Map the segment uri to the key (to fetch the correct key when evaluating segments)
	this.mapSegmentUriToKeyIV(segmentUri, streamObject.keyIVMediaSequenceDict[mappedSequenceNumber], req);
	
	return selectedKeyIV;
}

Encrypter.prototype.getOrCreateKeyIVByMediaSequenceNumber = function(mediaSequenceNumber, req) {
	var streamObject = this.streamRegistry[req.HlsMetadata.streamId];
	
	//Create key dictionary if it doesn't exist for the current stream
	if (typeof streamObject.keyIVMediaSequenceDict === 'undefined') {
		streamObject.keyIVMediaSequenceDict = {};
	}

	var keyIV = streamObject.keyIVMediaSequenceDict[mediaSequenceNumber];
	if (typeof keyIV === 'undefined') {
		keyIV = this.createKeyIV(mediaSequenceNumber, req);
	}
	
	return keyIV;
}

Encrypter.prototype.createKeyIV = function(mediaSequenceNumber, req) {
	var streamId = req.HlsMetadata.streamId;
	
	var newKeyIV = {
		key : crypto.pseudoRandomBytes(16),
		iv :  crypto.pseudoRandomBytes(16),
		uri : "http://" + req.headers.host + "/keys/" + streamId + "/" + mediaSequenceNumber + ".bin",
	}
	
	this.streamRegistry[streamId].keyIVMediaSequenceDict[mediaSequenceNumber] = newKeyIV;
	
	return newKeyIV;
}

Encrypter.prototype.mapSegmentUriToKeyIV = function(segmentUri, keyIV, req) {
	var streamObject = this.streamRegistry[req.HlsMetadata.streamId];
	
	//Create mapping table if it doesn't already exist
	if (typeof streamObject.segmentUriKeyIVMap === 'undefined') {
		streamObject.segmentUriKeyIVMap = {};
	}
	
	streamObject.segmentUriKeyIVMap[segmentUri] = keyIV;
	//fs.appendFileSync(__dirname + "/log.txt", "\tMapped URI: " + segmentUri +"\n");
}

Encrypter.prototype.applyEncryptionToSegment = function (req, res, next) {
	//We are getting a media segment. Encrypt it if we have a key.
	var keyIV = this.streamRegistry[req.HlsMetadata.streamId].segmentUriKeyIVMap[req.HlsMetadata.resource];
	console.log("Encrypter: Getting key for resource " + req.HlsMetadata.resource);
	if (keyIV != null) {
		console.log("Encrypter: using key " + keyIV.key.toString("hex"));
		console.log("Encrypter: using iv " + keyIV.iv.toString("hex"));
		var cipher = crypto.createCipheriv('aes-128-cbc', keyIV.key, keyIV.iv);
		cipher.setAutoPadding(false); //Let's do manual padding with PKCS7
		
		//Construct a buffer that is a length multiple of 16
		//Pad with PKCS7 padding to make it even
		var realLength = req.HlsMetadata.data.length;
		var nbPadBytes = 16 - (realLength % 16);
		var srcBuffer = new Buffer(realLength + nbPadBytes);
		req.HlsMetadata.data.copy(srcBuffer, 0, 0, realLength);
		srcBuffer.fill(nbPadBytes, realLength);
		
		req.HlsMetadata.data = cipher.update(srcBuffer, "binary");
		
		//update content-length header because the encrypted packet is a bit bigger
		res.setHeader("content-length", req.HlsMetadata.data.length);
	} else {
		console.log("ENCRYPTER: Could not find key for segment!");
	}
}

Encrypter.prototype.httpKeyRequest = function(req, res, next) {
	console.log("Requesting a key: " + req.HlsMetadata.resource);
	
	var keyFileRequested = req.HlsMetadata.resource;
	var mediaSequenceNumber = parseInt(keyFileRequested.substr(0, keyFileRequested.lastIndexOf(".")));
	
	var streamObject = this.streamRegistry[req.HlsMetadata.streamId];
	if (typeof streamObject.keyIVMediaSequenceDict[mediaSequenceNumber] === 'undefined') {
		res.send(404, "Not found");
	} else {
		res.setHeader("Content-Type", "application/binary");
		res.setHeader("Cache-Control", "no-cache");
		res.statusCode = 200;
		res.write(streamObject.keyIVMediaSequenceDict[mediaSequenceNumber].key, "binary");
		res.end();
	}
}

Encrypter.prototype.findMediaSequenceNumber = function(req) {
	var lines = req.HlsMetadata.data;

	var regex = /^#EXT-X-MEDIA-SEQUENCE:([0-9]+)/g;
	for (var i=0; i<lines.length; ++i) {
		
		var match = regex.exec(lines[i]);
		if (match != null) {
			//fs.appendFileSync(__dirname + "/log.txt", "First MSN: " + match[1] +"\n");
			return parseInt(match[1]);
		}
	}
	
	return 0;
}
