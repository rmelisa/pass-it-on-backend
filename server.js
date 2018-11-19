var nodeGeocoder = require('node-geocoder'); //needed for the location information
var geocoder = nodeGeocoder({provider:"openstreetmap"}) // needed for the Map
const express = require("express");
const app = express();
const MongoClient = require("mongodb").MongoClient;
const bodyParser = require("body-parser");
const url = "mongodb://admin:matteo1@ds159563.mlab.com:59563/pass_it_on";
const databaseName = "pass_it_on";
const fs = require("fs")
app.use(bodyParser.raw({
    type: "*/*",
    limit: '50mb'
}));

let sessions = {} // associates a session id to a username

let db; //this is the database object
let usersdb;
let itemsdb;
let bidsdb;

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
    bidsdb = db.collection('bidsdb')
    app.listen(4030, function () {
        console.log("Server started on port 4030")
    })
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
    let address = parsed.addressInput
    //Gets the location of the user by typing a valid address:
    geocoder.geocode(address).then( function ( data ) {
        console.log(data)
        let location={
            lat: parseFloat(data[0].latitude),
            lon: parseFloat(data[0].longitude)
        }
    usersdb.findOne({
        username: username
    }, function (err, result) {
        if (result || password === "") {
            let response = {
                status: false,
            }
            res.send(JSON.stringify(response))
            return;
        } else {
            let userID = genID()
            let user = {
                imageName: imageName,
                username: username,
                password: password,
                firstName: firstName,
                lastName: lastName,
                email: email,
                bio: bio,
                address: address,
                location: location
            }
            usersdb.insertOne(user, (err, result) => {
                let sessionID = genID()
                sessions[sessionID] = username
                res.set('Set-Cookie', sessionID)
                let response = {
                    status: true,
                    sessionID: true,
                    username: username
                }
                res.send(JSON.stringify(response))
            })
        }
    })
})
})


//login endpoint
app.post('/login', function (req, res) {
    let parsed = JSON.parse(req.body)
    let username = parsed.username
    let password = parsed.password
    usersdb.findOne({
        username: username
    }, function (err, result) {
        if (!result || result.password !== password) {
            let response = {
                status: false,
            }
            res.send(response)
            return;
        } else {
            let sessionID = genID()
            sessions[sessionID] = username
            res.set('Set-Cookie', sessionID)
            let response = {
                sessionID: true,
                status: true,
                username: username
            }
            res.send(JSON.stringify(response))
        }
    })
})

// Add Item 
app.post('/addItem', function (req, res) {
    if (!req.headers.cookie || sessions[req.headers.cookie] === undefined) {
        let response = {
            status: false
        }
        res.send(JSON.stringify(response))
        return
    }
    let parsed = JSON.parse(req.body)
    let minBid = parsed.minBid
    let itemName = parsed.itemName
    let imageName = parsed.filename
    let itemDescription = parsed.description
    let itemID = genID()
    let username = sessions[req.headers.cookie]
    let charity = parsed.charityChoice
    let itemDescriptions = {}

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
        bidHistory: [],
        currentBidUser: '',
        timer: Date.now(),
        timerEnd: Date.now() + (60000 * 60 * 24 * 5)
    }
    itemsdb.insertOne(itemDescriptions[itemID], (err, result) => {
        if (err) throw err;
        console.log(result)
        let response = {
            status: true
        }
        res.send(JSON.stringify(response))
    })
})

// Add Image 
// need to write the image to a dictionary using the image name - i think(use fs.)
app.use(express.static(__dirname + '/images'))

app.post('/pics', (req, res) => {
    var extension = req.query.ext.split('.').pop();
    var randomString = '' + Math.floor(Math.random() * 10000000)
    var randomFilename = randomString + '.' + extension
    fs.writeFileSync(__dirname + '/images/' + randomFilename, req.body);
    res.send(randomFilename)
})

// send back all of the items 
app.get('/itemsList', function (req, res) {
    itemsdb.find({}).toArray((err, result) => {
        if (err) throw err;
        console.log(result)
        res.send(JSON.stringify(result))
    })
})

// Send back 4 items with highest current bids, in an array from highest to lowest
app.get('/home', function (req, res) {
    itemsdb.find({}).toArray((err, result) => {
        if (err) throw err;
        console.log(result)
        result.sort(function (a, b) {
            return b.currentBid - a.currentBid
        })
        let itemsArray = result.slice(0, 5)
        res.send(JSON.stringify(itemsArray))
    })
})

//updates the comments array for the specified itemID
app.post('/addComment', function (req, res) {
    let parsed = JSON.parse(req.body)
    let itemID = parsed.itemID
    itemID = parseInt(itemID)
    let comment = parsed.commentInput
    itemsdb.updateOne({
        itemID: itemID
    }, {
            $push: {
                comments: comment
            }
        }, (err, result) => {
            if (err) throw err;
            console.log(result)
            let response = {
                status: true,
            }
            res.send(JSON.stringify(response))
        })
})

