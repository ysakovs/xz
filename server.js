const User = require('./user')

/**
 * Every logged in user
 */
const users = []

/**
 * Users waiting for match
 */
const chatQueue = []

setInterval(matchUsers, 100)

function serv(io) {
  const chat = io.of('/chat')
  chat.on('connection', socket => {
    console.log(`${socket.id} connected`)

    socket.on('login', (data, fn) => {
      console.log(`${socket.id} logged in`)
      if ((data.myGender === 'male' || data.myGender === 'female')
        && data.searchFor.length >= 1 && data.searchFor.length <= 2) {
        users.push(new User(socket, data.myGender, data.searchFor))
        fn(true)
      } else {
        fn(false)
      }
    })
    socket.on('search', data => {
      console.log(`${socket.id} is looking for someone`)
      const thisUser = users.find(user => user.socket.id == socket.id)
      chatQueue.push(thisUser)
    })

    socket.on('leave', data => {
      console.log(`${socket.id} left the room`)
      let room = Object.keys(socket.rooms)[1]
      io.to(room).emit('user-left')
      socket.leave(room)
    })

    socket.on('message', (msg, fn) => {
      console.log(`${socket.id} sent message: ${msg}`)
      let room = Object.keys(socket.rooms)[1]
      socket.to(room).emit('message', msg)
      fn(msg)
    })

    socket.on('disconnecting', data => {
      console.log(`${socket.id} is disconnecting`)
      let room = Object.keys(socket.rooms)[1]
      chat.to(room).emit('user-left')
      // chat.in(room).clients((error, clients) => {
      //   if (error) throw error;
      //   for(let i = 0; i < clients.length; i++){
      //     chat.sockets.connected[clients[i]].leave(room)
      //   }
      // });
    })

    socket.on('disconnect', data => {
      console.log(`${socket.id} disconnected`)
      let user = users.find(user => user.socket.id == socket.id)
      if (!user) return
      let indexOf = users.indexOf(user)
      if (indexOf) users.splice(indexOf, 1)
      indexOf = chatQueue.indexOf(user)
      if (indexOf) chatQueue.splice(indexOf, 1)
    })
  })
}

/**
 * Matches two users
 */
function matchUsers() {
  if (chatQueue.length <= 1) return
  // for each user in the chat queue
  for (let i = 0; i < chatQueue.length; i++) {
    let thisUser = chatQueue[i]
    // find other users that fulfil the current user's requirements
    const availableUsers = chatQueue.filter(user => {
      return user.socket.id != thisUser.socket.id
        && thisUser.searchFor.includes(user.gender)
        && user.searchFor.includes(thisUser.gender)
    })
    // if there is no such user return
    if (availableUsers.length == 0) continue
    let rand = Math.floor(Math.random() * availableUsers.length)
    // connect with random user from availables
    let otherUser = availableUsers[rand]
    let roomName = thisUser.socket.id + otherUser.socket.id
    thisUser.socket.join(roomName)
    otherUser.socket.join(roomName)
    thisUser.socket.emit('join')
    otherUser.socket.emit('join')
    chatQueue.splice(chatQueue.indexOf(thisUser), 1)
    chatQueue.splice(chatQueue.indexOf(otherUser), 1)
    return
  }
}

module.exports = serv