'use strict'
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

let chat = null

function serv(io) {
  chat = io.of('/chat')
  chat.on('connection', handleConnection)
  return {
    getUserCount: () => users.length,
    getQueueLength: () => chatQueue.length
  }
}

function handleConnection(socket) {
  console.log(`${socket.id} connected`)

  socket.on('login', (data, fn) => {
    console.log(`${socket.id} logged in`)
    if ((data.myGender === 'male' || data.myGender === 'female')
      && data.searchFor.length >= 1 && data.searchFor.length <= 2) {
      users.push(new User(socket, data.myGender, data.searchFor))
      chat.emit('server-info', {
        online: users.length
      })
      fn(true)
    } else {
      fn(false)
    }
  })

  socket.on('logout', () => {
    console.log(`${socket.id} logged out`)
    let thisUser = users.find(u => u.socket.id == socket.id)
    if (!thisUser) return
    users.splice(users.indexOf(thisUser))
  })

  socket.on('search', data => {
    if (data === true) {
      const thisUser = users.find(user => user.socket.id == socket.id)
      if (thisUser) {
        chatQueue.push(thisUser)
        console.log(`${socket.id} (${thisUser.gender}) is looking for ${thisUser.searchFor}`)
      } else {
        console.log('no such user')
      }
    } else {
      console.log(`${socket.id} stopped looking for someone`)
      const thisUser = users.find(user => user.socket.id == socket.id)
      chatQueue.splice(chatQueue.indexOf(thisUser), 1)
    }
  })

  socket.on('leave', data => {
    console.log(`${socket.id} left the room`)
    let room = Object.keys(socket.rooms)[1]
    if (!room) return
    chat.to(room).emit('user-left')
    chat.emit('server-info', {
      online: users.length
    })
    socket.leave(room)
    const socketId = room.split('|')[1]
    console.log(socketId)
    const otherUser = users.find(u => u.socket.id === socketId)
    if (otherUser)
      otherUser.socket.leave(room)
  })

  socket.on('typing', start => {
    let room = Object.keys(socket.rooms)[1]
    socket.to(room).emit('typing', start)
  })

  socket.on('read', () => {
    let room = Object.keys(socket.rooms)[1]
    socket.to(room).emit('read')
  })

  socket.on('message', (msg, fn) => {
    let message = msg.trim()
    console.log(`${socket.id} sent message: ${message}`)
    if (message === '' || message.length > 1024) {
      return fn({ error: true })
    }
    let room = Object.keys(socket.rooms)[1]
    socket.to(room).emit('message', { error: false, msg: message })
    fn({ error: false, msg: message })
  })

  socket.on('disconnecting', data => {
    console.log(`${socket.id} is disconnecting`)
    const user = users.find(user => user.socket.id == socket.id)
    if (!user) return
    const room = Object.keys(socket.rooms)[1]
    chat.to(room).emit('user-left')
  })

  socket.on('disconnect', data => {
    console.log(`${socket.id} disconnected`)
    const user = users.find(user => user.socket.id == socket.id)
    if (!user) return
    let indexOf = users.indexOf(user)
    if (indexOf != -1) users.splice(indexOf, 1)
    indexOf = chatQueue.indexOf(user)
    if (indexOf != -1) chatQueue.splice(indexOf, 1)
    chat.emit('server-info', {
      online: users.length
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
    let roomName = thisUser.socket.id + '|' + otherUser.socket.id
    thisUser.socket.join(roomName)
    otherUser.socket.join(roomName)
    thisUser.socket.emit('join', { gender: otherUser.gender })
    otherUser.socket.emit('join', { gender: thisUser.gender })
    chatQueue.splice(chatQueue.indexOf(thisUser), 1)
    chatQueue.splice(chatQueue.indexOf(otherUser), 1)
    return
  }
}

module.exports = serv