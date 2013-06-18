//This module is in charge of ensuring the version tag at the
//top of an .m3u8 media playlist is correct.

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new VersionChecker(expressApp, streamRegistry);
	}
};

function VersionChecker(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP streams stack
	this.app.use("/streams", function(req, res, next) {
		that.checkVersion(req, res, next);
	});
}

VersionChecker.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
}

VersionChecker.prototype.checkVersion = function(req, res, next) {
	var versionTagIndex = -1;
	var currentVersion = 1;
	
	if (req.HlsMetadata.isMediaPlaylist) {
	
		var lines = req.HlsMetadata.data;
		for (var i=0; i<lines.length; ++i) {
			if (lines[i].search(/#EXT-X-VERSION/) >= 0) {
				versionTagIndex = i++;
				continue;
			}
			if (lines[i].search(/#EXT-X-KEY/) >= 0 &&
				lines[i].search(/IV=/) >=0) {
				currentVersion = Math.max(currentVersion, 2);
				continue;
			}
		}
	}
	
	console.log("Current version: " + currentVersion);
	console.log("Current version index: " + versionTagIndex);
	
	if (versionTagIndex <0) {
		//No version tag exists, insert one
		lines.splice(1,0, "#EXT-X-VERSION:" + currentVersion);
	} else {
		//Version tag exists. Modify the version number to suit our fancy needs
		lines[versionTagIndex] = "#EXT-X-VERSION:" + currentVersion;
	}
	
	next();
}