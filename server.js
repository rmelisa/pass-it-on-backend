const express = require("express");
const app = express();
const MongoClient = require("mongodb").MongoClient;
const bodyParser = require("body-parser");
const url = "mongodb://admin:matteo1@ds159563.mlab.com:59563/pass_it_on";
const databaseName = "pass_it_on";
const fs = require("fs")
app.use(bodyParser.raw({ type: "*/*", limit:'50mb' }));

let sessions = {} // associates a session id to a username

let db; //this is the database object
let usersdb;
let itemsdb;

let genID = function () {
    return Math.floor(Math.random() * 100000000000)
}

MongoClient.connect(url, {
    useNewUrlParser: true
}, function (err, database) {
    if (err) throw err;
    db = database.db(databaseName);
    usersdb = db.collection("usersdb")
    itemsdb = db.collection("itemsdb")
    app.listen(4000, function () { console.log("Server started on port 4000") })
});

//signup endpoint
app.post('/signup', function (req, res) {
    let parsed = JSON.parse(req.body)
    let imageName = parsed.filename
    let username = parsed.usernameInput
    let password = parsed.passwordInput
    let firstName = parsed.firstNameInput
    let lastName = parsed.lastNameInput
    let email = parsed.email
    let bio = parsed.bioInput
    let address = parsed.address
    usersdb.findOne({ username: username }, function (err, result) {
        if (result || password === "") {
            let response = {
                status: false,
            }  
            res.send(JSON.stringify( response ))
            return;
        }
        else {
            let userID = genID()
            let user = { 
                imageName: imageName, 
                username: username, 
                password: password, 
                firstName: firstName,
                lastName: lastName,
                email: email,
                bio: bio,
                address: address
             }
            usersdb.insertOne(user, (err, result) => {
                let sessionID = genID()
                sessions[sessionID] = username
                res.set('Set-Cookie', sessionID)
                let response = {
                    status: true,
                    sessionID: sessionID,
                    username: username
                }  
                res.send(JSON.stringify( response ))
            })
        }
    })
})

//login endpoint
app.post('/login', function (req, res) {
    let parsed = JSON.parse(req.body)
    let username = parsed.username
    let password = parsed.password
    usersdb.findOne({ username: username }, function (err, result) {
        if (!result || result.password !== password) {
            let response = {
                status: false,
            }
            res.send(response)
            return;
        }
        else {
                let sessionID = genID()
                sessions[sessionID] = username
                res.set('Set-Cookie', sessionID)
                let response = {
                    sessionID: sessionID,
                    status: true,
                    username: username
                }
            res.send(JSON.stringify( response ))
        }
    })
})

// Add Item 
app.post('/addItem', function (req, res) {
    let parsed = JSON.parse(req.body)
    let minBid = parsed.minBid
    let itemName = parsed.itemName
    let imageName = parsed.filename
    let itemDescription = parsed.description
    let itemID = genID()
    let username = parsed.username
    let charity = parsed.charityChoice
    let itemDescriptions= {}

    itemDescriptions[itemID] = {
        itemName: itemName,
        imageName: imageName,
        itemDescription: itemDescription,
        minBid: minBid, 
        itemID: itemID,
        username: username,
        charity: charity,
        comments: [],
        currentBid: 0,
        bidHistory:[]
    }
    itemsdb.insertOne(itemDescriptions[itemID], (err, result) => {
        if (err) throw err;
        console.log(result)
        let response = {
            status: true
        }
        res.send(JSON.stringify( response ))
    })
})

// Add Image 
// need to write the image to a dictionary using the image name - i think(use fs.)
app.use(express.static(__dirname+'/images'))

app.post('/pics', (req, res) => {
    var extension = req.query.ext.split('.').pop();
    var randomString = '' +  Math.floor(Math.random() * 10000000)
    var randomFilename = randomString + '.' + extension
    fs.writeFileSync(__dirname+'/images/' +  randomFilename, req.body);
    res.send(randomFilename)
})

// send back all of the items 
app.get('/itemsList', function (req, res) {
    itemsdb.find({}).toArray((err, result) => {
        if (err) throw err;
        console.log(result)
        res.send(JSON.stringify( result ))
    })
})

// Send back 4 items with highest current bids, in an array from highest to lowest
app.get('/home', function (req, res) {
    itemsdb.find({}).toArray((err, result) => {
        if (err) throw err;
        console.log(result)
        result.sort(function(a, b){
            return b.currentBid - a.currentBid
        })
        let itemsArray = result.slice(0,4)
        res.send(JSON.stringify( itemsArray ))
    })
})

//updates the comments array for the specified itemID
app.post('/addComment', function (req, res){
    let parsed = JSON.parse(req.body)
    let itemID = parsed.itemID
    itemID = parseInt(itemID)
    let comment = parsed.commentInput
    itemsdb.updateOne({itemID:itemID},{$push:{comments:comment}}, (err, result) => {
        if (err) throw err;
        console.log(result)
        let response = {
            status: true,
        }
        res.send(JSON.stringify( response ))
    })
})

// View all Item Details for the specific itemID
app.post('/itemDetails', function (req, res) {
    let parsed = JSON.parse(req.body)
    let itemID = parsed.itemID
    let itemDetails = {
       itemID: parseInt(itemID)
   }
    itemsdb.findOne(itemDetails,(err, result) => {
        if (err) throw err;
        res.send(JSON.stringify( result ))
    })
})

//Specific member Details
app.post('/member', function (req, res) {
    let parsed = JSON.parse(req.body)
    let username = parsed.username
    usersdb.findOne({username:username},(err, result) => {
        if (err) throw err;
        res.send(JSON.stringify( result ))
    })
})
//Search endpoint based on memeber's name
app.post('/search',function(req,res){
    let parsed = JSON.parse(req.body)
    let searchWord = parsed.query
    usersdb.find({}).toArray(function(err, result){
        if (err) throw err;
        let searchResults = result.filter(function (user){
            return user.username.toLowerCase().includes(searchWord)
        })
        res.send(JSON.stringify(searchResults))
    })
})
// send back an array of all the members 
app.get('/getMembers', function (req, res) {
    usersdb.find({}).toArray((err, result) => {
        if (err) throw err;
        console.log(result)
        res.send(JSON.stringify( result ))
    })
})



//Updates the current bid for the specified itemID
app.post('/newBid', function (req, res){
    let parsed = JSON.parse(req.body)
    let itemID = parsed.itemID
    itemID = parseInt(itemID)
    let newBid = parseInt(parsed.newBid)
    itemsdb.findOne({itemID:itemID},(err, result) => {
        if (err) throw err;
        if (newBid >= result.minBid && newBid > result.currentBid) {
            itemsdb.findOneAndUpdate({itemID:itemID},{$set:{currentBid:newBid},$push:{bidHistory:newBid}},{returnOriginal:false}, (err, result) => {
                if (err) throw err;
                console.log(result)
                let response = {
                    status: true,
                    item: result.value
                }
                res.send(JSON.stringify( response ))
            })
        } else {
            let response = {
                status: false,
            }
            res.send(JSON.stringify( response ))
        }
    })
})
