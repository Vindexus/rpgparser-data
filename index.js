var path          = require('path')
var fs            = require('fs')

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

Parser.prototype.loadFolders = function () {
  this.loadFolder(this.dir, this.gameData, 'gameData')
}

Parser.prototype.readMDFile = function (filePath) {
  var contents = fs.readFileSync(filePath, "utf8")
  var lines = contents.split("\n")
  var obj = {
    name: lines[0].replace('#', '').trim(),
    description: ""
  }
  lines.shift()
  obj.description = lines.join("\n")
  return obj
}

Parser.prototype.readFile = function (filePath) {
  var ext = path.extname(filePath)
  if(ext == '.md') {
    return this.readMDFile(filePath)
  }
  else if(ext == '.js') {
    return require(filePath)
  }
}

Parser.prototype.loadFolder = function (folder, into, intoPath) {
  console.log('-------------')
  console.log('into: ' + intoPath)
  console.log('gameData', JSON.stringify(this.gameData))
  into = into || {}
  var files = fs.readdirSync(folder)

  //Load the index if it exists
  var indexPath = folder + '/index.js'
  if(fs.existsSync(indexPath)) {
    into = this.readFile(folder + '/index.js')
    console.log('load index into ' + intoPath)
    console.log('into', JSON.stringify(into))
  }
  else {
    console.log('NO INDEX IN ' + folder)
  }

  for(var i = 0; i < files.length; i++) {
    var key = files[i]
    console.log('i', i)
    console.log('key before', key)
    //Remove the extension from filenames for the gameData key
    //skills.js would go into gameData.skills
    if(key.indexOf(".") > 0) {
      var parts = key.split(".")
      parts = parts.slice(0, parts.length - 1)
      console.log('parts', parts)
      key = parts.join(".")
    }
    else if (key.indexOf(".") == 0) {
      key = key.substr(1)
    }
    console.log("KEY:", key)
    var filePath = folder + '/' + files[i]
    //this.log('filePath', filePath)
    if(fs.lstatSync(filePath).isDirectory()) {
      into[key] = {}
      //If the folder starts with a . then we put in root
      //So gamedata/classes/warrior/.moves/doubleattack.js gould go into this.gameData.moves.doubleattack
      if(files[i].substr(0, 1) == '.') {
        console.log('DOT, load into root')
        this.loadFolder(filePath, this.gameData[files[i].substr(1)], 'gameData.' + files[i].substr(1))
      }
      else {
        console.log('load folder in into[' + key + ']')
        this.loadFolder(filePath, into[key], intoPath + '.' + key)
      }
    }
    else {
      console.log('load this key: ' + key + ' into ' + intoPath)
      if(key == 'index') {
        console.log('this is an index already loaded')
      }
      else {
        if(!into.hasOwnProperty(key)) {
          console.log('clear the into cause it does not have: ' + key)
          into[key] = {}
        }
        into[key] = this.readFile(filePath)
      }
    }
  }

  console.log('DONE ' + intoPath + ': ' + JSON.stringify(this.gameData))
}

Parser.prototype.run = function () {
  this.log("shortcuts: ", this.config.shortcuts)
  this.loadSimples()
  this.loadFolders()
  this.log('Game data parsed: ', JSON.stringify(this.gameData))
}


module.exports = new Parser()