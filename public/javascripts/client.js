(function () {
    var socket = io();
    var timers = [];

    function isOnEitherList(data) {
        return data.queue.some((d) => d.user === window.user) || data.usersCurrentlyResting.some((d) => d.user === window.user);
    }

    function isOn(list) {
        return list.some(d => d.user === window.user);
    }

    function displayBreakTimeModal(defaultMinutes = 0, defaultSeconds = 0) {
        const modal = document.getElementById('breakTimeModal');
        const minutesInput = document.getElementById('breakMinutes');
        const secondsInput = document.getElementById('breakSeconds');

        minutesInput.value = defaultMinutes;
        secondsInput.value = defaultSeconds;

        modal.style.display = 'block';

        return new Promise((resolve, reject) => {
            document.getElementById('confirm-breakTime').addEventListener('click', function () {
                const minutes = parseInt(minutesInput.value);
                const seconds = parseInt(secondsInput.value);
                modal.style.display = 'none';
                resolve({
                    minutes,
                    seconds
                });
            });

            document.getElementById('cancel-breakTime').addEventListener('click', function () {
                modal.style.display = 'none';
                reject(new Error('User canceled'));
            });

            window.addEventListener('click', function (event) {
                if (event.target === modal) {
                    modal.style.display = 'none';
                    reject(new Error('User canceled'));
                }
            });
        });
    }

    function displayBRBLimitUpdateModal(defaultLimit = 0) {
        const modal = document.getElementById('brbLimitUpdateModal');
        const brbLimitInput = document.getElementById('newBrbLimit');

        brbLimitInput.value = defaultLimit;

        modal.style.display = 'block';

        return new Promise((resolve, reject) => {
            document.getElementById('confirm-brbLimitUpdate').addEventListener('click', function () {
                const newLimit = parseInt(brbLimitInput.value);
                modal.style.display = 'none';
                resolve(newLimit);
            });

            document.getElementById('cancel-brbLimitUpdate').addEventListener('click', function () {
                modal.style.display = 'none';
                reject(new Error('User canceled'));
            });

            window.addEventListener('click', function (event) {
                if (event.target === modal) {
                    modal.style.display = 'none';
                    reject(new Error('User canceled'));
                }
            });
        });
    }

    function updateUI(data) {
        timers.forEach(timerId => {
            clearInterval(timerId);
        });
        timers = [];

        const onBrbQueueContent = document.getElementById('onBrbQueueContent');
        const canGoQueueContent = document.getElementById('canGoQueueContent');
        const waitingQueueContent = document.getElementById('waitingQueueContent');
        const queueTitle = document.querySelector(".queue-title");
        const brb6Button = document.getElementById("brb6Button");
        const brb12Button = document.getElementById("brb12Button");
        const startButton = document.getElementById("startButton");
        const backButton = document.getElementById("backButton");
        const totalRestList = document.getElementById("totalRestList");
        const totalRestListTitle = document.getElementById("totalRestListTitle");

        onBrbQueueContent.innerHTML = ''; // Clear previous content
        canGoQueueContent.innerHTML = ''; // Clear previous content
        waitingQueueContent.innerHTML = ''; // Clear previous content
        totalRestList.innerHTML = '';
        queueTitle.innerHTML = `On BRB (${data.brbLimit} is allowed):`;
        if (window.userType === "admin" || window.userType === "powerUser") queueTitle.classList.add("admin");

        if (Object.keys(data.usersTotalBreakTime).length === 0) {
            totalRestListTitle.style.display = 'block';
        } else {
            totalRestListTitle.style.display = 'block';

            Object.entries(data.usersTotalBreakTime).forEach(([userId, time]) => {
                const minutes = ('00' + Math.floor(time.duration / (1000 * 60))).slice(-2);
                const second = ('00' + Math.floor(time.duration / 1000) % 60).slice(-2);

                console.log(JSON.stringify(time));

                const userItem = document.createElement('li');

                userItem.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center;" class="totaldur ${window.userType === "admin" || window.userType === "powerUser" ? "admin" : ""}"><span>${time.name}</span><span>${minutes}:${second}</span></div>
                `;

                totalRestList.appendChild(userItem);

                if (window.userType === "admin" || window.userType === "powerUser") {
                    userItem.addEventListener("click", function (e) {
                        e.preventDefault();

                        displayBreakTimeModal(minutes, second).then(({
                            minutes,
                            seconds
                        }) => {
                            const dur = minutes * (60 * 1000) + seconds * 1000;
                            socket.emit("adminTimeUpdate", {
                                userId: userId,
                                dur
                            });
                        }).catch(error => {
                            console.log("User canceled input.");
                        });

                    });
                }
            });
        }

        // Update On BRB Queue
        data.usersCurrentlyResting.forEach(user => {
            const userItem = document.createElement('div');
            const updateElapsedTime = () => {
                const startTime = new Date(user.startTime);
                const elapsedTime = Math.floor((Date.now() - startTime) / (1000));
                const elapsedMinutes = ('00' + Math.floor(elapsedTime / 60)).slice(-2);
                const elapsedSeconds = ('00' + Math.floor(elapsedTime % 60)).slice(-2);
                userItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;" class="usersResting ${window.userType === "admin" || window.userType === "powerUser" ? "admin" : ""}">
                <span>${user.userEntity.name}</span>
                <div>
                    <span style="margin-right: 5px;">${elapsedMinutes}:${elapsedSeconds}</span>
                    <span style="display: inline-block; width: 36px; height: 18px; border: 0.5px solid rgb(255, 255, 255); font-size: smaller; border-radius: 7px; text-align: center; line-height: 16px; color: rgb(255, 255, 255);">${user.duration / (1000 * 60)}</span>
                </div>
            </div>`;
            };

            // Initial update
            updateElapsedTime();

            // Update every second
            const intervalId = setInterval(updateElapsedTime, 1000);
            timers.push(intervalId);

            userItem.addEventListener("click", function (e) {
                e.preventDefault();

                const confirmator = confirm("Do you want to send this user back to work?");

                if (confirmator) {
                    socket.emit('adminSendUserBack', user.user);
                }
            });

            onBrbQueueContent.appendChild(userItem);
        });

        const usersCanGo = data.queue.slice(0, data.brbLimit - data.usersCurrentlyResting.length);
        const usersWaiting = data.queue.slice(data.brbLimit - data.usersCurrentlyResting.length);

        // Update Can Go Queue
        usersCanGo.forEach(user => {
            const userItem = document.createElement('div');
            userItem.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center;" class="canGo ${window.userType === "admin" || window.userType === "powerUser" ? "admin" : ""}">
                  <span style="color: rgb(20, 229, 197);">${user.userEntity.name}</span>
                  <span style="display: inline-block; width: 44px; height: 16px; border: 1.2px solid rgb(61, 82, 79); border-radius: 7px; font-size: smaller; text-align: center; background: rgb(39, 62, 59);">${user.duration}</span>
                </div>`;

            canGoQueueContent.appendChild(userItem);

            if (window.userType === "admin" || window.userType === "powerUser") {
                userItem.addEventListener("click", function (e) {
                    e.preventDefault();

                    const confirmator = confirm("Do you want to send this user to rest?");

                    if (confirmator) {
                        socket.emit('allowUserToGoOnBreak', user.user);
                    }
                });
            }
        });

        // Update Waiting Queue
        usersWaiting.forEach(user => {
            const userItem = document.createElement('div');
            userItem.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>${user.userEntity.name}</span>
                  <span>${user.duration}</span>
                </div>`;
            waitingQueueContent.appendChild(userItem);
        });

        if (!!user) {
            if (isOnEitherList(data)) {
                const currentlyRest = isOn(data.usersCurrentlyResting);
                const canGo = isOn(usersCanGo);

                brb6Button.setAttribute("disabled", "disabled");
                brb12Button.setAttribute("disabled", "disabled");

                if (canGo && !currentlyRest) {
                    startButton.removeAttribute("disabled");
                    backButton.innerText = "Cancel";
                } else {
                    startButton.setAttribute("disabled", "disabled");
                    if (!isOn(usersWaiting)) backButton.innerText = "Back";
                }

                backButton.removeAttribute("disabled");
            } else {
                brb6Button.removeAttribute("disabled");
                brb12Button.removeAttribute("disabled");

                startButton.setAttribute("disabled", "disabled");
                backButton.setAttribute("disabled", "disabled");

                backButton.innerText = "Cancel";
            }
        }
    }

    // Send rest request
    document.getElementById('brb6Button').addEventListener('click', function (e) {
        e.preventDefault();
        socket.emit('restRequest', 6);
    });

    document.getElementById('brb12Button').addEventListener('click', function (e) {
        e.preventDefault();
        socket.emit('restRequest', 12);
    });

    document.getElementById('startButton').addEventListener('click', function (e) {
        e.preventDefault();
        socket.emit('startRestRequest');
    });

    document.getElementById('backButton').addEventListener('click', function (e) {
        e.preventDefault();
        const btn = document.getElementById('backButton');
        if (btn.innerText === "Back") {
            socket.emit('goBackFromBreakRequest');
        } else {
            socket.emit('cancelRestRequest');
        }
    });

    document.querySelector('.newBrb-close').addEventListener('click', function () {
        const modal = document.getElementById('brbLimitUpdateModal');
        modal.style.display = 'none';
    });

    document.querySelector('.breakTime-close').addEventListener('click', function () {
        const modal = document.getElementById('breakTimeModal');
        modal.style.display = 'none';
    });

    if (window.userType === "admin" || window.userType === "powerUser") {
        document.querySelector('.queue-title').addEventListener("click", function (e) {
            e.preventDefault();

            displayBRBLimitUpdateModal().then(newLimit => {
                if (!isNaN(newLimit)) {
                    socket.emit('updateBrbLimit', newLimit);
                } else {
                    alert("Invalid input! Please enter a valid number for the BRB limit.");
                }
            }).catch(error => {
                console.log("User canceled input.");
            });
        });
    }

    // Listen for updates from the server
    socket.on('update-ui', function (data) {
        updateUI(data);
    });

    // socket.on('message', e => alert(e.message));

    // Initial request for queue info
    socket.emit('getQueueInfo');
})();