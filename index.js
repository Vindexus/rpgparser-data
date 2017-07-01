var path          = require('path')
var fs            = require('fs')
var _             = require('lodash')
var showdown      = require('showdown')
var colors        = require('colors');
var mdConverter   = new showdown.Converter()
mdConverter.setOption('literalMidWordUnderscores', true)
mdConverter.setOption('simpleLineBreaks', true)

var Parser = function () {
  this.config = {
    debug: false,
    pointers: {},
    convertMd: true
  }
  this.gameData = {}
  this.steps = []
}

Parser.prototype.convertMd = function (md) {
  var html = mdConverter.makeHtml(md)
  return html
}

Parser.prototype.log = function() {
  if(this.config.debug) {
    console.log.apply(this, arguments)
  }
}

Parser.prototype.init = function (config) {
  for(var k in config) {
    this.config[k] = config[k];
  }
  this.dir = this.config.gameDataDir
  this.simplesDir = this.config.simplesDir
}

Parser.prototype.registerStep = function (fn, config) {
  this.steps.push({
    fn: fn,
    config: config
  })
}

Parser.prototype.registerStartingStep = function (fn, config) {
  this.steps.unshift({
    fn: fn,
    config: config
  });
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
    description: "",
  }
  lines.shift() //Drop the name
  var text = lines.join("\n")
  var parts = text.split("---")
  if(parts.length > 1) {
    if(this.config.convertMd) {
      obj.explanation = this.convertMd(parts[1])
    }
    else {
      obj.explanation = parts[1].trim()
    }
  }

  if(this.config.convertMd) {
    obj.description = this.convertMd(parts[0])
  }
  else {
    obj.description = parts[0].trim()
  }
  
  obj.key = path.basename(filePath, path.extname(filePath))
  return obj
}

Parser.prototype.readFile = function (filePath) {
  var ext = path.extname(filePath)
  if(ext == '.md') {
    return this.readMDFile(filePath)
  }
  else if(ext == '.js') {
    var contents = require(filePath)
    if(!contents.key) {
      var key = path.basename(filePath, path.extname(filePath));
      if(key != 'index') {
        contents.key = key;
      }
    }
    return contents
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
      //If the folder starts with a _ then we put in root
      //So gamedata/classes/warrior/.moves/doubleattack.js gould go into this.gameData.moves.doubleattack
      if(files[i].substr(0, 1) == '_') {
        var ext = files[i].substr(1)
        this.log('_' + ext + ', load into root')
        this.gameData[ext] = _.extend(this.gameData[ext], this.loadFolder(filePath, 'gameData.' + ext))
      }
      else {
        data[key] = _.extend(this.gameData[key], this.loadFolder(filePath, intoPath + '.' + key))
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
  //this.log('returning data to ' + intoPath + ': ' + JSON.stringify(data))

  //You can declare pointer lists in your game data with the structure of
  /*
  list_name: { points_to : 'things.subthing.list', list: ['array', 'of', 'keys', 'in_that_list']}
  */
  //TODO: Change this to a recursive function that goes all the way down the chain
  for(var k in data) {
    if(typeof data[k] == 'object') {
      var subpath = intoPath.substr('gameData.'.length)
      subpath = subpath + (subpath.length > 0 ? '.' : '') + k
      var obj = data[k]
      if(obj.points_to) {
        this.log('point ' + subpath + ' to ' + obj.points_to)
        this.config.pointers[subpath] = obj.points_to
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
    eval(fromEval)
    if(typeof froms == 'undefined') {
      console.error('WRONG PATH IN POINTER: ' + path)
      continue;
    }
    var to = this.config.pointers[path]
    for(var i = 0; i < froms.length; i++) {
      var key = froms[i]
      var d = 'this.gameData.' + path + '[' + i + ']=this.gameData.' + to + '.' + key;
      try {
        eval(d)
      }
      catch(ex) {
        /*
        console.log('ERROR IN POINTER: '.red + d.red);
        console.log(ex.toString().red);
        */
      }
    }
  }
}

Parser.prototype.saveGameDataFile = function () {
  this.log('this.config.outputFiles', this.config.outputFiles)
  var files = typeof(this.config.outputFiles) == 'string' ? [this.config.outputFiles] : this.config.outputFiles
  var jsonData = JSON.stringify(this.gameData, null, 2)
  files.forEach(function (file) {
    fs.writeFile(file, jsonData, function (err) {
      if(err) {
        console.error(err)
      }
      else {
        console.log('Written to ' + file.bold)
      }
    }.bind(this))
  })
}

Parser.prototype.run = function () {
  this.gameData = _.clone({});
  this.log("shortcuts: ", this.config.shortcuts)
  this.loadSimples()
  this.loadFolders()
  //this.log('Game data parsed: ', JSON.stringify(this.gameData))
  this.steps.forEach(function (step, index) {
    this.gameData = step.fn(_.cloneDeep(this.gameData), step.config);
  }.bind(this));
  this.loadShortcuts()
  this.loadPointers()
  this.saveGameDataFile()
}

Parser.helpers = {
  //Given some game data objects in a key:object style, it will complete
  //things that aren't already there
  completeObjects: function (data) {
    for(var key in data) {
      data[key].key = data[key].key || key;
      data[key].name = data[key].name || Parser.helpers.keyToName(key);
    }
    return data
  },
  keyToName: function (key) {
    return key.split("_").map(Parser.helpers.firstLetterUpper).join(" ")
  },
  firstLetterUpper: function (word, index) {
    if(index > 0 && ['and', 'or', 'the', 'of'].indexOf(word) >= 0) {
      return word
    }
    return word.substr(0,1).toUpperCase() + word.substr(1)
  }
}

module.exports = Parser