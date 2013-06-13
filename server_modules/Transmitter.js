//This module takes care of transmitting the final resource
//(Media playlist or segment) to a client after all the processing
//has been done

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new Transmitter(expressApp, streamRegistry);
	}
};

function Transmitter(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP middleware
	this.app.use('/streams', function(req, res, next) {
		that.transmit(req, res, next);
	});
}

Transmitter.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
} 

Transmitter.prototype.transmit = function(req, res, next) {
	if (req.HlsMetadata.isMediaPlaylist) {
		console.log("Transmitter: transmitting playlist");
		this.transmitMediaPlaylist(req, res);
	} else {
		console.log("Transmitter: transmitting segment");
		this.transmitMediaSegment(req, res);
	}
}

Transmitter.prototype.transmitMediaPlaylist = function(req, res) {
	var fileContent = "";
	var lines = req.HlsMetadata.data;
	for (var i=0; i<lines.length-1; ++i) {
		fileContent += lines[i];
		fileContent += '\n';
	}
	fileContent += lines[lines.length-1];
	res.send(200, fileContent);
}

Transmitter.prototype.transmitMediaSegment = function(req, res) {
	res.write(req.HlsMetadata.data);
	res.end();
}