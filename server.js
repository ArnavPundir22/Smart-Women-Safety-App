const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const path = require('path');
const twilio = require('twilio');

const app = express();
const PORT = 3000;
require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public/'));

// === Login ===
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = [];

    fs.createReadStream('./data/users.csv')
        .pipe(csvParser())
        .on('data', (data) => users.push(data))
        .on('end', () => {
            const user = users.find(u => u.username === username && u.password === password);
            if (user) {
                res.send(`<h3>Welcome, ${username}! You are logged in.</h3>`);
            } else {
                res.send('<h3>Invalid login. <a href="/index.html">Try again</a></h3>');
            }
        });
});

// === Register ===
app.post('/register', (req, res) => {
    const {
        user_id,
        username,
        email,
        password,
        contact_name,
        contact_email,
        contact_phone
    } = req.body;

    const userLine = `${user_id},${username},${email},${password}\n`;
    const contactLine = `${user_id},${contact_name},${contact_email},${contact_phone}\n`;

    fs.appendFile('./data/users.csv', userLine, err => {
        if (err) return res.send('Error saving user.');

        fs.appendFile('./data/contacts.csv', contactLine, err2 => {
            if (err2) return res.send('Error saving contact.');
            res.send('<h3>Registration successful. <a href="/index.html">Login here</a></h3>');
        });
    });
});

// === Emergency Alert API ===
app.post('/send-alert', async (req, res) => {
    const { user_id, latitude, longitude } = req.body;

    const contacts = await getContacts(user_id);
    if (!contacts.length) return res.status(404).json({ message: "No contacts found." });

    for (const contact of contacts) {
        await sendAlertEmail(contact.contact_email, latitude, longitude);
        await sendSMSAlert(contact.contact_phone, latitude, longitude);
    }

    await logAlert(user_id, latitude, longitude);

    res.json({ message: "Alert sent to contacts via Email & SMS!" });
});

// === Functions ===
function getContacts(user_id) {
    return new Promise((resolve) => {
        const results = [];

        fs.createReadStream('./data/contacts.csv')
            .pipe(csvParser())
            .on('data', (data) => {
                if (data.user_id === user_id) results.push(data);
            })
            .on('end', () => resolve(results));
    });
}

async function sendAlertEmail(to, lat, lon) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'arnavp128@gmail.com',
            pass: 'rwcd zsap vaij poue'
        }
    });

    const mailOptions = {
        from: 'arnavp128@gmail.com',
        to,
        subject: '🚨 Emergency Alert!',
        html: `<p>🚨 Aunty ji in Danger.<br> Please help me. My location: <a href="https://maps.google.com/?q=${lat},${lon}">View on Map</a></p>`
    };

    return transporter.sendMail(mailOptions);
}

async function sendSMSAlert(phone, lat, lon) {
    const message = `🚨 Emergency! Aunty ji in danger.\nLocation: https://maps.google.com/?q=${lat},${lon}`;
    
    return twilioClient.messages.create({
        body: message,
        from: twilioFromNumber,
        to: phone.startsWith('+') ? phone : '+91' + phone // Adjust prefix if needed
    });
}

function logAlert(user_id, lat, lon) {
    const alertWriter = createObjectCsvWriter({
        path: './data/alerts.csv',
        header: [
            { id: 'user_id', title: 'user_id' },
            { id: 'timestamp', title: 'timestamp' },
            { id: 'latitude', title: 'latitude' },
            { id: 'longitude', title: 'longitude' },
            { id: 'alert_sent', title: 'alert_sent' },
        ],
        append: true
    });

    const timestamp = new Date().toISOString();

    return alertWriter.writeRecords([
        {
            user_id,
            timestamp,
            latitude: lat,
            longitude: lon,
            alert_sent: 'Yes'
        }
    ]);
}

// === Start Server ===
console.log("Starting Smart Women Safety server...");
try {
    app.listen(PORT, () => {
        console.log(`✅ Server is running at http://localhost:${PORT}`);
    });
} catch (err) {
    console.error("❌ Server failed to start:", err);
}

