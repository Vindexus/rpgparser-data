var path          = require('path')
var fs            = require('fs')
var _             = require('lodash')
var showdown      = require('showdown')
var mdConverter   = new showdown.Converter()

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
  var gameData = this.loadFolder(this.dir, 'gameData')
  this.gameData = _.extend(this.gameData, gameData)
}

Parser.prototype.readMDFile = function (filePath) {
  var contents = fs.readFileSync(filePath, "utf8")
  var lines = contents.split("\n")
  var obj = {
    name: lines[0].replace('#', '').trim(),
    description: ""
  }
  lines.shift()
  obj.description = mdConverter.makeHtml(lines.join("\n"))
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
        var ext = files[i].substr(1)
        this.log('.' + ext + ', load into root')
        this.gameData[ext] = _.extend(this.gameData[ext], this.loadFolder(filePath, 'gameData.' + ext))
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

  //You can declare pointer lists in your game data with the structure of
  /*
  list_name: { points_to : 'things.subthing.list', list: ['array', 'of', 'keys', 'in_that_list']}
  */
  console.log('intoPath', intoPath)
  for(var k in data) {
    console.log('k', k)
    if(typeof data[k] == 'object') {
      var obj = data[k]
      if(obj.points_to) {
        this.config.pointers[obj.points_to] = k
        data[k] = data[k].list
      }
    }
  }

  return data
}

//If you give config.shorts = ['moves']
//Then every item in gameData.moves will be cloned directly into gameData if it doesn't exist
Parser.prototype.loadShortcuts = function () {
  if(this.config.shortcuts) {
    this.config.shortcuts.forEach(function (s) {
      console.log('shortcut', s)
      //this.log('data', this.gameData[s])
      for(var k in this.gameData[s]) {
        if(!this.gameData[k]) {
          this.gameData[k] = this.gameData[s][k]
        }
      }
    }.bind(this))
  }
}

Parser.prototype.loadPointers = function () {
  for(var path in this.config.pointers) {
    var froms = {}
    var fromEval = 'froms = this.gameData.' + path
    this.log(fromEval)
    eval(fromEval)
    var to = this.config.pointers[path]
    for(var i = 0; i < froms.length; i++) {
      var key = froms[i]
      var d = 'this.gameData.' + path + '[' + i + ']=this.gameData.' + to + '.' + key
      eval(d)
    }
  }
}

Parser.prototype.saveGameDataFile = function () {
  this.log('this.config.outputFile', this.config.outputFile)
  fs.writeFile(this.config.outputFile, JSON.stringify(this.gameData), function (err) {
    if(err) {
      console.error(err)
    }
  }.bind(this))
}

Parser.prototype.run = function () {
  this.log("shortcuts: ", this.config.shortcuts)
  this.loadSimples()
  this.loadFolders()
  this.log('Game data parsed: ', JSON.stringify(this.gameData))
  this.loadShortcuts()
  this.loadPointers()
  this.saveGameDataFile()
}


module.exports = new Parser()