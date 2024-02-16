const {
    Server
} = require("socket.io");
const sessionMiddleware = require("./middlewares/sessionMiddleware");
const User = require("./database/User");
const Config = require('./database/Config');

let brbLimit = 5;
const restingTimes = {
    6: 6 * 60 * 1000,
    12: 12 * 60 * 1000
};

let queue = [];

let usersCurrentlyResting = [];

let usersTotalBreakTime = new Map();

module.exports = async (app, server) => {
    const io = new Server(server);

    brbLimit = (await Config.findOne({ name: 'brbLimit' }).exec())?.value?.max || brbLimit;

    io.use((socket, next) => {
        sessionMiddleware(socket.request, {}, next);
    });

    const updateUI = () => {
        return {
            usersCurrentlyResting,
            queue,
            brbLimit,
            usersTotalBreakTime: Object.fromEntries(usersTotalBreakTime) || {}
        };
    }

    io.on('connection', async (socket) => {
        console.log('A user connected');

        let user = socket.request.session.passport?.user;
        let userEntity = null;
        if (!!user) {
            userEntity = await User.findById(user).exec();
            userEntity = { name: userEntity.name, username: userEntity.username, type: userEntity.type }
        }

        socket.emit("update-ui", updateUI());

        socket.onAny((eventName, ...args) => {
            console.log(`Received event '${eventName}' with arguments:`, args);
        });

        socket.on('restRequest', (duration) => {
            if (user) {
                if (usersCurrentlyResting.some((d) => d.user == user) || queue.some(d => d.user == user)) {
                    socket.emit('restResponse', {
                        success: false,
                        message: 'You are already resting.'
                    });
                } else {
                    queue.push({
                        userEntity,
                        user,
                        duration
                    });
                    socket.emit('message', {
                        success: true,
                        message: `Your rest request (${duration} minutes) has been added to the queue.`
                    });

                    io.emit("update-ui", updateUI());
                }
            } else {
                socket.emit('message', {
                    success: false,
                    message: 'Authentication required.'
                });
            }
        });

        socket.on('cancelRestRequest', () => {
            if (user) {
                queue = queue.filter(item => item.user !== user);
                socket.emit('cancelRestResponse', {
                    success: true,
                    message: 'Your rest request has been canceled.'
                });

                io.emit("update-ui", updateUI());
            } else {
                socket.emit('message', {
                    success: false,
                    message: 'Authentication required.'
                });
            }
        });

        socket.on('startRestRequest', () => {
            if (user) {
                const userIndexInQueue = queue.findIndex(item => item.user === user);
                if (userIndexInQueue !== -1 && userIndexInQueue < brbLimit - usersCurrentlyResting.length) {
                    const requestedUser = queue.splice(userIndexInQueue, 1)[0];
                    usersCurrentlyResting.push({
                        user: requestedUser.user,
                        userEntity,
                        startTime: Date.now(),
                        duration: restingTimes[requestedUser.duration]
                    });
                    socket.emit('startRestResponse', {
                        success: true,
                        message: 'Your rest has started.'
                    });

                    io.emit("update-ui", updateUI());
                } else {
                    socket.emit('startRestResponse', {
                        success: false,
                        message: 'It is not your turn to rest or you have not requested to rest.'
                    });
                }
            } else {
                socket.emit('message', {
                    success: false,
                    message: 'Authentication required.'
                });
            }
        });

        socket.on('goBackFromBreakRequest', () => {
            if (user) {
                const userIndexInResting = usersCurrentlyResting.findIndex(restingUser => restingUser.user === user);
                if (userIndexInResting !== -1) {

                    const endTime = Date.now();
                    const startTime = usersCurrentlyResting[userIndexInResting].startTime;
                    const duration = endTime - startTime;
                    usersTotalBreakTime.set(user, {
                        duration: (usersTotalBreakTime.get(user)?.duration || 0) + duration,
                        name: userEntity.name
                    });

                    console.log(JSON.stringify(Object.fromEntries(usersTotalBreakTime)));

                    usersCurrentlyResting.splice(userIndexInResting, 1);

                    socket.emit('message', {
                        success: true,
                        message: `You've rested for ${duration / (1000 * 60)} minutes.`
                    });

                    io.emit("update-ui", updateUI());
                } else {
                    socket.emit('message', {
                        success: false,
                        message: 'You are not currently on break.'
                    });
                }
            } else {
                socket.emit('message', {
                    success: false,
                    message: 'Authentication required.'
                });
            }
        });

        socket.on('updateBrbLimit', async (newLimit) => {
            if (user && (userEntity.type === "admin" || userEntity.type === "powerUser")) {
                try {
                    brbLimit = newLimit;
        
                    await Config.findOneAndUpdate({ name: 'brbLimit' }, { value: { max: newLimit } });
        
                    socket.emit('message', {
                        success: true,
                        message: `BRB limit updated to ${newLimit} minutes.`
                    });
        
                    io.emit("update-ui", updateUI());
                } catch (error) {
                    socket.emit('message', {
                        success: false,
                        message: 'Failed to update BRB limit.'
                    });
                }
            } else {
                socket.emit('message', {
                    success: false,
                    message: 'You are not authorized to perform this action.'
                });
            }
        });

        socket.on('allowUserToGoOnBreak', (userToAllow) => {
            if (user && (userEntity.type === "admin" || userEntity.type === "powerUser")) {
                const usersCanGo = queue.slice(0, brbLimit - usersCurrentlyResting.length);
                const userIndexInCanGoList = usersCanGo.findIndex(item => item.user === userToAllow);
                
                if (userIndexInCanGoList !== -1) {
                    const requestedUser = queue.splice(userIndexInCanGoList, 1)[0];
                    usersCurrentlyResting.push({
                        user: requestedUser.user,
                        userEntity: requestedUser.userEntity,
                        startTime: Date.now(),
                        duration: restingTimes[requestedUser.duration]
                    });
        
                    socket.emit('startRestResponse', {
                        success: true,
                        message: `${requestedUser.userEntity.name} can now start their rest.`
                    });
        
                    io.emit("update-ui", updateUI());
                } else {
                    socket.emit('message', {
                        success: false,
                        message: `${userToAllow} is not eligible to go on break at the moment.`
                    });
                }
            } else {
                socket.emit('message', {
                    success: false,
                    message: 'You are not authorized to perform this action.'
                });
            }
        });

        socket.on('adminSendUserBack', (userToSendBack) => {
            if (user && (userEntity.type === "admin" || userEntity.type === "powerUser")) {
                const userIndexInResting = usersCurrentlyResting.findIndex(restingUser => restingUser.user === userToSendBack);
        
                if (userIndexInResting !== -1) {
                    const endTime = Date.now();
                    const startTime = usersCurrentlyResting[userIndexInResting].startTime;
                    const duration = endTime - startTime;
                    usersTotalBreakTime.set(userToSendBack, {
                        duration: (usersTotalBreakTime.get(userToSendBack)?.duration || 0) + duration,
                        name: usersCurrentlyResting[userIndexInResting].userEntity.name
                    });
        
                    usersCurrentlyResting.splice(userIndexInResting, 1);
        
                    socket.emit('message', {
                        success: true,
                        message: `${userToSendBack} has been sent back from their break.`
                    });
        
                    io.emit("update-ui", updateUI());
                } else {
                    socket.emit('message', {
                        success: false,
                        message: `${userToSendBack} is not currently on break.`
                    });
                }
            } else {
                socket.emit('message', {
                    success: false,
                    message: 'You are not authorized to perform this action.'
                });
            }
        });

        socket.on('adminTimeUpdate', (data) => {

            const userId = data.userId;
            const actualTime = data.dur;

            if (user && (userEntity.type === "admin" || userEntity.type === "powerUser")) {
                if (usersTotalBreakTime.has(userId)) {
                    usersTotalBreakTime.set(userId, {
                        ...usersTotalBreakTime.get(userId),
                        duration: actualTime
                    });

                    io.emit("update-ui", updateUI());
                } else {
                    socket.emit("message", {
                        success: false,
                        message: "Record does not exists!"
                    });
                }
            } else {
                socket.emit("message", {
                    success: false,
                    message: "You're not an admin."
                });
            }
        });

        socket.on('getQueueInfo', () => {
            socket.emit('update-ui', updateUI());
        });
    });

    return io;
};