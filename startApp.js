// startApp.js
const { exec } = require('child_process');
const open = require('open');

const server = exec('node server.js', (err, stdout, stderr) => {
    if (err) {
        console.error(`❌ Server error: ${err}`);
        return;
    }
    console.log(stdout);
    console.error(stderr);
});

// Wait a bit and open the browser
setTimeout(() => {
    open('http://localhost:3000');
}, 150); // wait for server to spin up

