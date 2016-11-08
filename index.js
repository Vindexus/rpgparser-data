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
  this.gameData = this.loadFolder(this.dir, 'gameData')
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

Parser.prototype.loadFolder = function (folder, intoPath) {
  this.log('-------------')
  this.log('into: ' + intoPath)
  var data = {}
  var files = fs.readdirSync(folder)

  //Load the index if it exists
  var indexPath = folder + '/index.js'
  if(fs.existsSync(indexPath)) {
    data = this.readFile(folder + '/index.js')
    this.log('load index into ' + intoPath)
  }
  else {
    this.log('NO INDEX IN ' + folder)
  }

  for(var i = 0; i < files.length; i++) {
    var key = files[i]
    this.log('i', i)
    this.log('key before', key)
    //Remove the extension from filenames for the gameData key
    //skills.js would go into gameData.skills
    if(key.indexOf(".") > 0) {
      var parts = key.split(".")
      parts = parts.slice(0, parts.length - 1)
      this.log('parts', parts)
      key = parts.join(".")
    }
    else if (key.indexOf(".") == 0) {
      key = key.substr(1)
    }
    this.log("KEY:", key)
    var filePath = folder + '/' + files[i]
    //this.log('filePath', filePath)
    if(fs.lstatSync(filePath).isDirectory()) {
      //If the folder starts with a . then we put in root
      //So gamedata/classes/warrior/.moves/doubleattack.js gould go into this.gameData.moves.doubleattack
      if(files[i].substr(0, 1) == '.') {
        this.log('DOT, load into root')
        console.error('The .folder code is not yet implemented.')
        //this.loadFolder(filePath, this.gameData[files[i].substr(1)], 'gameData.' + files[i].substr(1))
      }
      else {
        data[key] = this.loadFolder(filePath, intoPath + '.' + key)
      }
    }
    else {
      this.log('load this key: ' + key + ' into ' + intoPath)
      if(key == 'index') {
        this.log('this is an index already loaded')
      }
      else {
        if(!data.hasOwnProperty(key)) {
          this.log('clear the into cause it does not have: ' + key)
          data[key] = {}
        }
        data[key] = this.readFile(filePath)
      }
    }
  }
  this.log('returning data to ' + intoPath + ': ' + JSON.stringify(data))
  return data
}

Parser.prototype.saveGameDataFile = function () {
  this.log('this.config.outputFile', this.config.outputFile)
  fs.writeFile(this.config.outputFile, JSON.stringify(this.gameData), function (err) {
    if(err) {
      console.error(err)
    }
    this.log('YAY')
  })
}

Parser.prototype.run = function () {
  this.log("shortcuts: ", this.config.shortcuts)
  this.loadSimples()
  this.loadFolders()
  this.log('Game data parsed: ', JSON.stringify(this.gameData))
  this.saveGameDataFile()
}


module.exports = new Parser()