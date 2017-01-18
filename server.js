'use strict';
var express = require('express'),
    http = require('http'),
    bodyParser = require('body-parser'),
    compress = require('compression'),
    cmd = require('node-cmd'),
    Promise = require("bluebird"),
    path = require('path'),
    watchr = require('watchr'),
    stalker,
    assetBundlePath = "../Unity-Technologies-assetbundledemo/demo/AssetBundles/Windows",
    app = express(),
    fs = require('fs');

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ 
        extended: true 
    }));
    app.use(compress());
    app.use('/', express.static(__dirname + '/'));



// ====================  Functions ====================

function handleAssetBundlePromise(board) {
    console.log("handleAssetBundlePromise==", board)
    
    var command = '"C:\\Program Files\\Unity\\Editor\\Unity.exe" BOARDNAME=' + board.name + ' MODELS=' + board.models + ' -batchMode -quit -projectPath "C:\\Users\\\David Barto\\Desktop\\Unity-Technologies-assetbundledemo\\demo" -executeMethod "AssetBundles.BuildScript.BuildAssetBundles"';
    console.log("COMMAND==", command);
    console.log("MODELS==", board.models);
    cmd.run(command);

    return new Promise(function(resolve, reject) {
        StalkerInit(board, resolve, reject);
    });
}

function handleModelArrayPromise(boardName, modelArray, resolve, reject){
    fs.writeFile('temp/modelArray.txt', modelArray, function(err) {
        if (err) {
            console.error("write error:  " + err.message);
            reject(err);
        } else {
            resolve({name: boardName, models: modelArray});
        }
    });
}

function StalkerInit(board, res, rej){

    // Define our watching parameters 
    function listener (changeType, fullPath, currentStat, previousStat) {

        var fileName = path.basename(fullPath);

        switch ( changeType ) {
            case 'update':
                
                if(fileName === board.name){
                    console.log('===UPDATE=== the file', fileName, 'was updated', currentStat, previousStat);
                    // Resolve promise
                    res(fileName);

                }
                break;

            case 'create':
            
                if(fileName === board.name){
                    console.log('===CREATE=== the file', fileName, 'was created', currentStat);
                    // Resolve promise
                    res(fileName);
                }
                break;

            case 'delete':
                console.log('the file', fileName, 'was deleted', previousStat);
                break;
        }
    }

    function next (err) {
        if(err) {
            // Reject promise if there was an error
            rej();
            return console.log('watch failed on', assetBundlePath, 'with error', err);
        }

        console.log('watch successful on', assetBundlePath)
    }
     
    // Watch the assetBundlePath with the change listener and completion callback 
    stalker = watchr.open(assetBundlePath, listener, next)

}

// ====================  End points ====================
app.get('/test', function(req, res, next){
    res.json(req.headers);
});

app.get('/board', function(req, res, next){

    var readable = fs.createReadStream('testboard.json');
    readable.pipe(res);
    
});


app.post('/assetbundle', function(req, res, next){

    var // Need to parse because model array comes in as string
        models = JSON.parse(req.body.models),
        boardName = req.body.name,
        filteredModels;

    filteredModels = models.map(function(el){

        var name = el.meta.name;
        // use until Target India fixed the names on models
        var cleanExtStr = name.substr(0, name.length - 4);
        
       return cleanExtStr

    });


    var modelArrayPromise = new Promise(function(res, rej){
            return handleModelArrayPromise(boardName, filteredModels, res, rej);
        })
        .then(function(board){

            return handleAssetBundlePromise(board);
        })
        .then(function(bundle) {
            console.log("TESTING = ", bundle);
            // Stop watching once promise is fulfilled
            stalker.close()
            stalker = null;
            console.log("the bundle is", bundle);
            // res.json({ "message": "built the thing!"});
            res.sendFile(bundle, {'root': '..\\Unity-Technologies-assetbundledemo\\demo\\AssetBundles\\Windows\\'});
        })
        .catch(function(err) {
            console.log("ERROR=", err);
            res.json({ "message": "ERROR!"});
        });
 

    //res.json(filteredModels);
});

// ====================  Starting Port ====================
http.Server(app).listen(3000, function(){
    console.log('listening on *:3000');
});