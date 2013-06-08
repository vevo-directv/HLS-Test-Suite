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
}

Encrypter.prototype.updateSocket = function(socket) {
	var that = this;
	this.socket = socket;
	
	//Event hookups
	
}