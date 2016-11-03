var path          = require('path')

var Parser = function () {
  this.config = {
    debug: false
  }
  this.gameData = {}
}

Parser.prototype.log = function() {
  if(this.config.debug) {
    console.log.apply(this, arguments)
  }
}

Parser.prototype.init = function (config) {
  for(var k in config) {
    this.config[k] = config[k]
  }
  this.dir = this.config.gameDataDir
  this.simplesDir = this.config.simplesDir
}

Parser.prototype.loadSimples = function () {
  for(var i in this.config.simples) {
    var key =  this.config.simples[i];
    this.log('Loading simple: ' + key);
    this.gameData[key] = require(path.resolve(path.join(this.simplesDir, key)));
  }
}

Parser.prototype.run = function () {
  this.log("shortcuts: ", this.config.shortcuts)
  this.loadSimples()
  //this.loadFolders()
  this.log('Game data parsed: ', this.gameData)
}


module.exports = new Parser()