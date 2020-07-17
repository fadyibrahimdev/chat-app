const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require('./utils/messages')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

//socket.emit ==> to send data
//socket.on   ==> to recieve data

//io.emit ==> to send data to all users, not just one
//io.on ==> to start the connection --> started on client with io() ==> runs when client gets connected

//socket.on('disconnect') inside io.on('connection') callback ==> to run message when client disconnects

//socket.broadcast.emit ==> to send data to all users, except the cause connection

io.on('connection', (socket) => {
    console.log('new websocket connection')

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })
        if(error) return callback(error)

        socket.join(user.room) //to join specific room (socket.io function)

        socket.emit('message', generateMessage("Admin", 'Welcome!'))
        socket.broadcast.to(user.room).emit('message', generateMessage("Admin", `${user.username} has joined!`))
        //adding .to() on io.emit or broadcast.emit to send the message to a specific room

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        
        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const filter = new Filter()
        const user = getUser(socket.id)

        if(filter.isProfane(message)) return callback('cannot use profane words!')

        io.to(user.room).emit('message', generateMessage(user.username, message))

        callback()
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if(user) {
            io.to(user.room).emit('message', generateMessage("Admin", `${user.username} has left!`))

            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log('server is listening on port', port)
})

//difference between http requests & websockets
//http request are one direction --> from user to server
//websocket are full-duplex --> server can send data to user from itself