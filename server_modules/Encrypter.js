//This module is in charge of augmenting a regular stream with
//encryption support.

module.exports = {
	start: function(expressApp, streamRegistry) {
		return new Encrypter(expressApp, streamRegistry);
	}
};

function Encrypter(expressApp, streamRegistry) {
	var that = this;

	//Core objects
	this.app = expressApp;
	this.streamRegistry = streamRegistry;
	
	//HTTP streams stack
	this.app.use("/streams", function(req, res, next) {
		that.applyEncryption(req, res, next);
	});
}

Encrypter.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
}

Encrypter.prototype.applyEncryption = function(req, res, next) {
	console.log("Encrypter: checking if encryption is necessary");
	next();
}