// View all Item Details for the specific itemID
app.post('/itemDetails', function (req, res) {
    let parsed = JSON.parse(req.body)
    let itemID = parsed.itemID
    let itemDetails = {
        itemID: parseInt(itemID)
    }
    itemsdb.findOne(itemDetails, (err, result) => {
        if (err) throw err;
        res.send(JSON.stringify(result))
    })
})

//Specific member Details
app.post('/member', function (req, res) {
    let parsed = JSON.parse(req.body)
    let username = parsed.username
    usersdb.findOne({
        username: username
    }, (err, result) => {
        if (err) throw err;
        res.send(JSON.stringify(result))
    })

})
//Search endpoint based on memeber's name
app.post('/search', function (req, res) {
    let parsed = JSON.parse(req.body)
    let searchWord = parsed.query
    usersdb.find({}).toArray(function (err, result) {
        if (err) throw err;
        let searchResults = result.filter(function (user) {
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
        res.send(JSON.stringify(result))
    })
})



//Updates the current bid for the specified itemID
app.post('/newBid', function (req, res) {
    if (!req.headers.cookie || sessions[req.headers.cookie] === undefined) {
        let response = {
            status: 'notLogged'
        }
        res.send(JSON.stringify(response))
        return
    }
    let parsed = JSON.parse(req.body)
    let itemID = parsed.itemID
    itemID = parseInt(itemID)
    let newBid = parseInt(parsed.newBid)
    itemsdb.findOne({
        itemID: itemID
    }, (err, result) => {
        if (err) throw err;
        if (newBid >= result.minBid && newBid > result.currentBid) {
            let bid = {
                username: sessions[req.headers.cookie],
                newBid: newBid,
                itemID: itemID
            }
            bidsdb.insertOne(bid, (err, result) => {
                if (err) throw err;
                console.log(result)
                itemsdb.findOneAndUpdate({
                    itemID: itemID
                }, {
                        $set: {
                            currentBid: newBid,
                            currentBidUser: sessions[req.headers.cookie]
                        },
                        $push: {
                            bidHistory: newBid
                        }
                    }, {
                        returnOriginal: false
                    }, (err, result) => {
                        if (err) throw err;
                        console.log(result)
                        let response = {
                            status: 'success',
                            item: result.value,
                        }
                        res.send(JSON.stringify(response))
                    })
            })
        } else {
            let response = {
                status: 'lowBid',
            }
            res.send(JSON.stringify(response))
        }
    })
})

app.get('/logout', function (req, res) {
    delete sessions[req.headers.cookie]
})

app.get('/sessionActive', function (req, res) {
    if (req.headers.cookie && sessions[req.headers.cookie] !== undefined) {
        let response = {
            status: true,
            sessionID: true,
            username: sessions[req.headers.cookie]
        }
        res.send(JSON.stringify(response))
    } else {
        let response = {
            status: false
        }
        res.send(JSON.stringify(response))
    }
})

app.get('/getBids', function (req, res) {
    let currentUsername = sessions[req.headers.cookie]
    console.log(currentUsername)
    bidsdb.find({ username: currentUsername }).toArray((err, result) => {
        if (err) throw err;
        console.log(result)
        let bidsArr = result
        itemsdb.find({}).toArray((err, result) => {
            let items = bidsArr.map(function (bid) {
                for (let i = 0; i < result.length; i++) {
                    if (result[i].itemID === bid.itemID) {
                        return { ...result[i], mybid: bid }
                    }
                }
            })
            console.log(items)
            res.send(JSON.stringify(items))
        })
    })
})

app.get('/getAllCharities', function (req, res) {
    let charityMap = {}
    itemsdb.find({}).toArray((err, result) => {
        result.forEach(item => {
            let currentTime = Date.now()
        if (item.timerEnd < currentTime) {
            if (!charityMap[item.charity]) {
                charityMap[item.charity] = item.currentBid
            } else {
                charityMap[item.charity] += item.currentBid
            }
        }
    });
        res.send(JSON.stringify(charityMap))
    })
})


//Remove Item endpoint
// app.post('/removeItem', function (req, res) {
//     let parsed = JSON.parse(req.body)
//     let itemID = parsed.itemID

//     itemsdb.deleteOne({
//         itemID: itemID
//     }, (err, result) => {
//         if (err) throw err;

//     })
//     itemsdb.find({}).toArray((err, result) => {
//         if (err) throw err;
//         console.log(result)
//         res.send(JSON.stringify(result))
//     })
// })